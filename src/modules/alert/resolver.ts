import { GraphQLError } from "graphql";
import { AlertModel } from "./alert";
import { AlertFilters, CreateAlertInput } from "./type";
import { getAsyncIterator, pubsub } from "../../utils/pubsub";
import prisma from "../../prisma/client";
import { requireAuth } from "../../utils/authMiddleware";

export const alertResolvers = {
  Query: {
    getAlerts: async (
      _: any,
      {
        limit,
        offset,
        filters,
      }: {
        limit: number;
        offset: number;
        filters?: AlertFilters;
      },
      context: any
    ) => {
      requireAuth(context);
      const where: any = {};

      if (filters?.businessId) {
        where.businessId = filters.businessId;
      }

      if (filters?.userId) {
        where.userId = filters.userId;
      }

      if (filters?.roles && filters.roles.length > 0) {
        where.userRole = {
          in: filters.roles,
        };
      }

      if (filters?.search) {
        where.userName = {
          contains: filters.search,
          mode: "insensitive", // optional but recommended
        };
      }

      if (filters?.action) {
        where.action = filters.action;
      }

      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters?.startDate) {
          where.createdAt.gte = new Date(filters.startDate);
        }
        if (filters?.endDate) {
          where.createdAt.lte = new Date(filters.endDate);
        }
      }
      if (filters?.businessId) {
        where.businessId = filters?.businessId;
      }
      if (context.user.role !== "ADMIN") {
        where.userId = context.user.id;
      } else if (filters?.userId) {
        where.userId = filters.userId;
      }
      const take = capLimit(limit, 50);
      const [alerts, totalCount, unreadCount] = await Promise.all([
        AlertModel.findMany({
          where,
          skip: Math.max(0, offset ?? 0),
          take,
          orderBy: { createdAt: "desc" },
        }),
        AlertModel.count({ where }),
        AlertModel.count({ where: { ...where, isRead: false } }),
      ]);

      return { alerts, totalCount, unreadCount };
    },
    getAlert: async (_: any, { id }: { id: string }, context: any) => {
      requireAuth(context);
      const alert = await AlertModel.findFirst({
        where: { id },
      });

      if (!alert) {
        throw new GraphQLError("Alert not found");
      }
      if (alert.userId && context.user.id !== alert.userId && context.user.role !== "ADMIN") {
        throw new GraphQLError("Forbidden: access denied");
      }

      return alert;
    },
    getUserAlerts: async (_: any, { userId, limit, offset }: { userId: string, limit: number, offset: number }, context: any) => {
      requireSelfOrAdmin(context, userId);
      const take = capLimit(limit, 50);
      const [alerts, totalCount, unreadCount] = await Promise.all([
        AlertModel.findMany({
          where: { userId },
          skip: Math.max(0, offset ?? 0),
          take,
          orderBy: { createdAt: "desc" },
        }),
        AlertModel.count({ where: { userId } }),
        AlertModel.count({ where: { isRead: false } }),
      ]);
      return { alerts, totalCount, unreadCount };
    },
    getUnreadAlertsCount: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const count = await AlertModel.count({
        where: { isRead: false, userId: context.user.id },
      });
      return count;
    },
    getUserUnreadAlertsCount: async (_: any, { userId }: { userId: string }, context: any) => {
      requireSelfOrAdmin(context, userId);
      const count = await AlertModel.count({
        where: { isRead: false, userId },
      });
      return count;
    }
  },

  Mutation: {
    createAlert: async (_: any, { input }: { input: CreateAlertInput }, context: any) => {
      requireAuth(context);
      const { userName, userRole, action, activity, userId, businessId } = input;

      if (!userName || !userRole || !action || !activity) {
        throw new GraphQLError("All required fields must be provided");
      }

      const alert = await prisma.alert.create({
        data: {
          userName,
          userRole: userRole as any,
          action: action as any,
          activity,
          userId,
          businessId
        },
      });

      // Publish to subscription
      await pubsub.publish("ALERT_CREATED", {
        alertCreated: {
          message: `New alert: ${activity}`,
          alert,
        },
      });

      return alert;
    },

    markAlertAsRead: async (_: any, { id }: { id: string }, context: any) => {
      requireAuth(context);
      const existingAlert = await AlertModel.findUnique({
        where: { id },
      });

      if (!existingAlert) {
        throw new GraphQLError("Alert not found");
      }
      if (existingAlert.userId && context.user.id !== existingAlert.userId && context.user.role !== "ADMIN") {
        throw new GraphQLError("Forbidden: access denied");
      }

      const alert = await prisma.alert.update({
        where: { id },
        data: { isRead: true },
      });

      return alert;
    },

    markAllAlertsAsRead: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const result = await prisma.alert.updateMany({
        where: { isRead: false, userId: context.user.id },
        data: { isRead: true },
      });

      return result.count;
    },

    deleteAlert: async (_: any, { id }: { id: string }, context: any) => {
      requireAuth(context);
      const existingAlert = await AlertModel.findUnique({
        where: { id },
      });

      if (!existingAlert) {
        throw new GraphQLError("Alert not found");
      }
      if (existingAlert.userId && context.user.id !== existingAlert.userId && context.user.role !== "ADMIN") {
        throw new GraphQLError("Forbidden: access denied");
      }

      const alert = await prisma.alert.delete({
        where: { id },
      });

      return alert;
    },
  },

  Subscription: {
    alertCreated: {
      subscribe: () => getAsyncIterator(["ALERT_CREATED"]),
      resolve: (payload: any) => payload.alertCreated,
    },
  },
};
