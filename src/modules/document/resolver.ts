import { GraphQLError } from "graphql";
import { prisma } from "../../prisma/client";
import { createAuditLog } from "../../utils/auditLogger"
import { getAsyncIterator,pubsub } from "../../utils/pubsub";

export const documentResolvers = {
  Query: {
    getDocuments: async (_: any, { limit, offset }: any) => {
      return prisma.document.findMany({
        skip: offset ?? 0,
        take: limit ?? 100,
        where: { isDeleted: false },
      });
    },
    getDocument: async (_: any, { id }: any) => {
      const doc = await prisma.document.findUnique({ where: { id } });
      if (!doc) throw new GraphQLError("Document not found");
      return doc;
    },
  },
  Mutation: {
    createDocument: async (_: any, { input }: any, context: any) => {
      const document = await prisma.document.create({ data: input });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          entityType: "DOCUMENT",
          entityId: document.id,
          action: "CREATE",
          newValue: document,
          userId: context.user?.id,
        },
      });

      // PubSub notification
      pubsub.publish("DOCUMENT_NOTIFICATION", {
        documentNotification: { message: "Document created", document },
      });

      return document;
    },

    updateDocument: async (_: any, { input }: any, context: any) => {
      const existing = await prisma.document.findUnique({ where: { id: input.id } });
      if (!existing) throw new GraphQLError("Document not found");

      const updated = await prisma.document.update({
        where: { id: input.id },
        data: {
          state: input.state ?? existing.state,
        },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          entityType: "DOCUMENT",
          entityId: updated.id,
          action: "UPDATE",
          oldValue: existing,
          newValue: updated,
          userId: context.user?.id,
        },
      });

      // PubSub notification
      pubsub.publish("DOCUMENT_NOTIFICATION", {
        documentNotification: { message: "Document updated", document: updated },
      });

      return updated;
    },

    deleteDocument: async (_: any, { id }: any, context: any) => {
      const existing = await prisma.document.findUnique({ where: { id } });
      if (!existing) throw new GraphQLError("Document not found");

      await prisma.document.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date(), deletedBy: context.user?.id },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          entityType: "DOCUMENT",
          entityId: id,
          action: "DELETE",
          oldValue: existing,
          userId: context.user?.id,
        },
      });

      pubsub.publish("DOCUMENT_NOTIFICATION", {
        documentNotification: { message: "Document deleted", document: existing },
      });

      return true;
    },
  },
  Subscription: {
    documentNotification: {
      subscribe: () => getAsyncIterator(["DOCUMENT_NOTIFICATION"]),
    },
  },
};

