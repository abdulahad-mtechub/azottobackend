import { prisma } from "../prisma/client";
import { GraphQLError } from "graphql";

export const checkSystemState = async (operationName: string) => {
  const killSwitch = await prisma.systemState.findUnique({ where: { key: "KILL_SWITCH" } });
  if (killSwitch?.value === "ON") {
    throw new GraphQLError(`Operation ${operationName} blocked: System is in KILL state`);
  }

  const pauseSystem = await prisma.systemState.findUnique({ where: { key: "PAUSE_SYSTEM" } });
  if (pauseSystem?.value === "ON" && ["createInvoice","updateVIN","mintVINNFT"].includes(operationName)) {
    throw new GraphQLError(`Operation ${operationName} blocked: System is PAUSED`);
  }
};
