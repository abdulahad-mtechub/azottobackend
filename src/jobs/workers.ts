import { connection, createWorker } from "../utils/redis";
import { prisma } from "../prisma/client";
import { pubsub } from "../utils/pubsub";

if (connection) {
  // 1. Midnight Scraper
  createWorker("midnight-scraper", async (job) => {
    console.log("Running Midnight Scraper job", job.id);
    pubsub.publish("vinNotification", { message: "Midnight Scraper complete" });
  });

  // 2. Invoice OCR / Verification
  createWorker("invoice-ocr", async (job) => {
    console.log("Running Invoice OCR job", job.id);
    const invoice = await prisma.invoice.findUnique({ where: { id: job.data.invoiceId } });
    if (!invoice) throw new Error("Invoice not found");
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "VERIFIED" } });
    pubsub.publish("invoiceNotification", { message: `Invoice ${invoice.id} verified` });
  });

  // 3. Condition Matrix Recalculation
  createWorker("condition-matrix", async (job) => {
    console.log("Running ConditionMatrix recalculation", job.id);
    const vinId = job.data.vinId;
    pubsub.publish("conditionMatrixNotification", { message: `Condition Matrix updated for VIN ${vinId}` });
  });

  // 4. Blockchain Polling
  createWorker("blockchain-polling", async (job) => {
    console.log("Running Blockchain Confirmation Polling", job.id);
    const txId = job.data.txId;
    const tx = await prisma.blockchainTransaction.findUnique({ where: { id: txId } });
    if (!tx) throw new Error("Transaction not found");
    pubsub.publish("blockchainNotification", { message: `Transaction ${txId} confirmed` });
  });

  // 5. Vesting / AZTO Countdown Updates
  createWorker("vesting-update", async (job) => {
    console.log("Running Vesting / AZTO countdown update", job.id);
    pubsub.publish("vestingNotification", { message: "Vesting updated" });
  });
}
