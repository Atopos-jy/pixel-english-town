import crypto from 'node:crypto';
import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createRequireAuth } from '../../middleware/auth.js';
import { response } from '../../utils/response.js';
import { createAuthService } from '../auth/service.js';

const configSchema = z.object({
  provider: z.enum(['deepseek', 'mimo']),
  model: z.string().min(1),
  apiKey: z.string().min(8),
});
const providers = { deepseek: 'https://api.deepseek.com', mimo: 'https://api.xiaomimimo.com/v1' } as const;
function encrypt(value: string, keyValue: string): string {
  const key = Buffer.from(keyValue, 'base64');
  if (key.length !== 32) throw new Error('AI_SETTINGS_ENCRYPTION_KEY 必须是 32 字节的 Base64 密钥。');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}
function decrypt(value: string, keyValue: string): string {
  const [version, iv, tag, ciphertext] = value.split('.');
  const key = Buffer.from(keyValue, 'base64');
  if (version !== 'v1' || !iv || !tag || !ciphertext || key.length !== 32) throw new Error('已保存的 AI Key 无效');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}
export async function registerAiRoutes(app: FastifyInstance): Promise<void> {
  const auth = createRequireAuth(createAuthService({ prisma: app.prisma }));
  app.get('/api/v1/ai/settings', { preHandler: auth }, async (request, reply) => {
    const value = await app.prisma.userAiSetting.findUnique({
      where: { userId: request.authenticatedSession!.user.id },
    });
    return reply.send(
      response(ApiCode.OK, '获取 AI 设置成功', {
        settings: value
          ? { provider: value.provider, model: value.selectedModel, apiKeyLast4: value.apiKeyLast4 }
          : null,
      }),
    );
  });
  app.put('/api/v1/ai/settings', { preHandler: auth }, async (request, reply) => {
    const parsed = z.object({ configuration: configSchema }).safeParse(request.body);
    if (!parsed.success)
      return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, 'AI 厂商、模型或 API Key 无效。', null));
    const c = parsed.data.configuration;
    const userId = request.authenticatedSession!.user.id;
    const saved = await app.prisma.userAiSetting.upsert({
      where: { userId },
      create: {
        userId,
        provider: c.provider,
        selectedModel: c.model,
        encryptedApiKey: encrypt(c.apiKey, app.env.AI_SETTINGS_ENCRYPTION_KEY),
        apiKeyLast4: c.apiKey.slice(-4),
      },
      update: {
        provider: c.provider,
        selectedModel: c.model,
        encryptedApiKey: encrypt(c.apiKey, app.env.AI_SETTINGS_ENCRYPTION_KEY),
        apiKeyLast4: c.apiKey.slice(-4),
      },
    });
    return reply.send(
      response(ApiCode.OK, 'AI 设置已保存', {
        settings: { provider: saved.provider, model: saved.selectedModel, apiKeyLast4: saved.apiKeyLast4 },
      }),
    );
  });
  app.post('/api/v1/ai/test', { preHandler: auth }, async (request, reply) => {
    const direct = z.object({ configuration: configSchema.optional() }).safeParse(request.body);
    if (!direct.success) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, 'AI 配置无效', null));
    const stored = !direct.data.configuration
      ? await app.prisma.userAiSetting.findUnique({ where: { userId: request.authenticatedSession!.user.id } })
      : null;
    const c =
      direct.data.configuration ||
      (stored
        ? {
            provider: stored.provider,
            model: stored.selectedModel,
            apiKey: decrypt(stored.encryptedApiKey, app.env.AI_SETTINGS_ENCRYPTION_KEY),
          }
        : null);
    if (!c || !(c.provider in providers))
      return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '请填写 API Key，或先保存 AI 设置。', null));
    const result = await fetch(`${providers[c.provider as keyof typeof providers]}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: c.model,
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        max_tokens: 32,
        stream: false,
      }),
    });
    if (!result.ok) return reply.status(502).send(response(ApiCode.INTERNAL_ERROR, 'AI 连接失败。', null));
    return reply.send(response(ApiCode.OK, 'AI 连接成功', { ok: true }));
  });
}
