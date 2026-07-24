import { z } from 'zod';

export const enterSchema = z.object({ userId: z.string().min(1) });

export type EnterInput = z.infer<typeof enterSchema>;
