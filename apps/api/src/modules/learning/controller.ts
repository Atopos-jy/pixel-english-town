import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { response } from '../../utils/response.js';
import { completeArticleSchema } from './types.js';

export function createLearningController(service: ReturnType<typeof import('./service.js').createLearningService>) {
  return {
    async getProgress(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '请先登录', null));
      return reply.send(response(ApiCode.OK, '获取学习进度成功', await service.getProgress(session.user.id)));
    },
    async complete(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '请先登录', null));
      const parsed = completeArticleSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '文章参数无效', null));
      const result = await service.complete(session.user.id, session.user.name, parsed.data);
      if (result.kind === 'notFound')
        return reply.status(404).send(response(ApiCode.NOT_FOUND, '文章或学习进度不存在', null));
      if (result.kind === 'conflict') return reply.status(409).send(response(ApiCode.CONFLICT, '文章已完成', null));
      return reply.send(response(ApiCode.OK, '学习完成', { progress: result.progress, newBadges: result.newBadges }));
    },
  };
}
