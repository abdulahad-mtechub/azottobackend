import { GraphQLError } from "graphql";
import { prisma } from "../../prisma/client";
import { AuditLogFilter } from "./type";
import { AuditAction, EntityType } from "@prisma/client";

export const auditLogResolvers = {
  Query: {
    getAuditLogs: async (_: any, { limit, offset, filter }: {limit:number,offset:number,filter:AuditLogFilter}) => {
      const where: any = { isDeleted: false };

      if (filter) {
        if (filter.entityName) where.entityName = filter.entityName;
        if (filter.performedBy) where.performedBy = filter.performedBy;
        if (filter.action) where.action = filter.action;
        if (filter.startDate || filter.endDate) {
          where.createdAt = {};
          if (filter.startDate) where.createdAt.gte = new Date(filter.startDate);
          if (filter.endDate) where.createdAt.lte = new Date(filter.endDate);
        }
      }

      return prisma.auditLog.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
      });
    },

    getAuditLog: async (_: any, { id }: { id: string }) => {
      const log = await prisma.auditLog.findUnique({ where: { id } });
      if (!log || log.isDeleted) throw new GraphQLError("AuditLog not found");
      return log;
    },
  },

  Mutation: {
    createAuditLog: async (_: any,{ input,}: {
          input: {
            action: AuditAction;
            entityType: EntityType;
            entityId: string;
            oldValue?: any;
            newValue?: any;
            userId?: string;
            vinPassportId?: string;
          };
        }
      ) => {
        const log = await prisma.auditLog.create({
          data: {
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId,
            oldValue: input.oldValue,
            newValue: input.newValue,
            userId: input.userId,
            vinPassportId: input.vinPassportId,
          },
          include: { user: true, vinPassport: true },
        });
  
        return log;
      },
  },
};
