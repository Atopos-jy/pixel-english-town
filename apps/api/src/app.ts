import { ApiCode, type ApiResponse } from '@pixel-english-town/contracts';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import type { ApiEnv } from './config/env.js';
import { registerAuthRoutes } from './modules/auth/routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    env: ApiEnv;
  }
}

interface HealthData {
  service: 'api';
  status: 'ok';
}

function response<T>(code: number, message: string, data: T | null): ApiResponse<T> {
  return { code, data, message };
}

function getClientErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) {
    return null;
  }

  const { statusCode } = error;
  if (typeof statusCode !== 'number' || statusCode < 400 || statusCode >= 500) {
    return null;
  }

  return statusCode;
}

export async function buildApp(env: ApiEnv): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  app.decorate('prisma', prisma);
  app.decorate('env', env);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  await app.register(cookie);
  await app.register(jwt, { secret: env.JWT_SECRET, cookie: { cookieName: 'pixel-town.token', signed: false } });
  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });
  await app.register(helmet);
  await app.register((instance, _options, done) => {
    void registerAuthRoutes(instance).then(() => done(), done);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const statusCode = getClientErrorStatus(error) ?? 500;
    const code = statusCode === 500 ? ApiCode.INTERNAL_ERROR : ApiCode.VALIDATION_ERROR;
    const message = statusCode === 500 ? '服务器内部错误' : '请求参数错误';

    void reply.status(statusCode).send(response(code, message, null));
  });

  app.get('/api/v1/health', async (): Promise<ApiResponse<HealthData>> => {
    return response(ApiCode.OK, 'Fastify API 服务正常', { service: 'api', status: 'ok' });
  });

  return app;
}
