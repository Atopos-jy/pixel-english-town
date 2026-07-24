import type { FastifyInstance } from 'fastify';
import { createRequireAuth } from '../../middleware/auth.js';
import { createAuthService } from '../auth/service.js';
import { createQuestionController } from './controller.js';
import { createQuestionService } from './service.js';

export async function registerQuestionRoutes(app: FastifyInstance): Promise<void> {
  const service = createQuestionService(app.prisma);
  const controller = createQuestionController(service);
  const requireAuth = createRequireAuth(createAuthService({ prisma: app.prisma }));

  app.post('/api/v1/questions/:questionId/attempt', { preHandler: requireAuth }, controller.attempt);
  app.post('/api/v1/questions/:questionId/bookmark', { preHandler: requireAuth }, controller.bookmark);
  app.delete('/api/v1/questions/:questionId/bookmark', { preHandler: requireAuth }, controller.unbookmark);
  app.get('/api/v1/articles/:articleId/question-bookmarks', { preHandler: requireAuth }, controller.getBookmarks);
  app.post('/api/v1/articles/:articleId/wrong-question-practice', { preHandler: requireAuth }, controller.practice);
  app.get('/api/v1/articles/:articleId/question-learning-analysis', { preHandler: requireAuth }, controller.analysis);
}
