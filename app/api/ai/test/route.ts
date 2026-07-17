import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAiConfigurationValidationError, getQuizProvider, isSupportedAiConfiguration } from '@/lib/ai/quiz-provider';
import { takeAiRequestSlot } from '@/lib/ai/rate-limit';
import { getStoredAiConfiguration } from '@/lib/ai/settings';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '请先登录。' }, { status: 401 });

  const userId = (session.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: '无法识别当前用户。' }, { status: 401 });

  const rateLimit = takeAiRequestSlot(session.user?.email || 'anonymous', 'test');
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: `测试过于频繁，请在 ${rateLimit.retryAfterSeconds} 秒后重试。` }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const directConfiguration = body?.configuration;
  const directConfigurationError = getAiConfigurationValidationError(directConfiguration);
  if (directConfiguration && directConfigurationError) {
    return NextResponse.json({ error: directConfigurationError }, { status: 400 });
  }
  let configuration;
  try {
    configuration = isSupportedAiConfiguration(directConfiguration)
      ? directConfiguration
      : await getStoredAiConfiguration(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法读取 AI 设置。';
    console.error('AI settings read failed for connection test', { userId, message });
    return NextResponse.json({ error: '无法读取已保存的 AI 设置，请检查服务器加密配置。' }, { status: 500 });
  }
  if (!configuration) return NextResponse.json({ error: '请填写 API Key，或先保存 AI 设置。' }, { status: 400 });

  try {
    await getQuizProvider(configuration.provider).testConnection(configuration);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 服务暂时不可用。';
    console.error('AI connection test failed', { provider: configuration.provider, model: configuration.model, message });
    return NextResponse.json({ error: `连接失败：${message}` }, { status: 502 });
  }
}
