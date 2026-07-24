import type { FastifyInstance } from 'fastify';
import { createRequireAuth } from '../../middleware/auth.js';
import { createAuthService } from '../auth/service.js';
import { createAiController } from './controller.js';
import { createAiService } from './service.js';

export async function registerAiRoutes(app: FastifyInstance): Promise<void> {
  const service = createAiService({ prisma: app.prisma, encryptionKey: app.env.AI_SETTINGS_ENCRYPTION_KEY });
  const controller = createAiController(service);
  const requireAuth = createRequireAuth(createAuthService({ prisma: app.prisma }));

  app.get('/api/v1/ai/settings', { preHandler: requireAuth }, controller.getSettings);
  app.put('/api/v1/ai/settings', { preHandler: requireAuth }, controller.saveSettings);
  app.post('/api/v1/ai/test', { preHandler: requireAuth }, controller.test);
}
