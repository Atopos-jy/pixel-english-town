import type { FastifyInstance } from 'fastify';
import { createRequireAuth } from '../../middleware/auth.js';
import { createAuthService } from '../auth/service.js';
import { createQuizController } from './controller.js';
import { createQuizService } from './service.js';

export async function registerQuizRoutes(app: FastifyInstance): Promise<void> {
  const service = createQuizService(app.prisma, app.env, app.redis);
  const controller = createQuizController(service);
  const requireAuth = createRequireAuth(createAuthService({ prisma: app.prisma }));

  app.post('/api/v1/quiz/generate', { preHandler: requireAuth }, controller.generate);
  app.get('/api/v1/quiz/generate/:jobId', { preHandler: requireAuth }, controller.getJob);
}
