import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthService } from '../modules/auth/service.js';
import type { AuthenticatedSession, JwtSessionPayload } from '../modules/auth/types.js';
import { response } from '../utils/response.js';

declare module 'fastify' {
  interface FastifyRequest {
    authenticatedSession: AuthenticatedSession | null;
  }
}

export function registerAuthMiddleware(app: FastifyInstance): void {
  app.decorateRequest('authenticatedSession', null);
}

async function loadAuthenticatedSession(
  request: FastifyRequest,
  authService: AuthService,
): Promise<AuthenticatedSession | null> {
  try {
    const payload = await request.jwtVerify<JwtSessionPayload>({ onlyCookie: true });
    return await authService.findActiveSession(payload);
  } catch {
    return null;
  }
}

export function createOptionalAuth(authService: AuthService) {
  return async (request: FastifyRequest): Promise<void> => {
    request.authenticatedSession = await loadAuthenticatedSession(request, authService);
  };
}

export function createRequireAuth(authService: AuthService) {
  const optionalAuth = createOptionalAuth(authService);

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await optionalAuth(request);
    if (request.authenticatedSession) return;

    await reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));
  };
}
