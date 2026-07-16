type RateLimitBucket = { count: number; startedAt: number };

const buckets = new Map<string, RateLimitBucket>();
const WINDOW_MS = 60_000;

export function takeAiRequestSlot(userKey: string, action: 'generate' | 'test') {
  const now = Date.now();
  const limit = action === 'generate' ? 3 : 6;
  const key = `${action}:${userKey}`;
  const current = buckets.get(key);

  if (!current || now - current.startedAt >= WINDOW_MS) {
    buckets.set(key, { count: 1, startedAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((WINDOW_MS - (now - current.startedAt)) / 1000) };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
