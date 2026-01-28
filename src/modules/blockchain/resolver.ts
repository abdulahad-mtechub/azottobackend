import { GraphQLError } from "graphql";
import { prisma } from "../../prisma/client";
import { createAuditLog } from "../../utils/auditLogger"
import { getAsyncIterator,pubsub } from "../../utils/pubsub";

export const blockchainResolvers = {
  Query: {
    getBlockchainTransactions: async (_: any, { userId, entityId }: any) => {
      const where: any = {};
      if (userId) where.userId = userId;
      if (entityId) where.entityId = entityId;

      return prisma.blockchainTransaction.findMany({
        where,
        include: { user: true },
      });
    },

    getOnChainProofs: async (_: any, { entityType, entityId }: any) => {
      const where: any = {};
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;

      return prisma.onChainProof.findMany({
        where,
        include: { invoice: true, vinPassport: true },
      });
    },
  },

  Mutation: {
    createBlockchainTransaction: async (_: any, { input }: {input:any},context:any) => {
      const tx = await prisma.blockchainTransaction.create({ data: input });

      await createAuditLog({
        entityType: "BLOCKCHAIN_TX",
        entityId: tx.id,
        action: "CREATE",
        newValue: tx,
        userId: context.user?.id,
        chainTxId: tx.id,
      });
    
      await pubsub.publish("BLOCKCHAIN_NOTIFICATION", { blockchainNotification: {
        message: `New transaction created: ${tx.txHash}`,
        transaction: tx,
      } });

      return tx;

    },

    updateBlockchainTransaction: async (_: any, { input }: {input:any},context:any) => {
      const { id, status, confirmations } = input;
      const existing = await prisma.blockchainTransaction.findUnique({ where: { id } });
      if (!existing) throw new GraphQLError("BlockchainTransaction not found");

      const updatedTx = await prisma.blockchainTransaction.update({
        where: { id },
        data: {
          status: status ?? existing.status,
          confirmations: confirmations ?? existing.confirmations,
        },
      });

      await createAuditLog({
        entityType: "BLOCKCHAIN_TX",
        entityId: id,
        action: "UPDATE",
        oldValue: existing,
        newValue: updatedTx,
        userId: context.user?.id,
        chainTxId: updatedTx.id,
      });
    
      await pubsub.publish("BLOCKCHAIN_NOTIFICATION", { blockchainNotification: {
        message: `Transaction ${updatedTx.txHash} status updated to ${updatedTx.status}`,
        transaction: updatedTx,
      } });

      return updatedTx;
    },

    createOnChainProof: async (_: any, { input }: {input:any},context:any) => {
      const proof = await prisma.onChainProof.create({ data: input });
      await createAuditLog({
        entityType: "ONCHAIN_PROOF",
        entityId: proof.id,
        action: "CREATE",
        newValue: proof,
        userId: context.user?.id,
      });

      await pubsub.publish("BLOCKCHAIN_PROOF_NOTIFICATION", { blockchainproofNotification: {
        message: `New on-chain proof created: ${proof.id}`,
        proof: proof,
      } });
      return proof;
    },

    updateOnChainProof: async (_: any, { input }: {input:any},context:any) => {
      const { id, hash, algorithm } = input;
      const existing = await prisma.onChainProof.findUnique({ where: { id } });
      if (!existing) throw new GraphQLError("OnChainProof not found");

      const updatedProof = await prisma.onChainProof.update({
        where: { id },
        data: {
          hash: hash ?? existing.hash,
          algorithm: algorithm ?? existing.algorithm,
        },
      });

      await createAuditLog({
        entityType: "ONCHAIN_PROOF",
        entityId: id,
        action: "UPDATE",
        oldValue: existing,
        newValue: updatedProof,
        userId: context.user?.id,
      });

      await pubsub.publish("BLOCKCHAIN_PROOF_NOTIFICATION", { blockchainproofNotification: {
        message: `On-chain proof ${updatedProof.id} updated`,
        proof: updatedProof,
      } });

      return updatedProof;
    },
  },
  Subscription: {
    blockchainNotification: {
      subscribe: () => getAsyncIterator("BLOCKCHAIN_NOTIFICATION"),
    },
    blockchainproofNotification: {
      subscribe: () => getAsyncIterator("BLOCKCHAIN_PROOF_NOTIFICATION"),
    }
  },
};

