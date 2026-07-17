import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const normalizeFillAnswer = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

export async function POST(req: NextRequest, { params }: { params: { questionId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: '请先登录。' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.answer !== 'string' || !body.answer.trim()) {
    return NextResponse.json({ error: '请提交有效答案。' }, { status: 400 });
  }

  const question = await prisma.articleQuestion.findFirst({
    where: { id: params.questionId, createdByUserId: userId },
  });
  if (!question) return NextResponse.json({ error: '题目不存在或无权访问。' }, { status: 404 });

  const answer = body.answer.trim();
  const correct = question.type === 'multiple_choice'
    ? answer.toUpperCase() === question.correctAnswer.toUpperCase()
    : question.type === 'true_false'
      ? answer.toLowerCase() === question.correctAnswer.toLowerCase()
      : normalizeFillAnswer(answer) === normalizeFillAnswer(question.correctAnswer);

  await prisma.userQuestionState.upsert({
    where: { userId_questionId: { userId, questionId: question.id } },
    create: {
      userId,
      questionId: question.id,
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

  return NextResponse.json({
    correct,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
  });
}
