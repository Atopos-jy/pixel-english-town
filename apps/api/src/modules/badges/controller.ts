import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { response } from '../../utils/response.js';
import type { BadgeService } from './service.js';

export function createBadgeController(service: BadgeService) {
  return {
    async getBadges(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      const badges = await service.getBadges();
      return reply.send(response(ApiCode.OK, '获取徽章配置成功', badges));
    },
  };
}
