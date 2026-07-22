import type { FastifyInstance } from 'fastify';
import { createOptionalAuth, createRequireAuth } from '../../middleware/auth.js';
import { createAuthController } from './controller.js';
import { createAuthService } from './service.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const authService = createAuthService({ prisma: app.prisma });
  const controller = createAuthController(authService);
  const requireAuth = createRequireAuth(authService);
  const optionalAuth = createOptionalAuth(authService);

  app.post('/api/v1/auth/register', controller.register);
  app.post('/api/v1/auth/login', controller.login);
  app.get('/api/v1/auth/me', { preHandler: requireAuth }, controller.me);
  app.post('/api/v1/auth/logout', { preHandler: optionalAuth }, controller.logout);
}
