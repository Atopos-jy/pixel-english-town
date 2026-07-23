import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyInstance } from 'fastify';
import { createRequireAuth } from '../../middleware/auth.js';
import { response } from '../../utils/response.js';
import { createAuthService } from '../auth/service.js';

export async function registerSpeakingRoutes(app: FastifyInstance): Promise<void> {
  const auth = createRequireAuth(createAuthService({ prisma: app.prisma }));
  app.post('/api/v1/speaking-eval', { preHandler: auth }, async (request, reply) => {
    if (!app.env.GROQ_API_KEY)
      return reply.status(500).send(response(ApiCode.INTERNAL_ERROR, '服务器未配置 GROQ_API_KEY', null));
    const audio = await request.file();
    if (!audio) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '缺少音频数据', null));
    const form = new FormData();
    const buffer = await audio.toBuffer();
    const content = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    form.append(
      'file',
      new File([content], audio.filename || 'recording.webm', { type: audio.mimetype || 'audio/webm' }),
    );
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'text');
    form.append('language', 'en');
    const result = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${app.env.GROQ_API_KEY}` },
      body: form,
    });
    if (!result.ok) {
      const payload = (await result.json().catch(() => null)) as { error?: { message?: string } } | null;
      return reply
        .status(502)
        .send(response(ApiCode.INTERNAL_ERROR, `转录失败: ${payload?.error?.message || '未知错误'}`, null));
    }
    return reply.send(response(ApiCode.OK, '转录成功', { transcript: (await result.text()).trim() }));
  });
}
