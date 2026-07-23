import { z } from 'zod';

const envSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  AI_SETTINGS_ENCRYPTION_KEY: z.string().min(1),
  GROQ_API_KEY: z.string().optional(),
  OSS_SECRET_ID: z.string().optional(),
  OSS_SECRET_KEY: z.string().optional(),
  OSS_BUCKET: z.string().optional(),
  OSS_REGION: z.string().optional(),
  OSS_PUBLIC_BASE_URL: z.string().url().optional(),
});

export type ApiEnv = z.infer<typeof envSchema>;

export function loadEnv(environment: NodeJS.ProcessEnv = process.env): ApiEnv {
  return envSchema.parse(environment);
}
