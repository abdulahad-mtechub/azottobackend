import { GraphQLError } from "graphql";
import { AlertModel } from "./alert";
import { AlertFilters, CreateAlertInput } from "./type";
import { getAsyncIterator, pubsub } from "../../utils/pubsub";
import prisma from "../../prisma/client";

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
      }
    ) => {
      // Build where clause
      const where: any = {};

      if(filters?.businessId){
        where.businessId = filters.businessId;
      }

      if(filters?.userId){
        where.userId = filters.userId;
      }

      if (filters?.roles  && filters.roles.length > 0) {
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
      if(filters?.businessId){
        where.businessId = filters?.businessId;
      }
      const [alerts, totalCount, unreadCount] = await Promise.all([
        AlertModel.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        AlertModel.count({ where }),
        AlertModel.count({ where: { isRead: false } }),
      ]);

      return { alerts, totalCount, unreadCount };
    },
    getAlert: async (_: any, { id }: { id: string }) => {
      const alert = await AlertModel.findFirst({
        where: { id },
      });

      if (!alert) {
        throw new GraphQLError("Alert not found");
      }

      return alert;
    },
    getUserAlerts: async (_: any, { userId,limit,offset }: { userId: string,limit:number,offset:number }) => {
      const [alerts, totalCount, unreadCount] = await Promise.all([
        AlertModel.findMany({
          where: { userId },
          skip: offset,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        AlertModel.count({ where: { userId } }),
        AlertModel.count({ where: { isRead: false } }),
      ]);
      return {alerts, totalCount, unreadCount };
    },
    getUnreadAlertsCount: async () => {
      const count = await AlertModel.count({
        where: { isRead: false },
      });
      return count;
    },
    getUserUnreadAlertsCount: async (_: any, { userId }: { userId: string }) => {
      const count = await AlertModel.count({
        where: { isRead: false, userId },
      });
      return count;
    }
  },

  Mutation: {
    createAlert: async (_: any, { input }: { input: CreateAlertInput }) => {
      const { userName, userRole, action, activity, userId,businessId } = input;

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

    markAlertAsRead: async (_: any, { id }: { id: string }) => {
      const existingAlert = await AlertModel.findUnique({
        where: { id },
      });

      if (!existingAlert) {
        throw new GraphQLError("Alert not found");
      }

      const alert = await prisma.alert.update({
        where: { id },
        data: { isRead: true },
      });

      return alert;
    },

    markAllAlertsAsRead: async () => {
      const result = await prisma.alert.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      });

      return result.count;
    },

    deleteAlert: async (_: any, { id }: { id: string }) => {
      const existingAlert = await AlertModel.findUnique({
        where: { id },
      });

      if (!existingAlert) {
        throw new GraphQLError("Alert not found");
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
