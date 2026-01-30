import { GraphQLError } from "graphql";
import { prisma } from "../../prisma/client";
import { createAuditLog } from "../../utils/auditLogger"
import { getAsyncIterator,pubsub } from "../../utils/pubsub";
import { invoiceOCRQueue } from "../../jobs/queues";
import { checkSystemState } from "../../middlewares/checkSystemState";

export const invoiceResolvers = {
  Query: {
    getInvoices: async (_: any, { limit,offset,search }:{limit:number,offset:number,search:string}) => {
      return prisma.invoice.findMany({
        where: { isDeleted: false },
        take: limit,
        skip: offset,
        include: { parts: true },
      });
    },

    getInvoice: async (_: any, { id }: { id: string }) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: { parts: true },
      });
      if (!invoice || invoice.isDeleted) throw new GraphQLError("Invoice not found");
      return invoice;
    },
  },

  Mutation: {
    createInvoice: async (_: any, { input }: { input: { number: string; parts: { name: string; price: number }[] } },context:any) => {
      const { number, parts } = input;

      const user = await prisma.user.findUnique({ where: { id:context.user.id } });
      if (!user) throw new GraphQLError("User not found");
      await checkSystemState("createInvoice");
      const invoice = await prisma.invoice.create({
        data: {
          number,
          parts: { create: parts },
          status: "PENDING",
        },
        include: { parts: true },
      });
      if (invoiceOCRQueue) await invoiceOCRQueue.add("invoiceOCR", { invoiceId: invoice.id });
      await createAuditLog({
        entityType: "INVOICE",
        entityId: invoice.id,
        action: "CREATE",
        newValue: invoice,
        userId: context.user?.id,
      });
      await pubsub.publish("INVOICE_NOTIFICATION", {
        userCreated: {
          message: `Invoice for ${user.name} has been created!`,
          user,
        },
      });
      return invoice;
    },

    updateInvoice: async (_: any, { input }: { input: { id: string; number?: string } },context:any) => {
      const { id, number } = input;
      const user = await prisma.user.findUnique({ where: { id:context.user.id } });
      if (!user) throw new GraphQLError("User not found");
      const invoice = await prisma.invoice.findUnique({ where: { id } });
      if (!invoice || invoice.isDeleted) throw new GraphQLError("Invoice not found");

      const updatedInvoice =  prisma.invoice.update({
        where: { id },
        data: { number, updatedAt: new Date() },
        include: { parts: true },
      });

      await createAuditLog({
        entityType: "INVOICE",
        entityId: invoice.id,
        action: "UPDATE",
        oldValue: invoice,
        newValue: updatedInvoice,
        userId: context.user?.id,
      });
      await pubsub.publish("INVOICE_NOTIFICATION", {
        userCreated: {
          message: `Invoice for ${user.name} has been updated!`,
          user,
        },
      });
      return updatedInvoice;
    },

    deleteInvoice: async (_: any, { id }: { id: string },context:any) => {
      const invoice = await prisma.invoice.findUnique({ where: { id } });
      if (!invoice || invoice.isDeleted) throw new GraphQLError("Invoice not found");
      const user = await prisma.user.findUnique({ where: { id:context.user.id } });
      if (!user) throw new GraphQLError("User not found");
      await prisma.invoice.update({
        where: { id },
        data: { isDeleted: true, updatedAt: new Date() },
      });

      // soft-delete parts as well
      const deletedInvoice = await prisma.normalizedPart.updateMany({
        where: { invoiceId: id },
        data: { isDeleted: true, updatedAt: new Date() },
      });

      await createAuditLog({
        entityType: "INVOICE",
        entityId: invoice.id,
        action: "DELETE",
        oldValue: deletedInvoice,
        userId: context.user?.id,
      });
      await pubsub.publish("INVOICE_NOTIFICATION", {
        userCreated: {
          message: `Invoice for ${user.name} has been deleted!`,
          user,
        },
      });
      return true;
    },

    createPart: async (_: any, { invoiceId, input }: { invoiceId: string; input: { name: string; price: number } },context:any) => {
      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice || invoice.isDeleted) throw new GraphQLError("Invoice not found");
      const user = await prisma.user.findUnique({ where: { id:context.user.id } });
      if (!user) throw new GraphQLError("User not found");
      const part = await prisma.normalizedPart.create({
        data: { ...input, invoiceId },
      });
      await createAuditLog({
        entityType: "PART",
        entityId: part.id,
        action: "CREATE",
        newValue: part,
        userId: context.user?.id,
      });
      await pubsub.publish("PART_NOTIFICATION", {
        userCreated: {
          message: `Part for ${user.name} has been created!`,
          user,
        },
      });
      return part;
    },

    updatePart: async (_: any, { input }: { input: { id: string; name?: string; price?: number } },context:any) => {
      const { id, name, price } = input;
      const part = await prisma.normalizedPart.findUnique({ where: { id } });
      if (!part || part.isDeleted) throw new GraphQLError("Part not found");
      const user = await prisma.user.findUnique({ where: { id:context.user.id } });
      if (!user) throw new GraphQLError("User not found");
      const updatedPort = prisma.normalizedPart.update({
        where: { id },
        data: { name, price, updatedAt: new Date() },
      });

      await createAuditLog({
        entityType: "PART",
        entityId: part.id,
        action: "UPDATE",
        oldValue: part,
        newValue: updatedPort,
        userId: context.user?.id,
      });

      await pubsub.publish("PART_NOTIFICATION", {
        userCreated: {
          message: `Part for ${user.name} has been updated!`,
          user,
        },
      });

      return updatedPort;
    },

    deletePart: async (_: any, { id }: { id: string },context:any) => {
      const part = await prisma.normalizedPart.findUnique({ where: { id } });
      if (!part || part.isDeleted) throw new GraphQLError("Part not found");
      const user = await prisma.user.findUnique({ where: { id:context.user.id } });
      if (!user) throw new GraphQLError("User not found");
      const deletedPard = await prisma.normalizedPart.update({
        where: { id },
        data: { isDeleted: true, updatedAt: new Date() },
      });

      await createAuditLog({
        entityType: "PART",
        entityId: deletedPard.id,
        action: "DELETE",
        oldValue: deletedPard,
        userId: context.user?.id,
      });

      await pubsub.publish("PART_NOTIFICATION", {
        userCreated: {
          message: `Part for ${user.name} has been deleted!`,
          user,
        },
      });

      return true;
    },
  },
   Subscription: {
    partNotification: {
      subscribe: () => getAsyncIterator(["PART_NOTIFICATION"]),
    },
    invoiceNotification: {
      subscribe: () => getAsyncIterator(["INVOICE_NOTIFICATION"]),
    },
  },
};
