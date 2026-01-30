import { Queue } from "bullmq";
import { createQueue } from "../utils/redis";

export const midnightScraperQueue = createQueue("midnight-scraper");
export const invoiceOCRQueue = createQueue("invoice-ocr");
export const conditionMatrixQueue = createQueue("condition-matrix");
export const blockchainPollingQueue = createQueue("blockchain-polling");
export const vestingQueue = createQueue("vesting-update");
