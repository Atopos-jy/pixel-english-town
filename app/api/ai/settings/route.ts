import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { getPublicAiSettings, saveAiConfiguration } from '@/lib/ai/settings';
import { getAiConfigurationValidationError } from '@/lib/ai/quiz-provider';

const getUserId = (session: { user?: unknown } | null) => (session?.user as { id?: string } | undefined)?.id;

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) return NextResponse.json({ error: '请先登录。' }, { status: 401 });

  return NextResponse.json({ settings: await getPublicAiSettings(userId) });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) return NextResponse.json({ error: '请先登录。' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const configurationError = getAiConfigurationValidationError(body?.configuration);
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 400 });
  }

  try {
    await saveAiConfiguration(userId, body.configuration);
    return NextResponse.json({ settings: await getPublicAiSettings(userId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 设置保存失败。';
    console.error('AI settings save failed', { userId, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
