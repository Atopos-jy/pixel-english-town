import { wordTimestampSchema, type SpeakingServiceResult, type WordMatchResult, type WordTimestamp } from './types.js';

interface SpeakingServiceDependencies {
  groqApiKey: string;
}

export interface SpeakingService {
  transcribe(audioBuffer: ArrayBuffer, filename: string, mimetype: string): Promise<SpeakingServiceResult>;
  matchWord(audioBuffer: ArrayBuffer, filename: string, mimetype: string, targetWord: string): Promise<WordMatchResult>;
  transcribeWithTimestamps(
    audioBuffer: ArrayBuffer,
    filename: string,
    mimetype: string,
  ): Promise<{ transcript: string; words: WordTimestamp[] } | { kind: 'error'; message: string }>;
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

interface WhisperVerboseResponse {
  text?: string;
  words?: Array<{ word: string; start: number; end: number }>;
  error?: { message?: string };
}

export function createSpeakingService({ groqApiKey }: SpeakingServiceDependencies): SpeakingService {
  async function callWhisper(
    audioBuffer: ArrayBuffer,
    filename: string,
    mimetype: string,
  ): Promise<WhisperVerboseResponse> {
    const form = new FormData();
    form.append('file', new File([audioBuffer], filename || 'recording.webm', { type: mimetype || 'audio/webm' }));
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    form.append('language', 'en');

    const result = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqApiKey}` },
      body: form,
    });

    if (!result.ok) {
      const payload = (await result.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new Error(`转录失败: ${payload?.error?.message || '未知错误'}`);
    }

    return (await result.json()) as WhisperVerboseResponse;
  }

  return {
    async transcribeWithTimestamps(audioBuffer, filename, mimetype) {
      try {
        const payload = await callWhisper(audioBuffer, filename, mimetype);
        const transcript = payload.text?.trim() || '';
        const wordsParse = wordTimestampSchema.array().safeParse(payload.words);
        const words = wordsParse.success ? wordsParse.data : [];

        return { transcript, words };
      } catch (error) {
        return { kind: 'error', message: error instanceof Error ? error.message : '转录服务异常' };
      }
    },

    async transcribe(audioBuffer, filename, mimetype) {
      const result = await this.transcribeWithTimestamps(audioBuffer, filename, mimetype);
      if ('kind' in result) return result;
      return { kind: 'transcribed' as const, transcript: result.transcript, words: result.words };
    },

    async matchWord(audioBuffer, filename, mimetype, targetWord) {
      const transcriptionResult = await this.transcribeWithTimestamps(audioBuffer, filename, mimetype);
      if ('kind' in transcriptionResult) return transcriptionResult;

      const { transcript, words } = transcriptionResult;
      const transcriptNorm = normalize(transcript);
      const wordNorm = normalize(targetWord);
      const sim = similarity(transcriptNorm, wordNorm);

      if (sim >= 0.75) {
        return { kind: 'matched', transcript, word: targetWord, similarity: sim, words };
      }

      return { kind: 'mismatched', transcript, word: targetWord, similarity: sim, words };
    },
  };
}
