import { z } from 'zod';

export const wordTimestampSchema = z.object({ word: z.string(), start: z.number(), end: z.number() });
export type WordTimestamp = z.infer<typeof wordTimestampSchema>;

export type SpeakingServiceResult =
  { kind: 'transcribed'; transcript: string; words: WordTimestamp[] } | { kind: 'error'; message: string };

export type WordMatchResult =
  | { kind: 'matched'; transcript: string; word: string; similarity: number; words: WordTimestamp[] }
  | { kind: 'mismatched'; transcript: string; word: string; similarity: number; words: WordTimestamp[] }
  | { kind: 'error'; message: string };
