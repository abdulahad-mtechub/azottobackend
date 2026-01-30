import { Queue, Worker } from "bullmq";
const { QueueScheduler } = require("bullmq"); // CJS-compatible import
import IORedis from "ioredis";

// Redis disabled when REDIS_DISABLED=true or Redis not configured (e.g. local dev without Redis)
const redisDisabled =
  process.env.REDIS_DISABLED === "true" || process.env.SKIP_REDIS === "true";

// Redis connection (shared); null when Redis is disabled
export const connection: IORedis | null = redisDisabled
  ? null
  : new IORedis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
    });

export const isRedisAvailable = (): boolean => connection !== null;

// Create a queue (returns null when Redis is disabled)
export const createQueue = (name: string) =>
  connection ? new Queue(name, { connection }) : null;

// Create a scheduler for delayed / repeatable jobs
export const createScheduler = (name: string) =>
  connection ? new QueueScheduler(name, { connection }) : null;

// Create a worker (returns null when Redis is disabled)
export const createWorker = (
  name: string,
  processor: (job: any) => Promise<any>,
  opts: { concurrency?: number } = {}
) =>
  connection
    ? new Worker(
        name,
        async (job) => processor(job),
        { connection, concurrency: opts.concurrency || 1 }
      )
    : null;
