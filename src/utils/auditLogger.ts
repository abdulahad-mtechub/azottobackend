import { EntityType } from "@prisma/client";
import { prisma } from "../prisma/client";

export async function createAuditLog({
  entityType,
  entityId,
  action,
  oldValue,
  newValue,
  userId,
  chainTxId,
}: {
  entityType: EntityType;
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  oldValue?: any;
  newValue?: any;
  userId?: string;
  chainTxId?: string;
}) {
  return prisma.auditLog.create({
    data: {
      entityType,
      entityId,
      action,
      oldValue,
      newValue,
      userId,
      chainTxId,
    },
  });
}
