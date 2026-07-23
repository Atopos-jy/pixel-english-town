import type { FastifyInstance } from 'fastify';
import { createAuthService } from '../auth/service.js';
import { createAdminPreHandler } from '../admin/middleware.js';
import { createMediaController } from './controller.js';
import { createMediaService } from './service.js';

export async function registerMediaRoutes(app: FastifyInstance): Promise<void> {
  const service = createMediaService({ prisma: app.prisma, env: app.env });
  const controller = createMediaController(service);
  const adminPreHandler = createAdminPreHandler(createAuthService({ prisma: app.prisma }));

  app.post('/api/v1/admin/oss/upload', { preHandler: adminPreHandler }, controller.upload);
  app.post('/api/v1/admin/articles/:id/transcribe', { preHandler: adminPreHandler }, controller.transcribe);
}
