import { z } from 'zod';

const contentBlockSchema = z.object({
  en: z.string(),
  zh: z.string(),
});
const wordTimestampSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
});

export const articleParamsSchema = z.object({
  articleId: z.string().min(1),
});

export const articleSchema = z.object({
  id: z.string(),
  title: contentBlockSchema,
  date: z.string(),
  summary: contentBlockSchema,
  content: z.array(contentBlockSchema),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  durationSeconds: z.number().int(),
  audioUrl: z.string().optional(),
  wordTimestamps: z.array(wordTimestampSchema).nullable(),
});

export type ArticleResponse = z.infer<typeof articleSchema>;
