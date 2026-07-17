import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { takeAiRequestSlot } from '@/lib/ai/rate-limit';
import { prisma } from '@/lib/prisma';
import { startQuizGenerationJob } from '@/lib/ai/quiz-generation-jobs';

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
  if (!body || typeof body.articleId !== 'string' || !body.articleId) {
    return NextResponse.json({ error: '缺少文章内容。' }, { status: 400 });
  }

  const article = await prisma.article.findUnique({ where: { id: body.articleId }, select: { id: true } });
  if (!article) return NextResponse.json({ error: '文章不存在。' }, { status: 404 });

  const existingJob = await prisma.quizGenerationJob.findFirst({
    where: { userId, articleId: article.id, status: { in: ['pending', 'processing'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (existingJob) {
    startQuizGenerationJob(existingJob.id);
    return NextResponse.json({ job: { id: existingJob.id, status: existingJob.status } });
  }

  const job = await prisma.quizGenerationJob.create({ data: { userId, articleId: article.id } });
  startQuizGenerationJob(job.id);
  return NextResponse.json({ job: { id: job.id, status: job.status } }, { status: 202 });
}
