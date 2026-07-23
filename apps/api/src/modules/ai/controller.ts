import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { response } from '../../utils/response.js';
import type { AiService } from './service.js';
import { saveSettingsSchema, testSchema } from './types.js';

export function createAiController(service: AiService) {
  return {
    async getSettings(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      const settings = await service.getSettings(session.user.id);
      return reply.send(response(ApiCode.OK, '获取 AI 设置成功', { settings }));
    },

    async saveSettings(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      const parsed = saveSettingsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, 'AI 厂商、模型或 API Key 无效。', null));
      }

      const settings = await service.saveSettings(session.user.id, parsed.data.configuration);
      return reply.send(response(ApiCode.OK, 'AI 设置已保存', { settings }));
    },

    async test(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      const parsed = testSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, 'AI 配置无效', null));
      }

      const result = await service.testConnection(session.user.id, parsed.data.configuration);

      if (result.kind === 'missingConfig') {
        return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '请填写 API Key，或先保存 AI 设置。', null));
      }
      if (result.kind === 'connectionFailed') {
        return reply.status(502).send(response(ApiCode.INTERNAL_ERROR, 'AI 连接失败。', null));
      }

      return reply.send(response(ApiCode.OK, 'AI 连接成功', { ok: true }));
    },
  };
}
