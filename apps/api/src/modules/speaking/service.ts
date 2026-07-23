import type { SpeakingServiceResult } from './types.js';

interface SpeakingServiceDependencies {
  groqApiKey: string;
}

export interface SpeakingService {
  transcribe(audioBuffer: ArrayBuffer, filename: string, mimetype: string): Promise<SpeakingServiceResult>;
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
  };
}
