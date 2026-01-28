import { GraphQLError } from "graphql";
import { AlertFilters, CreateAlertInput } from "./type";
import { getAsyncIterator, pubsub } from "../../utils/pubsub";
import prisma from "../../prisma/client";

export const aiResolvers = {
  Query: {
    getAIQuotas: async (_: any, { userId }: { userId?: string }) => {
      const where = userId ? { userId } : {};
      return prisma.aIQuota.findMany({
        where,
        include: { user: true },
      });
    },

    getAIDecisions: async (_: any, { userId, entityId }: { userId?: string; entityId?: string }) => {
      const where: any = {};
      if (userId) where.userId = userId;
      if (entityId) where.entityId = entityId;

      return prisma.aIDecision.findMany({
        where,
        include: { user: true },
      });
    },
  },

  Mutation: {
    createAIQuota: async (_: any, { input }: { input: any }) => {
      const { userId, periodStart, periodEnd } = input;
      return prisma.aIQuota.create({
        data: {
          userId,
          periodStart,
          periodEnd,
        },
      });
    },

    updateAIQuota: async (_: any, { input }: { input: any }) => {
      const { id, invoicesProcessed, rejectedCount } = input;
      const existing = await prisma.aIQuota.findUnique({ where: { id } });
      if (!existing) throw new GraphQLError("AIQuota not found");

      return prisma.aIQuota.update({
        where: { id },
        data: {
          invoicesProcessed: invoicesProcessed ?? existing.invoicesProcessed,
          rejectedCount: rejectedCount ?? existing.rejectedCount,
        },
      });
    },

    createAIDecision: async (_: any, { input }: { input: any }) => {
      return prisma.aIDecision.create({
        data: input,
      });
    },

    updateAIDecision: async (_: any, { input }: { input: any }) => {
      const { id, decision, confidence, metadata } = input;
      const existing = await prisma.aIDecision.findUnique({ where: { id } });
      if (!existing) throw new GraphQLError("AIDecision not found");

      return prisma.aIDecision.update({
        where: { id },
        data: {
          decision: decision ?? existing.decision,
          confidence: confidence ?? existing.confidence,
          metadata: metadata ?? existing.metadata,
        },
      });
    },
  },
};
