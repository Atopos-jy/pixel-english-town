import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Aggregate = {
  bookmarkedCount: number;
  attemptedQuestionCount: number;
  attemptCount: number;
  correctCount: number;
  wrongCount: number;
};

const createAggregate = (): Aggregate => ({ bookmarkedCount: 0, attemptedQuestionCount: 0, attemptCount: 0, correctCount: 0, wrongCount: 0 });
const toAccuracy = (correctCount: number, attemptCount: number) => attemptCount ? Math.round((correctCount / attemptCount) * 100) : null;

export async function GET(_: Request, { params }: { params: { articleId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: '请先登录。' }, { status: 401 });

  const states = await prisma.userQuestionState.findMany({
    where: {
      userId,
      isBookmarked: true,
      question: { articleId: params.articleId, createdByUserId: userId },
    },
    include: { question: { select: { type: true, knowledgePoints: true } } },
  });

  const overview = createAggregate();
  const byType = new Map<string, Aggregate>();
  const byKnowledgePoint = new Map<string, Aggregate>();

  for (const state of states) {
    overview.bookmarkedCount += 1;
    overview.attemptCount += state.attemptCount;
    overview.correctCount += state.correctCount;
    overview.wrongCount += state.wrongCount;
    if (state.attemptCount > 0) overview.attemptedQuestionCount += 1;

    const typeAggregate = byType.get(state.question.type) || createAggregate();
    typeAggregate.bookmarkedCount += 1;
    typeAggregate.attemptCount += state.attemptCount;
    typeAggregate.correctCount += state.correctCount;
    typeAggregate.wrongCount += state.wrongCount;
    if (state.attemptCount > 0) typeAggregate.attemptedQuestionCount += 1;
    byType.set(state.question.type, typeAggregate);

    const knowledgePoints = Array.isArray(state.question.knowledgePoints)
      ? state.question.knowledgePoints.filter((point): point is string => typeof point === 'string')
      : [];
    for (const point of knowledgePoints) {
      const pointAggregate = byKnowledgePoint.get(point) || createAggregate();
      pointAggregate.bookmarkedCount += 1;
      pointAggregate.attemptCount += state.attemptCount;
      pointAggregate.correctCount += state.correctCount;
      pointAggregate.wrongCount += state.wrongCount;
      if (state.attemptCount > 0) pointAggregate.attemptedQuestionCount += 1;
      byKnowledgePoint.set(point, pointAggregate);
    }
  }

  const formatAggregate = (key: string, aggregate: Aggregate) => ({
    key,
    ...aggregate,
    accuracy: toAccuracy(aggregate.correctCount, aggregate.attemptCount),
  });
  const knowledgePointPerformance = [...byKnowledgePoint.entries()]
    .map(([key, aggregate]) => formatAggregate(key, aggregate))
    .sort((left, right) => (right.wrongCount - left.wrongCount) || ((left.accuracy ?? 101) - (right.accuracy ?? 101)));
  const weakPoints = knowledgePointPerformance
    .filter((point) => point.attemptCount >= 3 && point.wrongCount > 0)
    .slice(0, 3);

  return NextResponse.json({
    overview: { ...overview, accuracy: toAccuracy(overview.correctCount, overview.attemptCount) },
    typePerformance: ['multiple_choice', 'true_false', 'fill_blank'].map((type) => formatAggregate(type, byType.get(type) || createAggregate())),
    knowledgePointPerformance,
    weakPoints,
  });
}
