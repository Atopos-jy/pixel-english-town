import type { FastifyInstance } from 'fastify';
import { createAuthService } from '../auth/service.js';
import { createAdminPreHandler } from './middleware.js';
import { createAdminController } from './controller.js';
import { createAdminService } from './service.js';

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  const service = createAdminService({ prisma: app.prisma });
  const controller = createAdminController(service);
  const adminPreHandler = createAdminPreHandler(createAuthService({ prisma: app.prisma }));

  // Stats
  app.get('/api/v1/admin/stats', { preHandler: adminPreHandler }, controller.stats);

  // Articles
  app.get('/api/v1/admin/articles', { preHandler: adminPreHandler }, controller.listArticles);
  app.post('/api/v1/admin/articles', { preHandler: adminPreHandler }, controller.createArticle);
  app.get('/api/v1/admin/articles/:id', { preHandler: adminPreHandler }, controller.getArticle);
  app.put('/api/v1/admin/articles/:id', { preHandler: adminPreHandler }, controller.updateArticle);
  app.delete('/api/v1/admin/articles/:id', { preHandler: adminPreHandler }, controller.deleteArticle);

  // Users
  app.get('/api/v1/admin/users', { preHandler: adminPreHandler }, controller.listUsers);
  app.get('/api/v1/admin/users/:id', { preHandler: adminPreHandler }, controller.getUser);
  app.put('/api/v1/admin/users/:id/role', { preHandler: adminPreHandler }, controller.updateUserRole);
  app.delete('/api/v1/admin/users/:id', { preHandler: adminPreHandler }, controller.deleteUser);

  // Badges
  app.get('/api/v1/admin/badges', { preHandler: adminPreHandler }, controller.getBadges);
  app.put('/api/v1/admin/badges', { preHandler: adminPreHandler }, controller.updateBadges);
}
