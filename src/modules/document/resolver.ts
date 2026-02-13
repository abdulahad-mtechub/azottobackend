import { GraphQLError } from "graphql";
import { prisma } from "../../prisma/client";
import { createAuditLog } from "../../utils/auditLogger"
import { getAsyncIterator,pubsub } from "../../utils/pubsub";
import { requireAuth } from "../../utils/authMiddleware";
import { capLimit } from "../../utils/pagination";

export const documentResolvers = {
  Query: {
    getDocuments: async (_: any, { limit, offset }: any, context: any) => {
      requireAuth(context);
      const take = capLimit(limit, 100);
      return prisma.document.findMany({
        skip: Math.max(0, offset ?? 0),
        take,
        where: { isDeleted: false },
      });
    },
    getDocument: async (_: any, { id }: any, context: any) => {
      requireAuth(context);
      const doc = await prisma.document.findUnique({ where: { id } });
      if (!doc) throw new GraphQLError("Document not found");
      return doc;
    },
  },
  Mutation: {
    createDocument: async (_: any, { input }: any, context: any) => {
      requireAuth(context);
      const document = await prisma.document.create({ data: input });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          entityType: "DOCUMENT",
          entityId: document.id,
          action: "CREATE",
          actorId: context.user?.id,
        },
      });

      // PubSub notification
      pubsub.publish("DOCUMENT_NOTIFICATION", {
        documentNotification: { message: "Document created", document },
      });

      return document;
    },

    updateDocument: async (_: any, { input }: any, context: any) => {
      requireAuth(context);
      const existing = await prisma.document.findUnique({ where: { id: input.id } });
      if (!existing) throw new GraphQLError("Document not found");

      const updated = await prisma.document.update({
        where: { id: input.id },
        data: {
          // Replace 'state' with a valid property of your Document model, for example:
          // title: input.title ?? existing.title,
        },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          entityType: "DOCUMENT",
          entityId: updated.id,
          action: "UPDATE",
          actorId: context.user?.id,
        },
      });

      // PubSub notification
      pubsub.publish("DOCUMENT_NOTIFICATION", {
        documentNotification: { message: "Document updated", document: updated },
      });

      return updated;
    },

    deleteDocument: async (_: any, { id }: any, context: any) => {
      requireAuth(context);
      const existing = await prisma.document.findUnique({ where: { id } });
      if (!existing) throw new GraphQLError("Document not found");

      await prisma.document.update({
        where: { id },
        data: { isDeleted: true},
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          entityType: "DOCUMENT",
          entityId: id,
          action: "DELETE",
          actorId: context.user?.id,
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

