import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { response } from '../../utils/response.js';
import type { AuthService } from './service.js';
import {
  authCookieName,
  loginCredentialsSchema,
  registerCredentialsSchema,
  sessionDurationSeconds,
  type PublicUser,
} from './types.js';

function validationError(reply: FastifyReply) {
  return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '请求数据格式错误', null));
}

async function setSessionCookie(
  authService: AuthService,
  user: PublicUser,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const session = await authService.createSession(user.id, request.headers['user-agent']);
  const token = await reply.jwtSign({ sub: user.id, sid: session.id }, { expiresIn: sessionDurationSeconds });
  reply.setCookie(authCookieName, token, {
    httpOnly: true,
    secure: request.server.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionDurationSeconds,
  });
}

export function createAuthController(authService: AuthService) {
  return {
    async register(request: FastifyRequest, reply: FastifyReply) {
      const parsed = registerCredentialsSchema.safeParse(request.body);
      if (!parsed.success) return validationError(reply);

      const result = await authService.register(parsed.data);
      if (result.kind === 'emailExists') {
        return reply.status(409).send(response(ApiCode.CONFLICT, '该邮箱已注册', null));
      }

      await setSessionCookie(authService, result.user, request, reply);
      return reply.status(201).send(response(ApiCode.OK, '注册成功', result.user));
    },

    async login(request: FastifyRequest, reply: FastifyReply) {
      const parsed = loginCredentialsSchema.safeParse(request.body);
      if (!parsed.success) return validationError(reply);

      const result = await authService.login(parsed.data);
      if (result.kind === 'invalidCredentials') {
        return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '邮箱或密码错误', null));
      }

      await setSessionCookie(authService, result.user, request, reply);
      return reply.send(response(ApiCode.OK, '登录成功', result.user));
    },

    async me(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      return reply.send(response(ApiCode.OK, '获取当前用户成功', session.user));
    },

    async logout(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (session) await authService.revokeSession(session.id);
      reply.clearCookie(authCookieName, {
        httpOnly: true,
        secure: request.server.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      return reply.send(response(ApiCode.OK, '已退出登录', null));
    },
  };
}
