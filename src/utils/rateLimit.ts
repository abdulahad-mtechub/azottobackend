/**
 * In-memory rate limiter. Use for development/single-instance.
 * For production with multiple instances, use Redis-backed rate limiting.
 */
const store = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getKey(ip: string, prefix: string): string {
  return `${prefix}:${ip}`;
}

function cleanup(): void {
  const now = Date.now();
  for (const [key, v] of store.entries()) {
    if (v.resetAt < now) store.delete(key);
  }
}
setInterval(cleanup, 60 * 1000).unref();

export function rateLimit(options: {
  windowMs?: number;
  max: number;
  prefix: string;
}): (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => void {
  const { max, prefix, windowMs = WINDOW_MS } = options;

  return (req, res, next) => {
    const ip = (req.ip || req.socket?.remoteAddress || "unknown").toString();
    const key = getKey(ip, prefix);
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(key, entry);
    } else {
      entry.count++;
    }

    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({ error: "Too many requests" });
      return;
    }
    next();
  };
}
