import { GraphQLError } from "graphql";
import { prisma } from "../../prisma/client";
import { createAuditLog } from "../../utils/auditLogger";
import { getAsyncIterator, pubsub } from "../../utils/pubsub";
import { DocumentType, EntityType, VinStatus } from "@prisma/client";
import crypto from "crypto";
import { extractGeminiFields } from "../../utils/gemini";
import { decodeVinPublicData } from "../../utils/vinDecode";
import { requireAuth } from "../../utils/authMiddleware";
import { capLimit } from "../../utils/pagination";

const normalizeTitle = (title: string) => title.trim().toLowerCase();

const mapTitleToDocType = (title: string): DocumentType => {
  const t = normalizeTitle(title);
  if (t === "vehicle registration") return DocumentType.REGISTRATION;
  if (t === "ownership proof") return DocumentType.OWNERSHIP_PROOF;
  if (t === "insurance certificate") return DocumentType.INSURANCE_CERTIFICATE;
  if (t === "maintenance history (invoices)") return DocumentType.MAINTENANCE_HISTORY;
  if (t === "supporting document") return DocumentType.SUPPORTING_DOCUMENT;
  if (t === "front view") return DocumentType.FRONT_VIEW;
  if (t === "back view") return DocumentType.BACK_VIEW;
  if (t === "side views") return DocumentType.SIDE_VIEWS;
  if (t === "interior view") return DocumentType.INTERIOR_VIEW;
  if (t === "engine / odometer") return DocumentType.ENGINE_ODOMETER;
  if (t === "additional images") return DocumentType.ADDITIONAL_IMAGES;
  return DocumentType.SUPPORTING_DOCUMENT;
};

const makeHash = (input: string) =>
  crypto.createHash("sha256").update(input).digest("hex");

