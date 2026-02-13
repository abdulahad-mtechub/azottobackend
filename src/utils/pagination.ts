export const MAX_PAGE_SIZE = 100;

export function capLimit(limit: number | null | undefined, defaultLimit: number): number {
  const value = limit ?? defaultLimit;
  if (typeof value !== "number" || value < 1) return defaultLimit;
  return Math.min(value, MAX_PAGE_SIZE);
}
