import { ApiCode, type ApiResponse } from '@pixel-english-town/contracts';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().trim().min(2).max(16).optional(),
});
const cookieName = 'pixel-town.token';
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;
const sessionDurationSeconds = sessionDurationMs / 1000;

type PublicUser = { id: string; email: string; name: string | null; role: string };
const result = <T>(code: number, message: string, data: T | null): ApiResponse<T> => ({ code, data, message });
const publicUser = (user: PublicUser): PublicUser => user;

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  async function getAuthenticatedUser(request: import('fastify').FastifyRequest) {
    const token = request.cookies[cookieName];
    if (!token) return null;
    try {
      const payload = await request.jwtVerify<{ sub: string; sid: string }>({ onlyCookie: true });
      const session = await app.prisma.userSession.findFirst({
        where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
        include: { user: { select: { id: true, email: true, name: true, role: true } } },
      });
      return session;
    } catch {
      return null;
    }
  }
  async function createSession(
    user: PublicUser,
    reply: import('fastify').FastifyReply,
    request: import('fastify').FastifyRequest,
  ) {
    const session = await app.prisma.userSession.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + sessionDurationMs),
        userAgent: request.headers['user-agent']?.slice(0, 500),
      },
    });
    const token = await reply.jwtSign({ sub: user.id, sid: session.id }, { expiresIn: sessionDurationSeconds });
    reply.setCookie(cookieName, token, {
      httpOnly: true,
      secure: app.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: sessionDurationSeconds,
    });
  }
  app.post('/api/v1/auth/register', async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(result(ApiCode.VALIDATION_ERROR, '请求数据格式错误', null));
    const { email, password, name } = parsed.data;
    const existing = await app.prisma.user.findUnique({ where: { email } });
    if (existing) return reply.status(409).send(result(ApiCode.CONFLICT, '该邮箱已注册', null));
    const user = await app.prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 10),
        name: name || email.split('@')[0],
        progress: { create: { completedArticleIds: [], activityLog: {}, badges: [] } },
      },
      select: { id: true, email: true, name: true, role: true },
    });
    await createSession(user, reply, request);
    return reply.status(201).send(result(ApiCode.OK, '注册成功', publicUser(user)));
  });
  app.post('/api/v1/auth/login', async (request, reply) => {
    const parsed = credentialsSchema.pick({ email: true, password: true }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(result(ApiCode.VALIDATION_ERROR, '请求数据格式错误', null));
    const user = await app.prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, name: true, role: true, password: true },
    });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password)))
      return reply.status(401).send(result(ApiCode.UNAUTHORIZED, '邮箱或密码错误', null));
    const { password: _password, ...safeUser } = user;
    await createSession(safeUser, reply, request);
    return reply.send(result(ApiCode.OK, '登录成功', publicUser(safeUser)));
  });
  app.get('/api/v1/auth/me', async (request, reply) => {
    const session = await getAuthenticatedUser(request);
    if (!session) return reply.status(401).send(result(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));
    return reply.send(result(ApiCode.OK, '获取当前用户成功', publicUser(session.user)));
  });
  app.post('/api/v1/auth/logout', async (request, reply) => {
    const session = await getAuthenticatedUser(request);
    if (session) await app.prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    reply.clearCookie(cookieName, {
      httpOnly: true,
      secure: app.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return reply.send(result(ApiCode.OK, '已退出登录', null));
  });
}
