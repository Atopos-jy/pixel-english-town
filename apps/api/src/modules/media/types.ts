import { z } from 'zod';

export const articleIdSchema = z.object({ id: z.string().min(1) });

export const allowedExtensions = new Set(['mp3', 'wav', 'ogg', 'aac', 'm4a']);

export const audioMimeTypes: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
};

export const wordTimestampSchema = z.array(z.object({ word: z.string(), start: z.number(), end: z.number() }));
