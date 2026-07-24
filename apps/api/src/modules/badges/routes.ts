import type { FastifyInstance } from 'fastify';
import { createRequireAuth } from '../../middleware/auth.js';
import { createAuthService } from '../auth/service.js';
import { createBadgeController } from './controller.js';
import { createBadgeService } from './service.js';

export async function registerBadgeRoutes(app: FastifyInstance): Promise<void> {
  const service = createBadgeService({ prisma: app.prisma });
  const controller = createBadgeController(service);
  const requireAuth = createRequireAuth(createAuthService({ prisma: app.prisma }));

  app.get('/api/v1/badges', { preHandler: requireAuth }, controller.getBadges);
}
