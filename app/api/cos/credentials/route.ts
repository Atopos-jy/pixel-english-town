import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

/**
 * GET /api/cos/credentials
 * 获取腾讯云COS临时密钥（管理员专用）
 */
export async function GET() {
  // 验证管理员权限
  const authResult = await requireAdmin();
  
  if (authResult.error) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    // 这里需要调用腾讯云STS服务获取临时密钥
    // 为了安全，不应该在前端直接使用永久密钥
    // 
    // 方案1: 使用腾讯云STS SDK获取临时密钥
    // 方案2: 如果只是简单使用，可以返回配置的永久密钥（不推荐）
    
    // 临时方案：返回环境变量中的密钥（仅用于开发测试）
    const credentials = {
      tmpSecretId: process.env.COS_SECRET_ID,
      tmpSecretKey: process.env.COS_SECRET_KEY,
      sessionToken: '', // 如果使用临时密钥，这里需要填写
      expiredTime: Date.now() + 3600 * 1000, // 1小时后过期
    };

    return NextResponse.json(credentials);
  } catch (error) {
    console.error('获取COS凭证失败:', error);
    return NextResponse.json(
      { error: '获取上传凭证失败' },
      { status: 500 }
    );
  }
}
