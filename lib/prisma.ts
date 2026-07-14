// @ts-ignore
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // 生产环境不记录日志，开发环境只记录错误
    log: process.env.NODE_ENV === 'production' ? [] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// 优雅关闭：在进程退出时断开连接
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// 定期检查连接健康状态（每5分钟）
if (process.env.NODE_ENV !== 'production') {
  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('[Prisma] 数据库连接健康');
    } catch (error) {
      console.error('[Prisma] 数据库连接异常:', error);
    }
  }, 5 * 60 * 1000);
}