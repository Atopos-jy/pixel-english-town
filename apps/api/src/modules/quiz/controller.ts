import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { response } from '../../utils/response.js';
import type { createQuizService } from './service.js';
import { generateQuizSchema, jobParamsSchema } from './types.js';

type QuizService = ReturnType<typeof createQuizService>;

export function createQuizController(service: QuizService) {
  return {
    async generate(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      const parsed = generateQuizSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '缺少文章内容。', null));
      }

      const retryAfterSeconds = await service.checkRateLimit(session.user.id);
      if (retryAfterSeconds !== null) {
        reply.header('Retry-After', retryAfterSeconds);
        return reply
          .status(429)
          .send(response(ApiCode.TOO_MANY_REQUESTS, `请求过于频繁，请在 ${retryAfterSeconds} 秒后重试。`, null));
      }

      const result = await service.create(session.user.id, parsed.data.articleId);
      if (result.kind === 'notFound') {
        return reply.status(404).send(response(ApiCode.NOT_FOUND, '文章不存在。', null));
      }

      return reply
        .status(result.kind === 'created' ? 202 : 200)
        .send(response(ApiCode.OK, '出题任务已提交', { job: result.job }));
    },

    async getJob(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      const parsed = jobParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '出题任务参数无效。', null));
      }

      const job = await service.get(session.user.id, parsed.data.jobId);
      if (!job) return reply.status(404).send(response(ApiCode.NOT_FOUND, '出题任务不存在。', null));

      return reply.send(response(ApiCode.OK, '获取出题任务成功', { job }));
    },
  };
}
