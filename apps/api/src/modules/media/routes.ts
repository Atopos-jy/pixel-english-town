import crypto from 'node:crypto';
import OSS from 'ali-oss';
import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createRequireAuth } from '../../middleware/auth.js';
import { response } from '../../utils/response.js';
import { createAuthService } from '../auth/service.js';

const idSchema = z.object({ id: z.string().min(1) });
const extensions = new Set(['mp3', 'wav', 'ogg', 'aac', 'm4a']);
const mimeTypes: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
};

export async function registerMediaRoutes(app: FastifyInstance): Promise<void> {
  const auth = createRequireAuth(createAuthService({ prisma: app.prisma }));
  const admin = async (request: FastifyRequest, reply: import('fastify').FastifyReply) => {
    await auth(request, reply);
    if (request.authenticatedSession?.user.role !== 'admin')
      await reply.status(403).send(response(ApiCode.FORBIDDEN, '需要管理员权限', null));
  };
  const getOss = () => {
    const {
      OSS_SECRET_ID: accessKeyId,
      OSS_SECRET_KEY: accessKeySecret,
      OSS_BUCKET: bucket,
      OSS_REGION: region,
    } = app.env;
    if (!accessKeyId || !accessKeySecret || !bucket || !region) throw new Error('OSS 配置不完整');
    return new OSS({ region, accessKeyId, accessKeySecret, authorizationV4: true, bucket, secure: true });
  };
  app.post('/api/v1/admin/oss/upload', { preHandler: admin }, async (request, reply) => {
    const upload = await request.file();
    if (!upload) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '未找到上传文件', null));
    const extension = upload.filename.split('.').pop()?.toLowerCase();
    if (!extension || !extensions.has(extension))
      return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '仅支持 MP3、WAV、OGG、AAC、M4A 音频', null));
    const buffer = await upload.toBuffer();
    if (buffer.length > 50 * 1024 * 1024)
      return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '音频文件不能超过 50MB', null));
    const key = `audio/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    await getOss().put(key, buffer, {
      headers: { 'Content-Type': upload.mimetype || 'application/octet-stream', 'x-oss-forbid-overwrite': 'true' },
    });
    const base =
      app.env.OSS_PUBLIC_BASE_URL?.replace(/\/$/, '') ||
      `https://${app.env.OSS_BUCKET}.${app.env.OSS_REGION}.aliyuncs.com`;
    return reply.send(response(ApiCode.OK, '上传音频成功', { key, url: `${base}/${key}` }));
  });
  app.post('/api/v1/admin/articles/:id/transcribe', { preHandler: admin }, async (request, reply) => {
    const parsed = idSchema.safeParse(request.params);
    if (!parsed.success) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '文章参数无效', null));
    const article = await app.prisma.article.findUnique({ where: { id: parsed.data.id } });
    if (!article) return reply.status(404).send(response(ApiCode.NOT_FOUND, '文章不存在', null));
    if (!article.audioUrl)
      return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '该文章没有音频文件', null));
    if (!app.env.GROQ_API_KEY)
      return reply.status(500).send(response(ApiCode.INTERNAL_ERROR, '服务器未配置 GROQ_API_KEY', null));
    const audio = await fetch(article.audioUrl);
    if (!audio.ok) throw new Error('下载音频文件失败');
    const extension = article.audioUrl.split('?')[0].split('.').pop()?.toLowerCase() || 'mp3';
    const form = new FormData();
    form.append(
      'file',
      new File([await audio.arrayBuffer()], `audio.${extension}`, { type: mimeTypes[extension] || 'audio/mpeg' }),
    );
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    const result = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${app.env.GROQ_API_KEY}` },
      body: form,
    });
    const payload = (await result.json()) as { words?: unknown; error?: { message?: string } };
    if (!result.ok) throw new Error(`Whisper API 调用失败: ${payload.error?.message || '未知错误'}`);
    const words = z.array(z.object({ word: z.string(), start: z.number(), end: z.number() })).safeParse(payload.words);
    if (!words.success || !words.data.length) throw new Error('Whisper 未返回逐词时间戳，请确认音频清晰度');
    await app.prisma.article.update({ where: { id: article.id }, data: { wordTimestamps: words.data } });
    return reply.send(response(ApiCode.OK, '时间戳生成成功', { wordCount: words.data.length }));
  });
}
