import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { dbRequestLimiter } from './request-limiter';

const RETRYABLE_CODES = new Set(['P2024', 'P1001', 'P1017']);

function isRetryableError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && RETRYABLE_CODES.has(error.code);
}

/**
 * 带重试机制和限流的数据库操作包装器
 */
export async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3, retryDelay = 500): Promise<T> {
  return dbRequestLimiter.execute(async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        lastError = error;

        if (!isRetryableError(error) || attempt === maxRetries) {
          throw error;
        }

        const currentDelay = retryDelay * 2 ** attempt;
        console.warn(
          `数据库操作失败 (${attempt + 1}/${maxRetries + 1}), ` + `错误: ${error.code}, ${currentDelay}ms 后重试...`,
        );

        await new Promise((resolve) => setTimeout(resolve, currentDelay));
      }
    }

    throw lastError;
  });
}

/**
 * 检查数据库连接健康状态
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error: unknown) {
    console.error('数据库健康检查失败:', error);
    return false;
  }
}
