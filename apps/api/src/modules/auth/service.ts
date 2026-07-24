import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type {
  AuthCredentials,
  AuthenticatedSession,
  JwtSessionPayload,
  LoginResult,
  RegisterCredentials,
  RegisterResult,
} from './types.js';

interface AuthServiceDependencies {
  prisma: PrismaClient;
}

export interface AuthService {
  register(credentials: RegisterCredentials): Promise<RegisterResult>;
  login(credentials: AuthCredentials): Promise<LoginResult>;
  createSession(userId: string, userAgent: string | undefined): Promise<{ id: string }>;
  findActiveSession(payload: JwtSessionPayload): Promise<AuthenticatedSession | null>;
  revokeSession(sessionId: string): Promise<void>;
}

export function createAuthService({ prisma }: AuthServiceDependencies): AuthService {
  return {
    async register(credentials) {
      const existing = await prisma.user.findUnique({ where: { email: credentials.email } });
      if (existing) return { kind: 'emailExists' };

      const user = await prisma.user.create({
        data: {
          email: credentials.email,
          password: await bcrypt.hash(credentials.password, 10),
          name: credentials.name || credentials.email.split('@')[0],
          progress: { create: { completedArticleIds: [], activityLog: {}, badges: [] } },
        },
        select: { id: true, email: true, name: true, role: true },
      });
      return { kind: 'registered', user };
    },

    async login(credentials) {
      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
        select: { id: true, email: true, name: true, role: true, password: true },
      });
      if (!user || !(await bcrypt.compare(credentials.password, user.password))) {
        return { kind: 'invalidCredentials' };
      }

      const { password: _password, ...safeUser } = user;
      return { kind: 'authenticated', user: safeUser };
    },

    async createSession(userId, userAgent) {
      return prisma.userSession.create({
        data: {
          userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          userAgent: userAgent?.slice(0, 500),
        },
        select: { id: true },
      });
    },

    async findActiveSession(payload) {
      return prisma.userSession.findFirst({
        where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
        include: { user: { select: { id: true, email: true, name: true, role: true } } },
      });
    },

    async revokeSession(sessionId) {
      await prisma.userSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    },
  };
}
