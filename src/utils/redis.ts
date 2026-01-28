import { Queue, Worker } from "bullmq";
const { QueueScheduler } = require("bullmq"); // CJS-compatible import
import IORedis from "ioredis";

// Redis connection (shared)
export const connection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
});

// Create a queue
export const createQueue = (name: string) => new Queue(name, { connection });

// Create a scheduler for delayed / repeatable jobs
export const createScheduler = (name: string) => new QueueScheduler(name, { connection });

// Create a worker
export const createWorker = (
  name: string,
  processor: (job: any) => Promise<any>,
  opts: { concurrency?: number } = {}
) =>
  new Worker(
    name,
    async (job) => {
      return processor(job);
    },
    { connection, concurrency: opts.concurrency || 1 }
  );
