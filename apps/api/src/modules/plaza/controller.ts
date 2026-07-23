import crypto from 'node:crypto';
import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { response } from '../../utils/response.js';
import type { createPlazaService } from './service.js';
import { enterSchema } from './types.js';

type PlazaService = ReturnType<typeof createPlazaService>;

function internalAuthorized(header: string | undefined): boolean {
  const expected = process.env.PLAZA_INTERNAL_SECRET;
  const actual = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!expected || !actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function createPlazaController(service: PlazaService) {
  return {
    async snapshot(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      const data = await service.snapshot();
      return reply.send(response(ApiCode.OK, '获取广场快照成功', data));
    },

    async enter(request: FastifyRequest, reply: FastifyReply) {
      if (!internalAuthorized(request.headers.authorization)) {
        return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '内部服务认证失败', null));
      }

      const parsed = enterSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '请求数据格式错误', null));
      }

      const result = await service.enter(parsed.data.userId);
      if (!result) return reply.status(404).send(response(ApiCode.NOT_FOUND, '用户不存在', null));

      return reply.send(response(ApiCode.OK, result.created ? '进入广场动态已创建' : '进入动态仍在冷却中', result));
    },
  };
}
