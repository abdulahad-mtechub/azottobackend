import { createQueue } from "../utils/redis";

export const midnightScraperQueue = createQueue("midnight-scraper");
export const conditionMatrixQueue = createQueue("condition-matrix");
export const vestingQueue = createQueue("vesting-update");
