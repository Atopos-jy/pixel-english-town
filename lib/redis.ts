import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

export const redis = redisUrl
  ? new Redis(redisUrl, { maxRetriesPerRequest: 1, enableReadyCheck: true })
  : new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });

redis.on('error', (error: Error) => {
  console.error('Redis connection error:', error.message);
});

export async function publishPlazaEvent(payload: object): Promise<number> {
  const version = await redis.incr('plaza:version');
  await redis.publish('plaza:events', JSON.stringify({ ...payload, version }));
  return version;
}
