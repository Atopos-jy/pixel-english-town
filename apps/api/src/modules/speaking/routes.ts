import type { FastifyInstance } from 'fastify';
import { createRequireAuth } from '../../middleware/auth.js';
import { createAuthService } from '../auth/service.js';
import { createSpeakingController } from './controller.js';
import { createSpeakingService } from './service.js';

export async function registerSpeakingRoutes(app: FastifyInstance): Promise<void> {
  const service = createSpeakingService({ deepgramApiKey: app.env.DEEPGRAM_API_KEY || '' });
  const controller = createSpeakingController(service);
  const requireAuth = createRequireAuth(createAuthService({ prisma: app.prisma }));

  app.post('/api/v1/speaking-eval', { preHandler: requireAuth }, controller.evaluate);
  app.post('/api/v1/speaking/word-match', { preHandler: requireAuth }, controller.matchWord);
}
