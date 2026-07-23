import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { response } from '../../utils/response.js';
import type { MediaService } from './service.js';
import { articleIdSchema } from './types.js';

export function createMediaController(service: MediaService) {
  return {
    async upload(request: FastifyRequest, reply: FastifyReply) {
      const file = await request.file();
      if (!file) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '未找到上传文件', null));

      try {
        const buffer = await file.toBuffer();
        const content = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const result = await service.uploadAudio(content, file.filename, file.mimetype);
        return reply.send(response(ApiCode.OK, '上传音频成功', result));
      } catch (error) {
        const message = error instanceof Error ? error.message : '上传失败';
        return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, message, null));
      }
    },

    async transcribe(request: FastifyRequest, reply: FastifyReply) {
      const parsed = articleIdSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '文章参数无效', null));
      }

      try {
        const result = await service.transcribeArticle(parsed.data.id);
        if ('kind' in result) {
          if (result.kind === 'notFound') {
            return reply.status(404).send(response(ApiCode.NOT_FOUND, result.message, null));
          }
          if (result.kind === 'noAudio' || result.kind === 'error') {
            const status = result.kind === 'noAudio' ? 400 : 500;
            return reply.status(status).send(response(ApiCode.INTERNAL_ERROR, result.message, null));
          }
        }
        return reply.send(response(ApiCode.OK, '时间戳生成成功', result));
      } catch (error) {
        const message = error instanceof Error ? error.message : '转写失败';
        return reply.status(500).send(response(ApiCode.INTERNAL_ERROR, message, null));
      }
    },
  };
}
