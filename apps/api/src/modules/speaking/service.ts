import type { SpeakingServiceResult, WordMatchResult } from './types.js';

interface SpeakingServiceDependencies {
  groqApiKey: string;
}

export interface SpeakingService {
  transcribe(audioBuffer: ArrayBuffer, filename: string, mimetype: string): Promise<SpeakingServiceResult>;
  matchWord(audioBuffer: ArrayBuffer, filename: string, mimetype: string, targetWord: string): Promise<WordMatchResult>;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, '')
    .trim();
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] =
        a[i - 1] === b[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]) + 1;
    }
  }

  const maxLen = Math.max(a.length, b.length);
  return 1 - matrix[a.length][b.length] / maxLen;
}

export function createSpeakingService({ groqApiKey }: SpeakingServiceDependencies): SpeakingService {
  return {
    async transcribe(audioBuffer, filename, mimetype) {
      const form = new FormData();
      form.append('file', new File([audioBuffer], filename || 'recording.webm', { type: mimetype || 'audio/webm' }));
      form.append('model', 'whisper-large-v3-turbo');
      form.append('response_format', 'text');
      form.append('language', 'en');

      const result = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqApiKey}` },
        body: form,
      });

      if (!result.ok) {
        const payload = (await result.json().catch(() => null)) as { error?: { message?: string } } | null;
        return { kind: 'error', message: `转录失败: ${payload?.error?.message || '未知错误'}` };
      }

      return { kind: 'transcribed', transcript: (await result.text()).trim() };
    },

    async matchWord(audioBuffer, filename, mimetype, targetWord) {
      const transcriptionResult = await this.transcribe(audioBuffer, filename, mimetype);
      if (transcriptionResult.kind === 'error') return transcriptionResult;

      const transcriptNorm = normalize(transcriptionResult.transcript);
      const wordNorm = normalize(targetWord);
      const sim = similarity(transcriptNorm, wordNorm);

      // 相似度 >= 0.75 视为匹配成功（容忍轻微发音偏差）
      if (sim >= 0.75) {
        return { kind: 'matched', transcript: transcriptionResult.transcript, word: targetWord, similarity: sim };
      }

      return { kind: 'mismatched', transcript: transcriptionResult.transcript, word: targetWord, similarity: sim };
    },
  };
}
