import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const blockchainResolvers = {
  Query: {
    getBlockchainTransactions: async (_: any, { limit = 10, offset = 0, status }: any) => {
      const where = status ? { status } : {};
      return prisma.blockchainTransaction.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" }
      });
    },
    getBlockchainTransaction: async (_: any, { id }: any) => {
      return prisma.blockchainTransaction.findUnique({ where: { id } });
    },
  },

  Mutation: {
    createBlockchainTransaction: async (_: any, { input }: any) => {
      return prisma.blockchainTransaction.create({ data: input });
    },

    updateBlockchainTransactionStatus: async (_: any, { id, status }: any) => {
      return prisma.blockchainTransaction.update({
        where: { id },
        data: { status, updatedAt: new Date() }
      });
    },
  },
};
