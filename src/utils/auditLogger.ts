import { EntityType } from "@prisma/client";
import { prisma } from "../prisma/client";

export async function createAuditLog({
  entityType,
  entityId,
  action,
  actorId,
}: {
  entityType: EntityType;
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  actorId?: string;
}) {
  return prisma.auditLog.create({
    data: {
      entityType,
      entityId,
      action,
      actorId,
    },
  });
}
