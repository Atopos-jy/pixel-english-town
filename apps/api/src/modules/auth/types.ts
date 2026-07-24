import type { Prisma } from '@prisma/client';
import { z } from 'zod';

export const authCookieName = 'pixel-town.token';
export const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;
export const sessionDurationSeconds = sessionDurationMs / 1000;

export const registerCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().trim().min(2).max(16).optional(),
});
export const loginCredentialsSchema = registerCredentialsSchema.pick({ email: true, password: true });

export type AuthCredentials = z.infer<typeof loginCredentialsSchema>;
export type RegisterCredentials = z.infer<typeof registerCredentialsSchema>;

export interface JwtSessionPayload {
  sub: string;
  sid: string;
}

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

export type AuthenticatedSession = Prisma.UserSessionGetPayload<{
  include: { user: { select: { id: true; email: true; name: true; role: true } } };
}>;

export type RegisterResult = { kind: 'emailExists' } | { kind: 'registered'; user: PublicUser };
export type LoginResult = { kind: 'invalidCredentials' } | { kind: 'authenticated'; user: PublicUser };
