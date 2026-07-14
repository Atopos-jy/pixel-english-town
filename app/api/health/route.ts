import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/db-utils';

/**
 * GET /api/health
 * 健康检查端点 - 检查数据库连接状态
 */
export async function GET() {
  try {
    const startTime = Date.now();
    const isHealthy = await checkDatabaseHealth();
    const responseTime = Date.now() - startTime;

    if (isHealthy) {
      return NextResponse.json({
        status: 'healthy',
        database: 'connected',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        status: 'unhealthy',
        database: 'disconnected',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      database: 'error',
      error: error instanceof Error ? error.message : '未知错误',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
