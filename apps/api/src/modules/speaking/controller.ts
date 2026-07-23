import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { response } from '../../utils/response.js';
import type { SpeakingService } from './service.js';

const wordMatchQuerySchema = z.object({ word: z.string().trim().min(1) });

export function createSpeakingController(service: SpeakingService) {
  return {
    async evaluate(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      if (!request.server.env.GROQ_API_KEY) {
        return reply.status(500).send(response(ApiCode.INTERNAL_ERROR, '服务器未配置 GROQ_API_KEY', null));
      }

      const audio = await request.file();
      if (!audio) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '缺少音频数据', null));

      const buffer = await audio.toBuffer();
      const content = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

      const result = await service.transcribe(content, audio.filename, audio.mimetype);

      if (result.kind === 'error') {
        return reply.status(502).send(response(ApiCode.INTERNAL_ERROR, result.message, null));
      }

      return reply.send(response(ApiCode.OK, '转录成功', { transcript: result.transcript }));
    },

    async matchWord(request: FastifyRequest, reply: FastifyReply) {
      const session = request.authenticatedSession;
      if (!session) return reply.status(401).send(response(ApiCode.UNAUTHORIZED, '登录已过期，请重新登录', null));

      if (!request.server.env.GROQ_API_KEY) {
        return reply.status(500).send(response(ApiCode.INTERNAL_ERROR, '服务器未配置 GROQ_API_KEY', null));
      }

      const parsed = wordMatchQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '缺少目标单词参数 word', null));
      }

      const audio = await request.file();
      if (!audio) return reply.status(400).send(response(ApiCode.VALIDATION_ERROR, '缺少音频数据', null));

      const buffer = await audio.toBuffer();
      const content = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

      const result = await service.matchWord(content, audio.filename, audio.mimetype, parsed.data.word);

      if (result.kind === 'error') {
        return reply.status(502).send(response(ApiCode.INTERNAL_ERROR, result.message, null));
      }

      return reply.send(
        response(
          ApiCode.OK,
          result.kind === 'matched' ? '发音正确' : `识别到 "${result.transcript}"，与目标 "${result.word}" 不匹配`,
          {
            matched: result.kind === 'matched',
            word: result.word,
            transcript: result.transcript,
            similarity: result.similarity,
          },
        ),
      );
    },
  };
}
