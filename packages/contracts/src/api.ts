/** Fastify 对外接口唯一响应结构。 */
export interface ApiResponse<T> {
  code: number;
  data: T | null;
  message: string;
}

export const ApiCode = {
  OK: 0,
  VALIDATION_ERROR: 40001,
  UNAUTHORIZED: 40101,
  FORBIDDEN: 40301,
  NOT_FOUND: 40401,
  CONFLICT: 40901,
  TOO_MANY_REQUESTS: 42901,
  INTERNAL_ERROR: 50001,
} as const;
