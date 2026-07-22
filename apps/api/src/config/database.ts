import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { ApiEnv } from './env.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    env: ApiEnv;
  }
}

export function createPrismaClient(env: ApiEnv): PrismaClient {
  return new PrismaClient({ datasourceUrl: env.DATABASE_URL });
}

export function registerDatabase(app: FastifyInstance, prisma: PrismaClient): void {
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}
