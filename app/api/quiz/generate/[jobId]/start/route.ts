import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_req: NextRequest, { params }: { params: { jobId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '请先登录。' }, { status: 401 });

  const userId = (session.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: '无法识别当前用户。' }, { status: 401 });

  const job = await prisma.quizGenerationJob.findFirst({
    where: { id: params.jobId, userId, status: 'ready' },
    include: { questions: { orderBy: { createdAt: 'asc' } } },
  });
  if (!job) return NextResponse.json({ error: '题目尚未准备好或已开始答题。' }, { status: 409 });

  await prisma.quizGenerationJob.update({ where: { id: job.id }, data: { status: 'started' } });
  return NextResponse.json({
    questions: job.questions.map((question) => ({
      id: question.id,
      type: question.type,
      question: question.stem,
      options: question.options,
    })),
  });
}
