import { ApiCode, type ApiResponse } from '@pixel-english-town/contracts';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import Fastify, { type FastifyInstance } from 'fastify';
import { createPrismaClient, registerDatabase } from './config/database.js';
import type { ApiEnv } from './config/env.js';
import { createRedisClient, registerRedis } from './config/redis.js';
import { registerAuthMiddleware } from './middleware/auth.js';
import { registerErrorHandler } from './middleware/error.js';
import { registerAuthRoutes } from './modules/auth/routes.js';
import { registerArticleRoutes } from './modules/articles/routes.js';
import { registerLearningRoutes } from './modules/learning/routes.js';
import { registerQuestionRoutes } from './modules/questions/routes.js';
import { registerQuizRoutes } from './modules/quiz/routes.js';
import { registerPlazaRoutes } from './modules/plaza/routes.js';
import { registerAdminRoutes } from './modules/admin/routes.js';
import { response } from './utils/response.js';

interface HealthData {
  service: 'api';
  status: 'ok';
}

export async function buildApp(env: ApiEnv): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  const prisma = createPrismaClient(env);
  const redis = createRedisClient(env);
  registerDatabase(app, prisma);
  registerRedis(app, redis);
  app.decorate('env', env);
  registerAuthMiddleware(app);

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
  await app.register((instance, _options, done) => {
    void registerArticleRoutes(instance).then(() => done(), done);
  });
  await app.register((instance, _options, done) => {
    void registerLearningRoutes(instance).then(() => done(), done);
  });
  await app.register((instance, _options, done) => {
    void registerQuestionRoutes(instance).then(() => done(), done);
  });
  await app.register((instance, _options, done) => {
    void registerQuizRoutes(instance).then(() => done(), done);
  });
  await app.register((instance, _options, done) => {
    void registerPlazaRoutes(instance).then(() => done(), done);
  });
  await app.register((instance, _options, done) => {
    void registerAdminRoutes(instance).then(() => done(), done);
  });

  registerErrorHandler(app);

  app.get('/api/v1/health', async (): Promise<ApiResponse<HealthData>> => {
    return response(ApiCode.OK, 'Fastify API 服务正常', { service: 'api', status: 'ok' });
  });

  return app;
}
