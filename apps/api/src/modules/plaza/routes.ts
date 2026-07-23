import crypto from 'node:crypto';
import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createRequireAuth } from '../../middleware/auth.js';
import { response } from '../../utils/response.js';
import { createAuthService } from '../auth/service.js';
import { createPlazaService } from './service.js';

const enterSchema = z.object({ userId: z.string().min(1) });
function internalAuthorized(header: string | undefined): boolean {
  const expected = process.env.PLAZA_INTERNAL_SECRET;
  const actual = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!expected || !actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
export async function registerPlazaRoutes(app: FastifyInstance): Promise<void> {
  const service = createPlazaService(app.prisma, app.redis);
  const auth = createRequireAuth(createAuthService({ prisma: app.prisma }));
  app.get('/api/v1/plaza/snapshot', { preHandler: auth }, async (_request, reply) =>
    reply.send(response(ApiCode.OK, '获取广场快照成功', await service.snapshot())),
  );
  app.post('/api/v1/internal/plaza/enter', async (request, reply) => {
    if (!internalAuthorized(request.headers.authorization))
      return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '内部服务认证失败', null));
    const parsed = enterSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '请求数据格式错误', null));
    const result = await service.enter(parsed.data.userId);
    if (!result) return reply.status(404).send(response(ApiCode.NOT_FOUND, '用户不存在', null));
    return reply.send(response(ApiCode.OK, result.created ? '进入广场动态已创建' : '进入动态仍在冷却中', result));
  });
}
