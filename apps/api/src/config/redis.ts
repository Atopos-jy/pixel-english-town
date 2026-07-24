import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import type { ApiEnv } from './env.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export function createRedisClient(env: ApiEnv): Redis {
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, enableReadyCheck: true });
  redis.on('error', (error: Error) => console.error('[redis] 连接错误', error.message));
  return redis;
}

export function registerRedis(app: FastifyInstance, redis: Redis): void {
  app.decorate('redis', redis);
  app.addHook('onClose', async () => {
    await redis.quit();
  });
}
