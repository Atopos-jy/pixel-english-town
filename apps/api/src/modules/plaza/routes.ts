import type { FastifyInstance } from 'fastify';
import { createRequireAuth } from '../../middleware/auth.js';
import { createAuthService } from '../auth/service.js';
import { createPlazaController } from './controller.js';
import { createPlazaService } from './service.js';

export async function registerPlazaRoutes(app: FastifyInstance): Promise<void> {
  const service = createPlazaService(app.prisma, app.redis);
  const controller = createPlazaController(service);
  const requireAuth = createRequireAuth(createAuthService({ prisma: app.prisma }));

  app.get('/api/v1/plaza/snapshot', { preHandler: requireAuth }, controller.snapshot);
  app.post('/api/v1/internal/plaza/enter', controller.enter);
}
