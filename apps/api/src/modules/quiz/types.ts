import { z } from 'zod';

export const generateQuizSchema = z.object({ articleId: z.string().min(1) });
export const jobParamsSchema = z.object({ jobId: z.string().min(1) });

export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;
export type JobParams = z.infer<typeof jobParamsSchema>;
