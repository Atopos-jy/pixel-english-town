import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { response } from '../../utils/response.js';
import type { ArticleService } from './service.js';
import { articleParamsSchema } from './types.js';

export function createArticleController(articleService: ArticleService) {
  return {
    async list(_request: FastifyRequest, reply: FastifyReply) {
      const articles = await articleService.listArticles();
      return reply.send(response(ApiCode.OK, '获取文章列表成功', articles));
    },

    async detail(request: FastifyRequest, reply: FastifyReply) {
      const parsed = articleParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '文章标识格式错误', null));
      }

      const article = await articleService.findArticleById(parsed.data.articleId);
      if (!article) return reply.status(404).send(response(ApiCode.NOT_FOUND, '文章不存在', null));

      return reply.send(response(ApiCode.OK, '获取文章详情成功', article));
    },
  };
}
