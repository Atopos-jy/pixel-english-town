import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { response } from '../../utils/response.js';
import type { createQuestionService } from './service.js';
import { articleIdParamsSchema, attemptBodySchema, bookmarkQuerySchema, questionIdParamsSchema } from './types.js';

type QuestionService = ReturnType<typeof createQuestionService>;

export function createQuestionController(service: QuestionService) {
  return {
    async attempt(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      const params = questionIdParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '题目参数无效', null));

      const body = attemptBodySchema.safeParse(request.body);
      if (!body.success) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '答案不能为空', null));

      const result = await service.attempt(session.user.id, params.data.questionId, body.data.answer);
      if (!result) return reply.status(404).send(response(ApiCode.NOT_FOUND, '题目不存在', null));

      return reply.send(response(ApiCode.OK, '提交答案成功', result));
    },

    async bookmark(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      const params = questionIdParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '题目参数无效', null));

      const result = await service.bookmark(session.user.id, params.data.questionId, true);
      return reply.send(response(ApiCode.OK, '收藏成功', result));
    },

    async unbookmark(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      const params = questionIdParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '题目参数无效', null));

      const result = await service.bookmark(session.user.id, params.data.questionId, false);
      return reply.send(response(ApiCode.OK, '取消收藏成功', result));
    },

    async getBookmarks(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      const params = articleIdParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '文章参数无效', null));

      const query = bookmarkQuerySchema.safeParse(request.query);
      const q = query.success ? query.data : { category: 'all', type: 'all', wrongCount: 'all' };

      const questions = await service.bookmarks(
        session.user.id,
        params.data.articleId,
        q.category,
        q.type,
        q.wrongCount,
      );
      return reply.send(response(ApiCode.OK, '获取收藏题目成功', { questions }));
    },

    async practice(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      const params = articleIdParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '文章参数无效', null));

      const result = await service.practice(session.user.id, params.data.articleId);
      if (!result) return reply.status(422).send(response(ApiCode.VALIDATION_ERROR, '暂无可练习的错题', null));

      return reply.send(response(ApiCode.OK, '获取错题练习成功', result));
    },

    async analysis(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      const params = articleIdParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '文章参数无效', null));

      const result = await service.analysis(session.user.id, params.data.articleId);
      return reply.send(response(ApiCode.OK, '获取学习分析成功', result));
    },
  };
}
