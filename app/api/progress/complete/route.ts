import { Prisma, PlazaActivityType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { BADGES } from '@/constants';
import { prisma } from '@/lib/prisma';
import { publishPlazaEvent } from '@/lib/redis';
import { Difficulty } from '@/types';

type CompleteRequest = { articleId?: string; difficulty?: Difficulty };

function getShanghaiDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const body = (await request.json()) as CompleteRequest;
  if (!body.articleId || !body.difficulty) return NextResponse.json({ error: '文章参数无效' }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const progress = await tx.userProgress.findUnique({ where: { userId: session.user.id } });
      const article = await tx.article.findUnique({ where: { id: body.articleId } });
      if (!progress || !article) throw new Error('NOT_FOUND');

      await tx.articleCompletion.create({
        data: { userId: session.user.id, articleId: body.articleId, learningDate: getShanghaiDate() },
      });

      const completedIds = progress.completedArticleIds as string[];
      const badges = progress.badges as string[];
      const totalArticlesCompleted = progress.totalArticlesCompleted + 1;
      const currentStats = {
        totalDaysLearned: progress.totalDaysLearned,
        totalArticlesCompleted,
        currentStreak: progress.currentStreak,
        longestStreak: progress.longestStreak,
        articlesByDifficulty: { [Difficulty.Beginner]: progress.beginnerCount, [Difficulty.Intermediate]: progress.intermediateCount, [Difficulty.Advanced]: progress.advancedCount },
        lastCompletedDate: progress.lastCompletedDate,
        activityLog: progress.activityLog as Record<string, number>,
        badges,
      };
      const newBadges = BADGES.filter((badge) => !badges.includes(badge.id) && badge.condition(currentStats));
      const nextBadges = [...badges, ...newBadges.map((badge) => badge.id)];
      const activity = await tx.plazaActivity.create({
        data: { userId: session.user.id, type: PlazaActivityType.ARTICLE_COMPLETED, content: `${session.user.name || '学习者'} 完成了《${article.titleZh}》`, metadata: { articleId: article.id, articleTitle: article.titleZh } },
      });
      await tx.userProgress.update({ where: { id: progress.id }, data: { totalArticlesCompleted, completedArticleIds: [...completedIds, body.articleId], badges: nextBadges } });
      return { activity, newBadges: newBadges.map((badge) => badge.name) };
    });

    await publishPlazaEvent({ type: 'feed.created', activity: { ...result.activity, createdAt: result.activity.createdAt.toISOString() } }).catch((error: unknown) => console.error('发布广场事件失败:', error));
    return NextResponse.json({ success: true, message: '学习完成', data: result });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ success: false, message: '文章已完成', data: null }, { status: 409 });
    if (error instanceof Error && error.message === 'NOT_FOUND') return NextResponse.json({ success: false, message: '文章或进度不存在', data: null }, { status: 404 });
    console.error('完成学习失败:', error);
    return NextResponse.json({ success: false, message: '完成学习失败', data: null }, { status: 500 });
  }
}
