import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createRequireAuth } from '../../middleware/auth.js';
import { response } from '../../utils/response.js';
import { createAuthService } from '../auth/service.js';
import { createQuizService } from './service.js';

const generateQuizSchema = z.object({ articleId: z.string().min(1) });
const jobParamsSchema = z.object({ jobId: z.string().min(1) });
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 3;

async function takeGenerationSlot(app: FastifyInstance, userId: string): Promise<number | null> {
  const key = `rate-limit:quiz-generate:${userId}`;
  const count = await app.redis.incr(key);
  if (count === 1) await app.redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  if (count <= RATE_LIMIT_MAX_REQUESTS) return null;
  return Math.max(await app.redis.ttl(key), 1);
}

export async function registerQuizRoutes(app: FastifyInstance): Promise<void> {
  const service = createQuizService(app.prisma, app.env);
  const requireAuth = createRequireAuth(createAuthService({ prisma: app.prisma }));
  const getUser = (request: FastifyRequest) => request.authenticatedSession?.user;

  app.post('/api/v1/quiz/generate', { preHandler: requireAuth }, async (request, reply) => {
    const user = getUser(request);
    const parsed = generateQuizSchema.safeParse(request.body);
    if (!user) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));
    if (!parsed.success) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '缺少文章内容。', null));
    const retryAfterSeconds = await takeGenerationSlot(app, user.id);
    if (retryAfterSeconds !== null) {
      reply.header('Retry-After', retryAfterSeconds);
      return reply
        .status(429)
        .send(response(ApiCode.TOO_MANY_REQUESTS, `请求过于频繁，请在 ${retryAfterSeconds} 秒后重试。`, null));
    }
    const result = await service.create(user.id, parsed.data.articleId);
    if (result.kind === 'notFound') return reply.status(404).send(response(ApiCode.NOT_FOUND, '文章不存在。', null));
    return reply
      .status(result.kind === 'created' ? 202 : 200)
      .send(response(ApiCode.OK, '出题任务已提交', { job: result.job }));
  });

  app.get('/api/v1/quiz/generate/:jobId', { preHandler: requireAuth }, async (request, reply) => {
    const user = getUser(request);
    const parsed = jobParamsSchema.safeParse(request.params);
    if (!user) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));
    if (!parsed.success) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '出题任务参数无效。', null));
    const job = await service.get(user.id, parsed.data.jobId);
    if (!job) return reply.status(404).send(response(ApiCode.NOT_FOUND, '出题任务不存在。', null));
    return reply.send(response(ApiCode.OK, '获取出题任务成功', { job }));
  });
}
