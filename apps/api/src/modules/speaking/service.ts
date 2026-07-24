import { wordTimestampSchema, type SpeakingServiceResult, type WordMatchResult, type WordTimestamp } from './types.js';

interface SpeakingServiceDependencies {
  deepgramApiKey: string;
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

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

interface DeepgramResponse {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        words?: DeepgramWord[];
      }>;
    }>;
  };
}

export function createSpeakingService({ deepgramApiKey }: SpeakingServiceDependencies): SpeakingService {
  const DEEPGRAM_URL = 'https://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true';

  async function callDeepgram(audioBuffer: ArrayBuffer, mimetype: string): Promise<DeepgramResponse> {
    const result = await fetch(DEEPGRAM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Token ${deepgramApiKey}`,
        'Content-Type': mimetype || 'audio/webm',
      },
      body: Buffer.from(audioBuffer),
    });

    if (!result.ok) {
      const payload = (await result.json().catch(() => null)) as { err_msg?: string; error?: string } | null;
      throw new Error(`Deepgram 转录失败: ${payload?.err_msg || payload?.error || '未知错误'}`);
    }

    return (await result.json()) as DeepgramResponse;
  }

  function extractWords(response: DeepgramResponse): { transcript: string; words: WordTimestamp[] } {
    const alternative = response.results?.channels?.[0]?.alternatives?.[0];
    const transcript = alternative?.transcript?.trim() || '';
    const wordsParse = wordTimestampSchema.array().safeParse(alternative?.words ?? []);
    return { transcript, words: wordsParse.success ? wordsParse.data : [] };
  }

  return {
    async transcribeWithTimestamps(audioBuffer, _filename, mimetype) {
      try {
        const payload = await callDeepgram(audioBuffer, mimetype);
        return extractWords(payload);
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
