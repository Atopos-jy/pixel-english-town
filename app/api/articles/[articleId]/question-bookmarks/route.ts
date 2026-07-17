import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const questionTypes = new Set(['multiple_choice', 'true_false', 'fill_blank']);
const categories = new Set(['all', 'always_correct', 'wrong']);

export async function GET(req: NextRequest, { params }: { params: { articleId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: '请先登录。' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || 'all';
  const type = searchParams.get('type') || 'all';
  const wrongCount = searchParams.get('wrongCount') || 'all';
  if (!categories.has(category) || (type !== 'all' && !questionTypes.has(type)) || !['all', '1', '2', '3'].includes(wrongCount)) {
    return NextResponse.json({ error: '筛选参数无效。' }, { status: 400 });
  }

  const stateWhere: Record<string, unknown> = { userId, isBookmarked: true };
  if (category === 'always_correct') {
    stateWhere.attemptCount = { gt: 0 };
    stateWhere.wrongCount = 0;
  }
  if (category === 'wrong') {
    stateWhere.wrongCount = wrongCount === '1' ? 1 : wrongCount === '2' ? 2 : wrongCount === '3' ? { gte: 3 } : { gt: 0 };
  }

  const states = await prisma.userQuestionState.findMany({
    where: {
      ...stateWhere,
      question: {
        articleId: params.articleId,
        createdByUserId: userId,
        ...(type === 'all' ? {} : { type }),
      },
    },
    include: {
      question: {
        select: { id: true, type: true, stem: true, options: true, knowledgePoints: true, createdAt: true },
      },
    },
    orderBy: [{ wrongCount: 'desc' }, { updatedAt: 'desc' }],
    take: 100,
  });

  return NextResponse.json({
    questions: states.map((state) => ({
      id: state.question.id,
      type: state.question.type,
      question: state.question.stem,
      options: Array.isArray(state.question.options) ? state.question.options : undefined,
      knowledgePoints: state.question.knowledgePoints,
      stats: {
        attemptCount: state.attemptCount,
        correctCount: state.correctCount,
        wrongCount: state.wrongCount,
        lastAnsweredAt: state.lastAnsweredAt,
      },
    })),
  });
}
