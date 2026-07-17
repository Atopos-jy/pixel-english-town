import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const getOwnedQuestion = async (questionId: string, userId: string) => prisma.articleQuestion.findFirst({
  where: { id: questionId, createdByUserId: userId },
  select: { id: true },
});

export async function POST(_: Request, { params }: { params: { questionId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: '请先登录。' }, { status: 401 });

  const question = await getOwnedQuestion(params.questionId, userId);
  if (!question) return NextResponse.json({ error: '题目不存在或无权访问。' }, { status: 404 });

  await prisma.userQuestionState.upsert({
    where: { userId_questionId: { userId, questionId: question.id } },
    create: { userId, questionId: question.id, isBookmarked: true },
    update: { isBookmarked: true },
  });

  return NextResponse.json({ isBookmarked: true });
}

export async function DELETE(_: Request, { params }: { params: { questionId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: '请先登录。' }, { status: 401 });

  const question = await getOwnedQuestion(params.questionId, userId);
  if (!question) return NextResponse.json({ error: '题目不存在或无权访问。' }, { status: 404 });

  await prisma.userQuestionState.updateMany({
    where: { userId, questionId: question.id },
    data: { isBookmarked: false },
  });

  return NextResponse.json({ isBookmarked: false });
}
