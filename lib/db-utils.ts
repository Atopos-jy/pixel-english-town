import { prisma } from './prisma';
import { dbRequestLimiter } from './request-limiter';

/**
 * 带重试机制和限流的数据库操作包装器
 * @param operation 数据库操作函数
 * @param maxRetries 最大重试次数
 * @param retryDelay 重试延迟（毫秒）
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 500
): Promise<T> {
  // 使用限流器控制并发
  return dbRequestLimiter.execute(async () => {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // 只对连接相关错误进行重试
      const isConnectionError = 
        error.code === 'P2024' || // 连接池超时
        error.code === 'P1001' || // 无法连接到数据库
        error.code === 'P1017';   // 服务器关闭连接
      
      if (!isConnectionError || attempt === maxRetries) {
        throw error;
      }
      
      // 使用指数退避策略：每次重试延迟翻倍
      const currentDelay = retryDelay * Math.pow(2, attempt);
      console.warn(`数据库操作失败 (尝试 ${attempt + 1}/${maxRetries + 1}), 错误: ${error.code}, ${currentDelay}ms 后重试...`);
      
      // 等待后重试（不需要手动重连，Prisma会自动处理）
      await new Promise(resolve => setTimeout(resolve, currentDelay));
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
  } catch (error) {
    console.error('数据库健康检查失败:', error);
    return false;
  }
}
