import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyInstance } from 'fastify';
import { response } from '../utils/response.js';

function getClientErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return null;

  const { statusCode } = error;
  if (typeof statusCode !== 'number' || statusCode < 400 || statusCode >= 500) return null;

  return statusCode;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const statusCode = getClientErrorStatus(error) ?? 500;
    const code = statusCode === 500 ? ApiCode.INTERNAL_ERROR : ApiCode.VALIDATION_ERROR;
    const message = statusCode === 500 ? '服务器内部错误' : '请求参数错误';

    void reply.status(statusCode).send(response(code, message, null));
  });
}
