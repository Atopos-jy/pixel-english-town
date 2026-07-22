import type { FastifyInstance } from 'fastify';
import { createArticleController } from './controller.js';
import { createArticleService } from './service.js';

export async function registerArticleRoutes(app: FastifyInstance): Promise<void> {
  const articleService = createArticleService({ prisma: app.prisma });
  const controller = createArticleController(articleService);

  app.get('/api/v1/articles', controller.list);
  app.get('/api/v1/articles/:articleId', controller.detail);
}
