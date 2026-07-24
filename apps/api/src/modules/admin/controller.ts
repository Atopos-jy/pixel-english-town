import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { response } from '../../utils/response.js';
import type { AdminService } from './service.js';
import { articleCreateSchema, articleUpdateSchema, badgeUpdateSchema, idSchema, roleSchema } from './types.js';

function validationError(reply: FastifyReply, message: string) {
  return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, message, null));
}

export function createAdminController(service: AdminService) {
  return {
    async stats(_request: FastifyRequest, reply: FastifyReply) {
      const data = await service.getStats();
      return reply.send(response(ApiCode.OK, '获取统计数据成功', data));
    },

    async listArticles(_request: FastifyRequest, reply: FastifyReply) {
      const articles = await service.listArticles();
      return reply.send(response(ApiCode.OK, '获取文章列表成功', articles));
    },

    async createArticle(request: FastifyRequest, reply: FastifyReply) {
      const parsed = articleCreateSchema.safeParse(request.body);
      if (!parsed.success) return validationError(reply, '文章参数无效');
      const article = await service.createArticle(parsed.data);
      return reply.status(201).send(response(ApiCode.OK, '创建文章成功', article));
    },

    async getArticle(request: FastifyRequest, reply: FastifyReply) {
      const parsed = idSchema.safeParse(request.params);
      if (!parsed.success) return validationError(reply, '文章参数无效');
      const article = await service.getArticle(parsed.data.id);
      if (!article) return reply.status(404).send(response(ApiCode.NOT_FOUND, '文章不存在', null));
      return reply.send(response(ApiCode.OK, '获取文章成功', article));
    },

    async updateArticle(request: FastifyRequest, reply: FastifyReply) {
      const params = idSchema.safeParse(request.params);
      const body = articleUpdateSchema.safeParse(request.body);
      if (!params.success || !body.success) return validationError(reply, '文章参数无效');
      const article = await service.updateArticle(params.data.id, body.data);
      if (!article) return reply.status(404).send(response(ApiCode.NOT_FOUND, '文章不存在', null));
      return reply.send(response(ApiCode.OK, '更新文章成功', article));
    },

    async deleteArticle(request: FastifyRequest, reply: FastifyReply) {
      const parsed = idSchema.safeParse(request.params);
      if (!parsed.success) return validationError(reply, '文章参数无效');
      const deleted = await service.deleteArticle(parsed.data.id);
      if (!deleted) return reply.status(404).send(response(ApiCode.NOT_FOUND, '文章不存在', null));
      return reply.send(response(ApiCode.OK, '文章删除成功', { id: parsed.data.id }));
    },

    async listUsers(_request: FastifyRequest, reply: FastifyReply) {
      const users = await service.listUsers();
      return reply.send(response(ApiCode.OK, '获取用户列表成功', users));
    },

    async getUser(request: FastifyRequest, reply: FastifyReply) {
      const parsed = idSchema.safeParse(request.params);
      if (!parsed.success) return validationError(reply, '用户参数无效');
      const user = await service.getUser(parsed.data.id);
      if (!user) return reply.status(404).send(response(ApiCode.NOT_FOUND, '用户不存在', null));
      return reply.send(response(ApiCode.OK, '获取用户成功', user));
    },

    async updateUserRole(request: FastifyRequest, reply: FastifyReply) {
      const params = idSchema.safeParse(request.params);
      const body = roleSchema.safeParse(request.body);
      if (!params.success || !body.success) return validationError(reply, '角色参数无效');
      const user = await service.updateUserRole(params.data.id, body.data.role);
      if (!user) return reply.status(404).send(response(ApiCode.NOT_FOUND, '用户不存在', null));
      return reply.send(response(ApiCode.OK, '更新角色成功', user));
    },

    async deleteUser(request: FastifyRequest, reply: FastifyReply) {
      const params = idSchema.safeParse(request.params);
      if (!params.success) return validationError(reply, '用户参数无效');

      const currentUser = request.authenticatedSession?.user;
      if (params.data.id === currentUser?.id) return validationError(reply, '不能删除自己的账户');

      const deleted = await service.deleteUser(params.data.id);
      if (!deleted) return reply.status(404).send(response(ApiCode.NOT_FOUND, '用户不存在', null));
      return reply.send(response(ApiCode.OK, '用户删除成功', { id: params.data.id }));
    },

    async getBadges(_request: FastifyRequest, reply: FastifyReply) {
      const badges = await service.getBadges();
      return reply.send(response(ApiCode.OK, '获取徽章配置成功', badges));
    },

    async updateBadges(request: FastifyRequest, reply: FastifyReply) {
      const parsed = badgeUpdateSchema.safeParse(request.body);
      if (!parsed.success) return validationError(reply, '徽章 JSON 格式或规则无效');
      const badges = await service.updateBadges(parsed.data.badges);
      return reply.send(response(ApiCode.OK, '徽章配置已保存', badges));
    },
  };
}
