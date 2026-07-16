import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Difficulty } from '@/types';
import { getQuizProvider } from '@/lib/ai/quiz-provider';
import { takeAiRequestSlot } from '@/lib/ai/rate-limit';
import { getStoredAiConfiguration } from '@/lib/ai/settings';

const MAX_ARTICLE_CHARACTERS = 40_000;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '请先登录。' }, { status: 401 });

  const userId = (session.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: '无法识别当前用户。' }, { status: 401 });

  const rateLimit = takeAiRequestSlot(session.user?.email || 'anonymous', 'generate');
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: `请求过于频繁，请在 ${rateLimit.retryAfterSeconds} 秒后重试。` }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.articleText !== 'string' || !body.articleText.trim()) {
    return NextResponse.json({ error: '缺少文章内容。' }, { status: 400 });
  }
  if (body.articleText.length > MAX_ARTICLE_CHARACTERS) {
    return NextResponse.json({ error: '文章内容过长，暂时无法出题。' }, { status: 400 });
  }
  if (!Object.values(Difficulty).includes(body.difficulty)) {
    return NextResponse.json({ error: '文章难度无效。' }, { status: 400 });
  }

  let configuration;
  try {
    configuration = await getStoredAiConfiguration(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法读取 AI 设置。';
    console.error('AI settings read failed for quiz generation', { userId, message });
    return NextResponse.json({ error: '无法读取已保存的 AI 设置，请检查服务器加密配置。' }, { status: 500 });
  }
  if (!configuration) {
    return NextResponse.json({ error: '请先在 AI 设置中保存可用的厂商、模型和 API Key。' }, { status: 409 });
  }

  try {
    const questions = await getQuizProvider(configuration.provider).generateQuiz(configuration, {
      articleText: body.articleText,
      difficulty: body.difficulty,
    });
    return NextResponse.json({ questions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 服务暂时不可用。';
    console.error('Quiz generation failed', { provider: configuration.provider, model: configuration.model, message });
    return NextResponse.json({ error: `出题失败：${message}` }, { status: 502 });
  }
}
