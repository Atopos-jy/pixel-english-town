import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const pickRandom = <T,>(items: T[], count: number) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled.slice(0, count);
};

export async function POST(_: Request, { params }: { params: { articleId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: '请先登录。' }, { status: 401 });

  const states = await prisma.userQuestionState.findMany({
    where: {
      userId,
      isBookmarked: true,
      wrongCount: { gt: 0 },
      question: { articleId: params.articleId, createdByUserId: userId },
    },
    include: {
      question: { select: { id: true, type: true, stem: true, options: true } },
    },
    take: 100,
  });

  if (!states.length) return NextResponse.json({ error: '当前文章没有可练习的收藏错题。' }, { status: 422 });

  const selected = pickRandom(states, 6);
  return NextResponse.json({
    availableCount: states.length,
    questions: selected.map(({ question }) => ({
      id: question.id,
      type: question.type,
      question: question.stem,
      options: Array.isArray(question.options) ? question.options : undefined,
    })),
  });
}
