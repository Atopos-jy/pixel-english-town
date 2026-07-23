import { z } from 'zod';
import type { Badge } from '../shared/badgeDefaults.js';

export const idSchema = z.object({ id: z.string().min(1) });
export const roleSchema = z.object({ role: z.enum(['user', 'admin']) });

const contentBlockSchema = z.object({ en: z.string().min(1), zh: z.string().min(1) });
const contentArraySchema = z.array(contentBlockSchema).min(1);

export const articleCreateSchema = z.object({
  date: z.string().min(1).optional(),
  titleEn: z.string().min(1),
  titleZh: z.string().min(1),
  summaryEn: z.string().min(1),
  summaryZh: z.string().min(1),
  content: contentArraySchema,
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  durationSeconds: z.number().int().positive(),
  audioUrl: z.string().url().nullable().optional(),
});

export const articleUpdateSchema = articleCreateSchema.partial();

export const badgeRuleSchema = z.object({
  metric: z.enum(['totalArticlesCompleted', 'currentStreak', 'beginnerCount', 'intermediateCount', 'advancedCount']),
  minimum: z.number().int().min(1),
});

export const badgeItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  icon: z.string(),
  enabled: z.boolean().optional(),
  rule: badgeRuleSchema,
});

export const badgeArraySchema = z.array(badgeItemSchema).min(1);
export const badgeUpdateSchema = z.object({ badges: badgeArraySchema });

export type IdParams = z.infer<typeof idSchema>;
export type ArticleCreateInput = z.infer<typeof articleCreateSchema>;
export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>;
export type RoleInput = z.infer<typeof roleSchema>;
export type BadgeItem = z.infer<typeof badgeItemSchema>;

export type { Badge };

export const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;
