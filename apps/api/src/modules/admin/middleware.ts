import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createRequireAuth } from '../../middleware/auth.js';
import type { AuthService } from '../auth/service.js';
import { response } from '../../utils/response.js';

export function createAdminPreHandler(authService: AuthService) {
  const requireAuth = createRequireAuth(authService);

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireAuth(request, reply);
    if (!request.authenticatedSession) return;
    if (request.authenticatedSession.user.role !== 'admin') {
      await reply.status(403).send(response(ApiCode.FORBIDDEN, '需要管理员权限', null));
    }
  };
}
