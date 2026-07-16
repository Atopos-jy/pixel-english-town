import { prisma } from '@/lib/prisma';
import { decryptApiKey, encryptApiKey, getApiKeyLast4 } from './encryption';
import { isSupportedAiConfiguration } from './quiz-provider';
import { AiConfiguration } from './types';

export type PublicAiSettings = {
  provider: AiConfiguration['provider'];
  model: string;
  apiKeyLast4: string;
};

export const getPublicAiSettings = async (userId: string): Promise<PublicAiSettings | null> => {
  const settings = await prisma.userAiSetting.findUnique({ where: { userId } });
  if (!settings) return null;
  return {
    provider: settings.provider as AiConfiguration['provider'],
    model: settings.selectedModel,
    apiKeyLast4: settings.apiKeyLast4,
  };
};

export const getStoredAiConfiguration = async (userId: string): Promise<AiConfiguration | null> => {
  const settings = await prisma.userAiSetting.findUnique({ where: { userId } });
  if (!settings) return null;

  const configuration: AiConfiguration = {
    provider: settings.provider as AiConfiguration['provider'],
    model: settings.selectedModel,
    apiKey: decryptApiKey(settings.encryptedApiKey),
  };
  return isSupportedAiConfiguration(configuration) ? configuration : null;
};

export const saveAiConfiguration = async (userId: string, configuration: AiConfiguration) => {
  if (!isSupportedAiConfiguration(configuration)) throw new Error('AI 厂商、模型或 API Key 无效。');

  await prisma.userAiSetting.upsert({
    where: { userId },
    create: {
      userId,
      provider: configuration.provider,
      selectedModel: configuration.model,
      encryptedApiKey: encryptApiKey(configuration.apiKey),
      apiKeyLast4: getApiKeyLast4(configuration.apiKey),
    },
    update: {
      provider: configuration.provider,
      selectedModel: configuration.model,
      encryptedApiKey: encryptApiKey(configuration.apiKey),
      apiKeyLast4: getApiKeyLast4(configuration.apiKey),
    },
  });
};
