import type { PrismaClient } from '@prisma/client';

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
const random = <T>(items: T[], count: number) => [...items].sort(() => Math.random() - 0.5).slice(0, count);

export function createQuestionService(prisma: PrismaClient) {
  const owned = (userId: string, questionId: string) =>
    prisma.articleQuestion.findFirst({ where: { id: questionId, createdByUserId: userId } });
  return {
    async attempt(userId: string, questionId: string, answer: string) {
      const question = await owned(userId, questionId);
      if (!question) return null;
      const correct =
        question.type === 'multiple_choice'
          ? answer.toUpperCase() === question.correctAnswer.toUpperCase()
          : question.type === 'true_false'
            ? answer.toLowerCase() === question.correctAnswer.toLowerCase()
            : normalize(answer) === normalize(question.correctAnswer);
      await prisma.userQuestionState.upsert({
        where: { userId_questionId: { userId, questionId } },
        create: {
          userId,
          questionId,
          attemptCount: 1,
          correctCount: correct ? 1 : 0,
          wrongCount: correct ? 0 : 1,
          lastAnswer: answer,
          lastAnsweredAt: new Date(),
        },
        update: {
          attemptCount: { increment: 1 },
          ...(correct ? { correctCount: { increment: 1 } } : { wrongCount: { increment: 1 } }),
          lastAnswer: answer,
          lastAnsweredAt: new Date(),
        },
      });
      return { correct, correctAnswer: question.correctAnswer, explanation: question.explanation };
    },
    async bookmark(userId: string, questionId: string, value: boolean) {
      const question = await owned(userId, questionId);
      if (!question) return null;
      if (value)
        await prisma.userQuestionState.upsert({
          where: { userId_questionId: { userId, questionId } },
          create: { userId, questionId, isBookmarked: true },
          update: { isBookmarked: true },
        });
      else await prisma.userQuestionState.updateMany({ where: { userId, questionId }, data: { isBookmarked: false } });
      return { isBookmarked: value };
    },
    async bookmarks(userId: string, articleId: string, category: string, type: string, wrongCount: string) {
      const stateWhere: Record<string, unknown> = { userId, isBookmarked: true };
      if (category === 'always_correct') Object.assign(stateWhere, { attemptCount: { gt: 0 }, wrongCount: 0 });
      if (category === 'wrong')
        stateWhere.wrongCount =
          wrongCount === '1' ? 1 : wrongCount === '2' ? 2 : wrongCount === '3' ? { gte: 3 } : { gt: 0 };
      const states = await prisma.userQuestionState.findMany({
        where: { ...stateWhere, question: { articleId, createdByUserId: userId, ...(type === 'all' ? {} : { type }) } },
        include: { question: { select: { id: true, type: true, stem: true, options: true, knowledgePoints: true } } },
        orderBy: [{ wrongCount: 'desc' }, { updatedAt: 'desc' }],
        take: 100,
      });
      return states.map((state) => ({
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
      }));
    },
    async practice(userId: string, articleId: string) {
      const states = await prisma.userQuestionState.findMany({
        where: { userId, isBookmarked: true, wrongCount: { gt: 0 }, question: { articleId, createdByUserId: userId } },
        include: { question: { select: { id: true, type: true, stem: true, options: true } } },
        take: 100,
      });
      return states.length
        ? {
            availableCount: states.length,
            questions: random(states, 6).map(({ question }) => ({
              id: question.id,
              type: question.type,
              question: question.stem,
              options: Array.isArray(question.options) ? question.options : undefined,
            })),
          }
        : null;
    },
    async analysis(userId: string, articleId: string) {
      const states = await prisma.userQuestionState.findMany({
        where: { userId, isBookmarked: true, question: { articleId, createdByUserId: userId } },
        include: { question: { select: { type: true, knowledgePoints: true } } },
      });
      const make = () => ({
        bookmarkedCount: 0,
        attemptedQuestionCount: 0,
        attemptCount: 0,
        correctCount: 0,
        wrongCount: 0,
      });
      const add = (a: ReturnType<typeof make>, s: (typeof states)[number]) => {
        a.bookmarkedCount++;
        a.attemptCount += s.attemptCount;
        a.correctCount += s.correctCount;
        a.wrongCount += s.wrongCount;
        if (s.attemptCount) a.attemptedQuestionCount++;
      };
      const overview = make();
      const types = new Map<string, ReturnType<typeof make>>();
      const points = new Map<string, ReturnType<typeof make>>();
      for (const state of states) {
        add(overview, state);
        const t = types.get(state.question.type) || make();
        add(t, state);
        types.set(state.question.type, t);
        for (const point of Array.isArray(state.question.knowledgePoints)
          ? state.question.knowledgePoints.filter((p): p is string => typeof p === 'string')
          : []) {
          const p = points.get(point) || make();
          add(p, state);
          points.set(point, p);
        }
      }
      const format = (key: string, value: ReturnType<typeof make>) => ({
        key,
        ...value,
        accuracy: value.attemptCount ? Math.round((value.correctCount / value.attemptCount) * 100) : null,
      });
      const knowledgePointPerformance = [...points]
        .map(([key, value]) => format(key, value))
        .sort((a, b) => b.wrongCount - a.wrongCount || (a.accuracy ?? 101) - (b.accuracy ?? 101));
      return {
        overview: format('overview', overview),
        typePerformance: ['multiple_choice', 'true_false', 'fill_blank'].map((key) =>
          format(key, types.get(key) || make()),
        ),
        knowledgePointPerformance,
        weakPoints: knowledgePointPerformance
          .filter((point) => point.attemptCount >= 3 && point.wrongCount > 0)
          .slice(0, 3),
      };
    },
  };
}
