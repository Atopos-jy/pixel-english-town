import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getQuizProvider, isSupportedAiConfiguration } from '@/lib/ai/quiz-provider';
import { takeAiRequestSlot } from '@/lib/ai/rate-limit';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '请先登录。' }, { status: 401 });

  const rateLimit = takeAiRequestSlot(session.user?.email || 'anonymous', 'test');
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: `测试过于频繁，请在 ${rateLimit.retryAfterSeconds} 秒后重试。` }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !isSupportedAiConfiguration(body.configuration)) {
    return NextResponse.json({ error: 'AI 厂商、模型或 API Key 无效。' }, { status: 400 });
  }

  try {
    await getQuizProvider(body.configuration.provider).testConnection(body.configuration);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 服务暂时不可用。';
    console.error('AI connection test failed', { provider: body.configuration.provider, model: body.configuration.model, message });
    return NextResponse.json({ error: `连接失败：${message}` }, { status: 502 });
  }
}
