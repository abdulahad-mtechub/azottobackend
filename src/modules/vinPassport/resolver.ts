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
      });
    },

    getVinPassport: async (_: any, { id }: { id: string }) => {
      const vinPassport = await prisma.vinPassport.findUnique({
        where: { id },
      });
      if (!vinPassport || vinPassport.isDeleted) throw new GraphQLError("VinPassport not found");
      return vinPassport;
    },
  },

  Mutation: {
    createVinPassport: async (_: any, { input }: { input: { vin: string } },context:any) => {
      const { vin } = input;

      const vinPassport = await prisma.vinPassport.create({
        data: {
        vin,
        },
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
  },
  Subscription: {
    vinPassportNotification: {
      subscribe: () => getAsyncIterator(["VINPASSPORT_NOTIFICATION"]),
    },
  },
};
