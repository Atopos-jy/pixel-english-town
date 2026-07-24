import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const cookieName = 'pixel-town.token';
const authOptions = {};

export { authOptions };

export type AuthSession = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
};

export async function getServerSession(_options?: unknown): Promise<AuthSession | null> {
  const token = cookies().get(cookieName)?.value;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
    const session = await prisma.userSession.findFirst({
      where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });
    return session ? { user: session.user } : null;
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const session = await getServerSession();
  if (!session) return { error: 'Unauthorized', status: 401, session: null };
  if (session.user.role !== 'admin') return { error: 'Forbidden - Admin access required', status: 403, session: null };
  return { session, error: null, status: 200 };
}
