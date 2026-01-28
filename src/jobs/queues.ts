import { Queue } from "bullmq";
import { connection } from "../utils/redis";

export const midnightScraperQueue = new Queue("midnight-scraper", { connection });
export const invoiceOCRQueue = new Queue("invoice-ocr", { connection });
export const conditionMatrixQueue = new Queue("condition-matrix", { connection });
export const blockchainPollingQueue = new Queue("blockchain-polling", { connection });
export const vestingQueue = new Queue("vesting-update", { connection });