export const vinPassportResolvers = {
  Query: {
    getVinPassports: async (_: any, { limit, offset, search }: { limit: number, offset: number, search: string }) => {
      return prisma.vinPassport.findMany({
        where: { isDeleted: false },
        take: capLimit(limit, 50),
        skip: Math.max(0, offset ?? 0),
      });
    },

    getVinPassport: async (_: any, { id }: { id: string }) => {
      const vinPassport = await prisma.vinPassport.findUnique({
        where: { id },
      });
      if (!vinPassport || vinPassport.isDeleted) throw new GraphQLError("VinPassport not found");
      return vinPassport;
    },
  },

  Mutation: {
    createVinPassport: async (_: any, { input }: { input: { vin: string } }, context: any) => {
      requireAuth(context);
      const { vin } = input;

      const vinPassport = await prisma.vinPassport.create({
        data: {
          vin,
          status: VinStatus.PENDING,
          owner: {
            connect: { id: context.user.id }
          }
        },
      });
      await createAuditLog({
        entityType: EntityType.VIN_PASSPORT,
        entityId: vinPassport.id,
        action: "CREATE",
        actorId: context.user?.id,
      });
      const user = await prisma.user.findUnique({ where: { id: context.user.id } });
      if (!user) throw new GraphQLError("User not found");
      await pubsub.publish("VINPASSPORT_NOTIFICATION", {
        userCreated: {
          message: `VinPassport for ${user.name} has been created!`,
          user,
        },
      });
      return vinPassport;
    },

    updateVinPassport: async (_: any, { input }: { input: { id: string; vin?: string } }, context: any) => {
      requireAuth(context);
      const { id, vin } = input;

      const vinPassport = await prisma.vinPassport.findUnique({ where: { id } });
      if (!vinPassport || vinPassport.isDeleted) throw new GraphQLError("VinPassport not found");

      const updatedVinPassport = await prisma.vinPassport.update({
        where: { id },
        data: { vin, updatedAt: new Date() },
      });
      await createAuditLog({
        entityType: EntityType.VIN_PASSPORT,
        entityId: vinPassport.id,
        action: "UPDATE",
        actorId: context.user?.id,
      });
      const user = await prisma.user.findUnique({ where: { id: context.user.id } });
      if (!user) throw new GraphQLError("User not found");
      await pubsub.publish("VINPASSPORT_NOTIFICATION", {
        userCreated: {
          message: `VinPassport for ${user.name} has been updated!`,
          user,
        },
      });
      return updatedVinPassport;
    },

    deleteVinPassport: async (_: any, { id }: { id: string }, context: any) => {
      requireAuth(context);
      const vinPassport = await prisma.vinPassport.findUnique({ where: { id } });
      if (!vinPassport || vinPassport.isDeleted) throw new GraphQLError("VinPassport not found");

      await prisma.vinPassport.update({
        where: { id },
        data: { isDeleted: true, updatedAt: new Date() },
      });

      await createAuditLog({
        entityType: EntityType.VIN_PASSPORT,
        entityId: vinPassport.id,
        action: "DELETE",
        actorId: context.user?.id,
      });
      const user = await prisma.user.findUnique({ where: { id: context.user.id } });
      if (!user) throw new GraphQLError("User not found");
      await pubsub.publish("VINPASSPORT_NOTIFICATION", {
        userCreated: {
          message: `VinPassport for ${user.name} has been deleted!`,
          user,
        },
      });

      return true;
    },

    submitVinListing: async (_: any, { input }: any, context: any) => {
      const userId = context.user?.id;
      if (!userId) throw new GraphQLError("Unauthorized");

      const { vin, documents } = input || {};
      if (!vin || typeof vin !== "string") {
        throw new GraphQLError("vin is required");
      }
      if (!Array.isArray(documents)) {
        throw new GraphQLError("documents must be an array");
      }

      const existing = await prisma.vinPassport.findUnique({ where: { vin } });
      if (existing) {
        throw new GraphQLError("VIN already exists");
      }

      const vinPassport = await prisma.vinPassport.create({
        data: {
          vin,
          ownerId: userId,
          status: VinStatus.PENDING,
        },
      });

      const docExtract = {
        ownershipStatus: null as string | null,
        registrationNo: null as string | null,
        insuranceProvider: null as string | null,
        policyNumber: null as string | null,
        invoiceDate: null as string | null,
        vendorName: null as string | null,
        serviceType: null as string | null,
        oilChangeRecord: null as boolean | null,
        invoiceMileage: null as number | null,
        maintenanceHistory: [] as Array<{
          date: string | null;
          vendor: string | null;
          serviceType: string | null;
          mileage: number | null;
          oilChange: boolean | null;
        }>,
      };

      for (const doc of documents) {
        if (!doc?.fileUrl) continue;

        const docType = mapTitleToDocType(doc.title || "");
        const hashInput = `${vin}|${doc.fileUrl}|${doc.fileName || ""}|${doc.fileType || ""}|${doc.title || ""}`;
        const hash = makeHash(hashInput);

        await prisma.document.create({
          data: {
            vinPassportId: vinPassport.id,
            uploadedById: userId,
            type: docType,
            s3Url: doc.fileUrl,
            hash,
            fileFingerprint:
              docType === DocumentType.MAINTENANCE_HISTORY ||
              docType === DocumentType.SERVICE_INVOICE
                ? hash
                : null,
          },
        });

        if (
          docType === DocumentType.MAINTENANCE_HISTORY ||
          docType === DocumentType.SERVICE_INVOICE
        ) {
          const extracted = await extractGeminiFields(
            doc.fileUrl,
            doc.fileType || "application/pdf"
          );
          if (extracted) {
            docExtract.registrationNo ??= extracted.registrationNo;
            docExtract.policyNumber ??= extracted.policyNumber;
            docExtract.invoiceDate ??= extracted.invoiceDate;
            docExtract.vendorName ??= extracted.vendorName;
            docExtract.serviceType ??= extracted.serviceType;
            docExtract.oilChangeRecord ??= extracted.oilChangeRecord;
            docExtract.invoiceMileage ??= extracted.invoiceMileage;

            if (
              extracted.invoiceDate ||
              extracted.vendorName ||
              extracted.serviceType ||
              extracted.invoiceMileage ||
              extracted.oilChangeRecord !== null
            ) {
              docExtract.maintenanceHistory.push({
                date: extracted.invoiceDate,
                vendor: extracted.vendorName,
                serviceType: extracted.serviceType,
                mileage: extracted.invoiceMileage,
                oilChange: extracted.oilChangeRecord,
              });
            }
          }
        }
      }

      const vinPublicData = await decodeVinPublicData(vin);

      return {
        vinPublicData,
        docExtract,
        conditionMatrix: {
          greenLight: true,
          collisionStatus: "GREEN",
          riskColor: "GREEN",
          notes: "Pending automated analysis.",
        },
        conditionEvents: [],
        fraudChecks: {
          duplicateInvoice: false,
          mileageRollback: false,
          vendorVerification: true,
        },
        listingStatus: { status: "PENDING" },
      };
    },
  },
  Subscription: {
    vinPassportNotification: {
      subscribe: () => getAsyncIterator(["VINPASSPORT_NOTIFICATION"]),
    },
  },
};
