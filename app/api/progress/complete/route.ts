import { Prisma, PlazaActivityType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { BADGES } from '@/constants';
import { authOptions } from '@/lib/auth';
import { getShanghaiDate, invalidatePlazaLeaderboards } from '@/lib/plaza-leaderboards';
import { prisma } from '@/lib/prisma';
import { publishPlazaEvent } from '@/lib/redis';
import { Difficulty, type UserProgress } from '@/types';
import type { PlazaActivity } from '@/types/plaza';

type CompleteRequest = {
  articleId?: string;
  difficulty?: Difficulty;
};

function getDayDifference(earlierDate: string, laterDate: string): number {
  const earlierTime = Date.parse(`${earlierDate}T00:00:00.000Z`);
  const laterTime = Date.parse(`${laterDate}T00:00:00.000Z`);
  return Math.round((laterTime - earlierTime) / (24 * 60 * 60 * 1_000));
}

function serializeActivity(activity: {
  id: string;
  type: PlazaActivityType;
  content: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
  };
}): PlazaActivity {
  const metadata =
    activity.metadata && typeof activity.metadata === 'object' && !Array.isArray(activity.metadata)
      ? Object.fromEntries(
          Object.entries(activity.metadata).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        )
      : null;

  return {
    id: activity.id,
    type: activity.type,
    content: activity.content,
    metadata,
    user: {
      id: activity.user.id,
      name: activity.user.name || '学习者',
    },
    createdAt: activity.createdAt.toISOString(),
  };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: '请先登录', data: null }, { status: 401 });
  }

  let body: CompleteRequest;
  try {
    body = (await request.json()) as CompleteRequest;
  } catch {
    return NextResponse.json({ success: false, message: '请求数据格式错误', data: null }, { status: 400 });
  }

  if (!body.articleId || !body.difficulty) {
    return NextResponse.json({ success: false, message: '文章参数无效', data: null }, { status: 400 });
  }

  const learningDate = getShanghaiDate();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [progress, article] = await Promise.all([
        tx.userProgress.findUnique({ where: { userId: session.user.id } }),
        tx.article.findUnique({ where: { id: body.articleId } }),
      ]);
      if (!progress || !article) throw new Error('NOT_FOUND');

      await tx.articleCompletion.create({
        data: {
          userId: session.user.id,
          articleId: body.articleId,
          learningDate,
        },
      });

      const completedIds = progress.completedArticleIds as string[];
      const earnedBadgeIds = progress.badges as string[];
      const activityLog = {
        ...(progress.activityLog as Record<string, number>),
        [learningDate]: ((progress.activityLog as Record<string, number>)[learningDate] || 0) + 1,
      };
      const isNewLearningDay = progress.lastCompletedDate !== learningDate;
      const currentStreak = isNewLearningDay
        ? progress.lastCompletedDate && getDayDifference(progress.lastCompletedDate, learningDate) === 1
          ? progress.currentStreak + 1
          : 1
        : progress.currentStreak;
      const totalDaysLearned = isNewLearningDay ? progress.totalDaysLearned + 1 : progress.totalDaysLearned;
      const beginnerCount = progress.beginnerCount + (body.difficulty === Difficulty.Beginner ? 1 : 0);
      const intermediateCount = progress.intermediateCount + (body.difficulty === Difficulty.Intermediate ? 1 : 0);
      const advancedCount = progress.advancedCount + (body.difficulty === Difficulty.Advanced ? 1 : 0);
      const totalArticlesCompleted = progress.totalArticlesCompleted + 1;
      const longestStreak = Math.max(progress.longestStreak, currentStreak);
      const currentStats = {
        totalDaysLearned,
        totalArticlesCompleted,
        currentStreak,
        longestStreak,
        articlesByDifficulty: {
          [Difficulty.Beginner]: beginnerCount,
          [Difficulty.Intermediate]: intermediateCount,
          [Difficulty.Advanced]: advancedCount,
        },
        lastCompletedDate: learningDate,
        activityLog,
        badges: earnedBadgeIds,
      };
      const newBadges = BADGES.filter((badge) => !earnedBadgeIds.includes(badge.id) && badge.condition(currentStats));
      const nextBadgeIds = [...earnedBadgeIds, ...newBadges.map((badge) => badge.id)];

      const articleActivity = await tx.plazaActivity.create({
        data: {
          userId: session.user.id,
          type: PlazaActivityType.ARTICLE_COMPLETED,
          content: `${session.user.name || '学习者'} 完成了《${article.titleZh}》`,
          metadata: {
            articleId: article.id,
            articleTitle: article.titleZh,
          },
        },
        include: { user: { select: { id: true, name: true } } },
      });
      const badgeActivities = await Promise.all(
        newBadges.map((badge) =>
          tx.plazaActivity.create({
            data: {
              userId: session.user.id,
              type: PlazaActivityType.BADGE_EARNED,
              content: `${session.user.name || '学习者'} 获得了徽章「${badge.name}」`,
              metadata: {
                badgeCode: badge.id,
                badgeName: badge.name,
              },
            },
            include: { user: { select: { id: true, name: true } } },
          }),
        ),
      );

      await tx.userProgress.update({
        where: { id: progress.id },
        data: {
          totalDaysLearned,
          totalArticlesCompleted,
          currentStreak,
          longestStreak,
          beginnerCount,
          intermediateCount,
          advancedCount,
          lastCompletedDate: learningDate,
          activityLog,
          badges: nextBadgeIds,
          completedArticleIds: [...completedIds, body.articleId],
        },
      });

      const formattedProgress: UserProgress = {
        completedArticleIds: [...completedIds, body.articleId],
        stats: {
          ...currentStats,
          badges: nextBadgeIds,
        },
      };

      return {
        progress: formattedProgress,
        newBadges: newBadges.map((badge) => badge.name),
        activities: [articleActivity, ...badgeActivities].map(serializeActivity),
      };
    });

    await invalidatePlazaLeaderboards(learningDate);

    for (const activity of result.activities) {
      await publishPlazaEvent({
        type: 'feed.created',
        activity,
      }).catch((error: unknown) => {
        console.error('[plaza] 发布学习动态失败', error);
      });
    }
    for (const board of ['daily', 'streak'] as const) {
      await publishPlazaEvent({
        type: 'leaderboard.updated',
        board,
      }).catch((error: unknown) => {
        console.error('[plaza] 发布排行榜更新失败', error);
      });
    }

    return NextResponse.json({
      success: true,
      message: '学习完成',
      data: {
        progress: result.progress,
        newBadges: result.newBadges,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ success: false, message: '文章已完成', data: null }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ success: false, message: '文章或进度不存在', data: null }, { status: 404 });
    }

    console.error('完成学习失败:', error);
    return NextResponse.json({ success: false, message: '完成学习失败', data: null }, { status: 500 });
  }
}
