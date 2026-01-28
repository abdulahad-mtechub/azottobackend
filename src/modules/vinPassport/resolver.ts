import { GraphQLError } from "graphql";
import { prisma } from "../../prisma/client";
import { createAuditLog } from "../../utils/auditLogger";
import { getAsyncIterator,pubsub } from "../../utils/pubsub";
import { EntityType } from "@prisma/client";

export const vinPassportResolvers = {
  Query: {
    getVinPassports: async (_: any, { limit, offset,search }:{limit:number, offset:number,search:string}) => {
      return prisma.vinPassport.findMany({
        where: { isDeleted: false },
        take: limit,
        skip: offset,
        include: { gasSettlements: true },
      });
    },

    getVinPassport: async (_: any, { id }: { id: string }) => {
      const vinPassport = await prisma.vinPassport.findUnique({
        where: { id },
        include: { gasSettlements: true },
      });
      if (!vinPassport || vinPassport.isDeleted) throw new GraphQLError("VinPassport not found");
      return vinPassport;
    },
  },

  Mutation: {
    createVinPassport: async (_: any, { input }: { input: { vin: string; gasSettlements?: { amount: number }[] } },context:any) => {
      const { vin, gasSettlements } = input;

      const vinPassport = await prisma.vinPassport.create({
        data: {
        vin,
          gasSettlements: gasSettlements ? { create: gasSettlements } : undefined,
        },
        include: { gasSettlements: true },
      });
      await createAuditLog({
        entityType: EntityType.VIN_PASSPORT,
        entityId: vinPassport.id,
        action: "CREATE",
        newValue: vinPassport,
        userId: context.user?.id,
      });
      const user = await prisma.user.findUnique({ where: { id:context.user.id } });
      if (!user) throw new GraphQLError("User not found");
      await pubsub.publish("VINPASSPORT_NOTIFICATION", {
        userCreated: {
          message: `VinPassport for ${user.name} has been created!`,
          user,
        },
      });
      return vinPassport;
    },

    updateVinPassport: async (_: any, { input }: { input: { id: string; vin?: string } },context:any) => {
      const { id, vin } = input;

      const vinPassport = await prisma.vinPassport.findUnique({ where: { id } });
      if (!vinPassport || vinPassport.isDeleted) throw new GraphQLError("VinPassport not found");

      const updatedVinPassport = prisma.vinPassport.update({
        where: { id },
        data: { vin, updatedAt: new Date() },
        include: { gasSettlements: true },
      });
      await createAuditLog({
        entityType: EntityType.VIN_PASSPORT,
        entityId: vinPassport.id,
        action: "UPDATE",
        oldValue: vinPassport,
        newValue: updatedVinPassport,
        userId: context.user?.id,
      });
      const user = await prisma.user.findUnique({ where: { id:context.user.id } });
      if (!user) throw new GraphQLError("User not found");
      await pubsub.publish("VINPASSPORT_NOTIFICATION", {
        userCreated: {
          message: `VinPassport for ${user.name} has been created!`,
          user,
        },
      });
      return updatedVinPassport;
    },

    deleteVinPassport: async (_: any, { id }: { id: string },context:any) => {
      const vinPassport = await prisma.vinPassport.findUnique({ where: { id } });
      if (!vinPassport || vinPassport.isDeleted) throw new GraphQLError("VinPassport not found");

      await prisma.vinPassport.update({
        where: { id },
        data: { isDeleted: true, updatedAt: new Date() },
      });

      // soft-delete related gas settlements
      await prisma.gasSettlement.updateMany({
        where: { vinPassportId: id },
        data: { isDeleted: true, updatedAt: new Date() },
      });

      await createAuditLog({
        entityType: EntityType.VIN_PASSPORT,
        entityId: vinPassport.id,
        action: "DELETE",
        newValue: vinPassport,
        userId: context.user?.id,
      });
      const user = await prisma.user.findUnique({ where: { id:context.user.id } });
      if (!user) throw new GraphQLError("User not found");
      await pubsub.publish("VINPASSPORT_NOTIFICATION", {
        userCreated: {
          message: `VinPassport for ${user.name} has been created!`,
          user,
        },
      });

      return true;
    },

    createGasSettlement: async (_: any, { vinPassportId, input }: { vinPassportId: string; input: { amount: number } },context:any) => {
      const vinPassport = await prisma.vinPassport.findUnique({ where: { id: vinPassportId } });
      if (!vinPassport || vinPassport.isDeleted) throw new GraphQLError("VinPassport not found");

      const gas = await prisma.gasSettlement.create({
        data: { vinPassportId, amount: input.amount },
      });
      if (!gas) throw new GraphQLError("Failed to create GasSettlement");

      await createAuditLog({
        entityType: EntityType.GAS_SETTLEMENT,
        entityId: gas.id,
        action: "CREATE",
        newValue: gas,
        userId: context.user?.id,
      });
      const user = await prisma.user.findUnique({ where: { id:context.user.id } });
      if (!user) throw new GraphQLError("User not found");
      await pubsub.publish("GASSETTLEMENT_NOTIFICATION", {
        userCreated: {
          message: `GasSettlement for ${user.name} has been created!`,
          user,
        },
      });

      return gas;
    },

    updateGasSettlement: async (_: any, { input }: { input: { id: string; amount?: number } },context:any) => {
      const { id, amount } = input;

      const settlement = await prisma.gasSettlement.findUnique({ where: { id } });
      if (!settlement || settlement.isDeleted) throw new GraphQLError("GasSettlement not found");

      const updateGas =  prisma.gasSettlement.update({
        where: { id },
        data: { amount, updatedAt: new Date() },
      });
      await createAuditLog({
        entityType: EntityType.GAS_SETTLEMENT,
        entityId: settlement.id,
        action: "UPDATE",
        oldValue: settlement,
        newValue: updateGas,
        userId: context.user?.id,
      });
      const user = await prisma.user.findUnique({ where: { id:context.user.id } });
      if (!user) throw new GraphQLError("User not found");
      await pubsub.publish("GASSETTLEMENT_NOTIFICATION", {
        userCreated: {
          message: `GasSettlement for ${user.name} has been updated!`,
          user,
        },
      });
    },

    deleteGasSettlement: async (_: any, { id }: { id: string },context:any) => {
      const settlement = await prisma.gasSettlement.findUnique({ where: { id } });
      if (!settlement || settlement.isDeleted) throw new GraphQLError("GasSettlement not found");

      await prisma.gasSettlement.update({
        where: { id },
        data: { isDeleted: true, updatedAt: new Date() },
      });
      await createAuditLog({
        entityType: EntityType.GAS_SETTLEMENT,
        entityId: settlement.id,
        action: "DELETE",
        newValue: settlement,
        userId: context.user?.id,
      });
      const user = await prisma.user.findUnique({ where: { id:context.user.id } });
      if (!user) throw new GraphQLError("User not found");
      await pubsub.publish("GASSETTLEMENT_NOTIFICATION", {
        userCreated: {
          message: `GasSettlement for ${user.name} has been deleted!`,
          user,
        },
      });
      return true;
    },
  },
  Subscription: {
    vinPassportNotification: {
      subscribe: () => getAsyncIterator(["VINPASSPORT_NOTIFICATION"]),
    },
    gasSettlementNotification: {
      subscribe: () => getAsyncIterator(["GASSETTLEMENT_NOTIFICATION"]),
    },
  },
};
