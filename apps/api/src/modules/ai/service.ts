import type { PrismaClient } from '@prisma/client';
import { encryptApiKey, decryptApiKey } from '../quiz/encryption.js';
import type { AiConfig, AiSettingsResponse, AiTestResult } from './types.js';

interface AiServiceDependencies {
  prisma: PrismaClient;
  encryptionKey: string;
}

const providers: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  mimo: 'https://api.xiaomimimo.com/v1',
};

export interface AiService {
  getSettings(userId: string): Promise<AiSettingsResponse>;
  saveSettings(userId: string, config: AiConfig): Promise<AiSettingsResponse>;
  testConnection(userId: string, config?: AiConfig): Promise<AiTestResult>;
}

export function createAiService({ prisma, encryptionKey }: AiServiceDependencies): AiService {
  return {
    async getSettings(userId) {
      const value = await prisma.userAiSetting.findUnique({ where: { userId } });
      return value ? { provider: value.provider, model: value.selectedModel, apiKeyLast4: value.apiKeyLast4 } : null;
    },

    async saveSettings(userId, config) {
      const saved = await prisma.userAiSetting.upsert({
        where: { userId },
        create: {
          userId,
          provider: config.provider,
          selectedModel: config.model,
          encryptedApiKey: encryptApiKey(config.apiKey, encryptionKey),
          apiKeyLast4: config.apiKey.slice(-4),
        },
        update: {
          provider: config.provider,
          selectedModel: config.model,
          encryptedApiKey: encryptApiKey(config.apiKey, encryptionKey),
          apiKeyLast4: config.apiKey.slice(-4),
        },
      });
      return { provider: saved.provider, model: saved.selectedModel, apiKeyLast4: saved.apiKeyLast4 };
    },

    async testConnection(userId, config) {
      let resolvedConfig: { provider: string; model: string; apiKey: string } | null = config ?? null;

      if (!resolvedConfig) {
        const stored = await prisma.userAiSetting.findUnique({ where: { userId } });
        if (!stored) return { kind: 'missingConfig' };
        resolvedConfig = {
          provider: stored.provider,
          model: stored.selectedModel,
          apiKey: decryptApiKey(stored.encryptedApiKey, encryptionKey),
        };
      }

      if (!resolvedConfig || !(resolvedConfig.provider in providers)) return { kind: 'missingConfig' };

      const cfg = resolvedConfig;
      const result = await fetch(`${providers[cfg.provider]}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: 'user', content: 'Reply with OK.' }],
          max_tokens: 32,
          stream: false,
        }),
      });

      if (!result.ok) return { kind: 'connectionFailed' };
      return { kind: 'ok' };
    },
  };
}
