import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startQuizGenerationJob } from '@/lib/ai/quiz-generation-jobs';

export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '请先登录。' }, { status: 401 });

  const userId = (session.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: '无法识别当前用户。' }, { status: 401 });

  const job = await prisma.quizGenerationJob.findFirst({
    where: { id: params.jobId, userId },
    include: { questions: { orderBy: { createdAt: 'asc' } } },
  });
  if (!job) return NextResponse.json({ error: '出题任务不存在。' }, { status: 404 });

  if (job.status === 'pending' || job.status === 'processing') startQuizGenerationJob(job.id);

  return NextResponse.json({
    job: {
      id: job.id,
      articleId: job.articleId,
      status: job.status,
      error: job.error,
      questions:
        job.status === 'completed'
          ? job.questions.map((question) => ({
              id: question.id,
              type: question.type,
              question: question.stem,
              options: question.options,
            }))
          : undefined,
    },
  });
}
