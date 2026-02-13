import { GraphQLError } from "graphql";
import { prisma } from "../../prisma/client";
import { AuditLogFilter } from "./type";
import { EntityType } from "@prisma/client";
import { requireAdmin, requireAuth } from "../../utils/authMiddleware";
import { capLimit } from "../../utils/pagination";

export const auditLogResolvers = {
  Query: {
    getAuditLogs: async (_: any, { limit, offset, filter }: { limit: number, offset: number, filter: AuditLogFilter }, context: any) => {
      requireAuth(context);
      const where: any = { isDeleted: false };

      if (filter) {
        if (filter.entityName) where.entityType = filter.entityName;
        if (filter.performedBy) where.userId = filter.performedBy;
        if (filter.action) where.action = filter.action;
        if (filter.startDate || filter.endDate) {
          where.createdAt = {};
          if (filter.startDate) where.createdAt.gte = new Date(filter.startDate);
          if (filter.endDate) where.createdAt.lte = new Date(filter.endDate);
        }
      }

      return prisma.auditLog.findMany({
        where,
        take: capLimit(limit, 50),
        skip: Math.max(0, offset ?? 0),
        orderBy: { createdAt: "desc" },
      });
    },

    getAuditLog: async (_: any, { id }: { id: string }, context: any) => {
      requireAuth(context);
      const log = await prisma.auditLog.findUnique({ where: { id } });
      if (!log || log.isDeleted) throw new GraphQLError("AuditLog not found");
      return log;
    },
  },

  Mutation: {
    createAuditLog: async (_: any, { input }: { input: { entityName: string; entityId: string; action: string; performedBy: string; performedByRole?: string; changes?: any } }, context: any) => {
      requireAdmin(context);
      const log = await prisma.auditLog.create({
        data: {
          action: input.action,
          entityType: (input.entityName as EntityType),
          entityId: input.entityId,
          actorId: input.performedBy,
        },
        include: { actor: true },
      });
      return log;
    },
  },
};
