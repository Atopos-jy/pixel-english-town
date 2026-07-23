import { z } from 'zod';

export const aiConfigSchema = z.object({
  provider: z.enum(['deepseek', 'mimo']),
  model: z.string().min(1),
  apiKey: z.string().min(8),
});

export const saveSettingsSchema = z.object({ configuration: aiConfigSchema });
export const testSchema = z.object({ configuration: aiConfigSchema.optional() });

export type AiConfig = z.infer<typeof aiConfigSchema>;

export type AiSettingsResponse = {
  provider: string;
  model: string;
  apiKeyLast4: string;
} | null;

export type AiTestResult = { kind: 'ok' } | { kind: 'missingConfig' } | { kind: 'connectionFailed' };
