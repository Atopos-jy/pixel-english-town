import crypto from 'node:crypto';
import OSS from 'ali-oss';
import type { PrismaClient } from '@prisma/client';
import type { ApiEnv } from '../../config/env.js';
import { allowedExtensions, audioMimeTypes, wordTimestampSchema } from './types.js';

interface MediaServiceDependencies {
  prisma: PrismaClient;
  env: ApiEnv;
}

export interface MediaService {
  uploadAudio(buffer: Buffer, filename: string, mimetype: string): Promise<{ key: string; url: string }>;
  transcribeArticle(
    articleId: string,
  ): Promise<{ wordCount: number } | { kind: 'notFound' | 'noAudio' | 'error'; message: string }>;
}

function createOssClient(env: ApiEnv): OSS {
  const { OSS_SECRET_ID: accessKeyId, OSS_SECRET_KEY: accessKeySecret, OSS_BUCKET: bucket, OSS_REGION: region } = env;
  if (!accessKeyId || !accessKeySecret || !bucket || !region) throw new Error('OSS 配置不完整');
  return new OSS({ region, accessKeyId, accessKeySecret, authorizationV4: true, bucket, secure: true });
}

export function createMediaService({ prisma, env }: MediaServiceDependencies): MediaService {
  return {
    async uploadAudio(buffer, filename, mimetype) {
      const extension = filename.split('.').pop()?.toLowerCase();
      if (!extension || !allowedExtensions.has(extension)) {
        throw new Error('仅支持 MP3、WAV、OGG、AAC、M4A 音频');
      }
      if (buffer.length > 50 * 1024 * 1024) {
        throw new Error('音频文件不能超过 50MB');
      }

      const key = `audio/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const oss = createOssClient(env);
      await oss.put(key, buffer, {
        headers: { 'Content-Type': mimetype || 'application/octet-stream', 'x-oss-forbid-overwrite': 'true' },
      });

      const base =
        env.OSS_PUBLIC_BASE_URL?.replace(/\/$/, '') || `https://${env.OSS_BUCKET}.${env.OSS_REGION}.aliyuncs.com`;

      return { key, url: `${base}/${key}` };
    },

    async transcribeArticle(articleId) {
      const article = await prisma.article.findUnique({ where: { id: articleId } });
      if (!article) return { kind: 'notFound', message: '文章不存在' };
      if (!article.audioUrl) return { kind: 'noAudio', message: '该文章没有音频文件' };
      if (!env.DEEPGRAM_API_KEY) return { kind: 'error', message: '服务器未配置 DEEPGRAM_API_KEY' };

      const audio = await fetch(article.audioUrl);
      if (!audio.ok) throw new Error('下载音频文件失败');

      const extension = article.audioUrl.split('?')[0].split('.').pop()?.toLowerCase() || 'mp3';
      const mimeType = audioMimeTypes[extension] || 'audio/mpeg';
      const arrayBuffer = await audio.arrayBuffer();

      const result = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true', {
        method: 'POST',
        headers: {
          Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
          'Content-Type': mimeType,
        },
        body: Buffer.from(arrayBuffer),
      });

      const payload = (await result.json()) as {
        err_msg?: string;
        error?: string;
        results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string; words?: unknown }> }> };
      };
      if (!result.ok) throw new Error(`Deepgram 转写失败: ${payload.err_msg || payload.error || '未知错误'}`);

      const alternative = payload.results?.channels?.[0]?.alternatives?.[0];
      const words = wordTimestampSchema.safeParse(alternative?.words ?? []);
      if (!words.success || !words.data.length) throw new Error('Deepgram 未返回逐词时间戳，请确认音频清晰度');

      await prisma.article.update({ where: { id: article.id }, data: { wordTimestamps: words.data } });
      return { wordCount: words.data.length };
    },
  };
}
