import type { FastifyInstance } from 'fastify';
import { createRequireAuth } from '../../middleware/auth.js';
import { createAuthService } from '../auth/service.js';
import { createQuestionService } from './service.js';
export async function registerQuestionRoutes(app: FastifyInstance): Promise<void> {
  const service = createQuestionService(app.prisma);
  const auth = createRequireAuth(createAuthService({ prisma: app.prisma }));
  const user = (r: import('fastify').FastifyRequest) => r.authenticatedSession?.user;
  app.post('/api/v1/questions/:questionId/attempt', { preHandler: auth }, async (r, reply) => {
    const u = user(r);
    const b = r.body as { answer?: string };
    if (!u || !b.answer?.trim()) return reply.code(400).send({ error: 'invalid' });
    const x = await service.attempt(u.id, (r.params as { questionId: string }).questionId, b.answer.trim());
    return x ? reply.send(x) : reply.code(404).send({ error: 'not found' });
  });
  app.post('/api/v1/questions/:questionId/bookmark', { preHandler: auth }, async (r, reply) =>
    reply.send(await service.bookmark(user(r)!.id, (r.params as { questionId: string }).questionId, true)),
  );
  app.delete('/api/v1/questions/:questionId/bookmark', { preHandler: auth }, async (r, reply) =>
    reply.send(await service.bookmark(user(r)!.id, (r.params as { questionId: string }).questionId, false)),
  );
  app.get('/api/v1/articles/:articleId/question-bookmarks', { preHandler: auth }, async (r, reply) => {
    const q = r.query as Record<string, string>;
    return reply.send({
      questions: await service.bookmarks(
        user(r)!.id,
        (r.params as { articleId: string }).articleId,
        q.category || 'all',
        q.type || 'all',
        q.wrongCount || 'all',
      ),
    });
  });
  app.post('/api/v1/articles/:articleId/wrong-question-practice', { preHandler: auth }, async (r, reply) => {
    const x = await service.practice(user(r)!.id, (r.params as { articleId: string }).articleId);
    return x ? reply.send(x) : reply.code(422).send({ error: 'none' });
  });
  app.get('/api/v1/articles/:articleId/question-learning-analysis', { preHandler: auth }, async (r, reply) =>
    reply.send(await service.analysis(user(r)!.id, (r.params as { articleId: string }).articleId)),
  );
}
