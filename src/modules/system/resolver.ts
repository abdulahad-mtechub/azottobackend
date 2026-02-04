import { GraphQLError } from "graphql";
import { prisma } from "../../prisma/client";
import { getAsyncIterator,pubsub } from "../../utils/pubsub";

export const systemResolvers = {
  Query: {
    getSystemStates: async () => {
      return prisma.systemState.findMany();
    },

    getConditionMatrices: async (_: any, { activeOnly }: { activeOnly?: boolean }) => {
      const where = activeOnly ? { isActive: true } : {};
      return prisma.conditionMatrix.findMany({ where });
    },
  },

  Mutation: {
    createConditionMatrix: async (_: any, { input }: any) => {
      return prisma.conditionMatrix.create({ data: input });
    },

    updateConditionMatrix: async (_: any, { input }: any) => {
      const { id, isActive } = input;
      const existing = await prisma.conditionMatrix.findUnique({ where: { id } });
      if (!existing) throw new GraphQLError("ConditionMatrix not found");

      return prisma.conditionMatrix.update({
        where: { id },
        data: { isActive: isActive ?? existing.isActive },
      });
    },
    setSystemState: async (_: any, { key, value }: any, context: any) => {
      if (!context.user || context.user.role !== "ADMIN") {
        throw new GraphQLError("Unauthorized");
      }

      const state = await prisma.systemState.upsert({
        where: { key },
        update: {
          value,
          updatedBy: context.user.id,
        },
        create: {
          key,
          value,
          updatedBy: context.user.id,
        },
      });

      // Notify subscribers
      pubsub.publish("systemStateNotification", { message: `${key} updated to ${value}` });

      return state;
    },
  },
  Subscription: {
    systemStateNotification: {
      subscribe: () => getAsyncIterator(["systemStateNotification"]),
    },
  },
};