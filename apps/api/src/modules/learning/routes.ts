import type { FastifyInstance } from 'fastify';
import { createRequireAuth } from '../../middleware/auth.js';
import { createAuthService } from '../auth/service.js';
import { createLearningController } from './controller.js';
import { createLearningService } from './service.js';
export async function registerLearningRoutes(app: FastifyInstance): Promise<void> {
  const service = createLearningService({ prisma: app.prisma, redis: app.redis });
  const controller = createLearningController(service);
  const requireAuth = createRequireAuth(createAuthService({ prisma: app.prisma }));
  app.get('/api/v1/learning/progress', { preHandler: requireAuth }, controller.getProgress);
  app.post('/api/v1/learning/complete', { preHandler: requireAuth }, controller.complete);
}
