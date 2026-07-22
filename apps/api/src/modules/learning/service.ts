import { PlazaActivityType, Prisma, type PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { CompleteArticleInput, UserProgressResponse } from './types.js';

type CompletionResult =
  | { kind: 'completed'; progress: UserProgressResponse; newBadges: string[] }
  | { kind: 'conflict' }
  | { kind: 'notFound' };
type Badge = {
  id: string;
  name: string;
  enabled: boolean;
  rule: {
    metric: 'totalArticlesCompleted' | 'currentStreak' | 'beginnerCount' | 'intermediateCount' | 'advancedCount';
    minimum: number;
  };
};
const defaultBadges: Badge[] = [
  { id: 'badge-first-step', name: '初次启程', enabled: true, rule: { metric: 'totalArticlesCompleted', minimum: 1 } },
  { id: 'badge-on-fire', name: '状态火热', enabled: true, rule: { metric: 'currentStreak', minimum: 3 } },
  { id: 'badge-scholar', name: '博学者', enabled: true, rule: { metric: 'totalArticlesCompleted', minimum: 10 } },
  { id: 'badge-master', name: '阅读大师', enabled: true, rule: { metric: 'advancedCount', minimum: 1 } },
];
const date = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00.000Z`) - Date.parse(`${a}T00:00:00.000Z`)) / 86_400_000);
const strings = (value: Prisma.JsonValue): string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
const log = (value: Prisma.JsonValue): Record<string, number> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
      )
    : {};
const badgesFromConfig = (value: Prisma.JsonValue | null): Badge[] => {
  if (!Array.isArray(value)) return defaultBadges;
  const parsed = value
    .filter(
      (item): item is Badge =>
        typeof item === 'object' && item !== null && 'id' in item && 'name' in item && 'rule' in item,
    )
    .map((item) => ({ ...item, enabled: item.enabled !== false }));
  return parsed.length ? parsed : defaultBadges;
};

export function createLearningService({ prisma, redis }: { prisma: PrismaClient; redis: Redis }) {
  const publish = async (payload: object) => {
    const version = await redis.incr('plaza:version');
    await redis.publish('plaza:events', JSON.stringify({ ...payload, version }));
  };
  const format = (progress: {
    completedArticleIds: Prisma.JsonValue;
    totalDaysLearned: number;
    totalArticlesCompleted: number;
    currentStreak: number;
    longestStreak: number;
    beginnerCount: number;
    intermediateCount: number;
    advancedCount: number;
    lastCompletedDate: string | null;
    activityLog: Prisma.JsonValue;
    badges: Prisma.JsonValue;
  }): UserProgressResponse => ({
    completedArticleIds: strings(progress.completedArticleIds),
    stats: {
      totalDaysLearned: progress.totalDaysLearned,
      totalArticlesCompleted: progress.totalArticlesCompleted,
      currentStreak: progress.currentStreak,
      longestStreak: progress.longestStreak,
      articlesByDifficulty: {
        Beginner: progress.beginnerCount,
        Intermediate: progress.intermediateCount,
        Advanced: progress.advancedCount,
      },
      lastCompletedDate: progress.lastCompletedDate,
      activityLog: log(progress.activityLog),
      badges: strings(progress.badges),
    },
  });
  return {
    async getProgress(userId: string) {
      let progress = await prisma.userProgress.findUnique({ where: { userId } });
      if (!progress)
        progress = await prisma.userProgress.create({
          data: { userId, activityLog: {}, badges: [], completedArticleIds: [] },
        });
      return format(progress);
    },
    async complete(userId: string, userName: string | null, input: CompleteArticleInput): Promise<CompletionResult> {
      const learningDate = date();
      try {
        const config = await prisma.badgeConfig.findUnique({ where: { id: 'default' } });
        const badges = badgesFromConfig(config?.badges ?? null);
        const result = await prisma.$transaction(async (tx) => {
          const [progress, article] = await Promise.all([
            tx.userProgress.findUnique({ where: { userId } }),
            tx.article.findUnique({ where: { id: input.articleId } }),
          ]);
          if (!progress || !article) return null;
          await tx.articleCompletion.create({ data: { userId, articleId: input.articleId, learningDate } });
          const completedArticleIds = [...strings(progress.completedArticleIds), input.articleId];
          const activityLog = log(progress.activityLog);
          activityLog[learningDate] = (activityLog[learningDate] || 0) + 1;
          const newDay = progress.lastCompletedDate !== learningDate;
          const currentStreak = newDay
            ? progress.lastCompletedDate && daysBetween(progress.lastCompletedDate, learningDate) === 1
              ? progress.currentStreak + 1
              : 1
            : progress.currentStreak;
          const stats = {
            totalDaysLearned: newDay ? progress.totalDaysLearned + 1 : progress.totalDaysLearned,
            totalArticlesCompleted: progress.totalArticlesCompleted + 1,
            currentStreak,
            longestStreak: Math.max(progress.longestStreak, currentStreak),
            articlesByDifficulty: {
              Beginner: progress.beginnerCount + (input.difficulty === 'Beginner' ? 1 : 0),
              Intermediate: progress.intermediateCount + (input.difficulty === 'Intermediate' ? 1 : 0),
              Advanced: progress.advancedCount + (input.difficulty === 'Advanced' ? 1 : 0),
            },
            lastCompletedDate: learningDate,
            activityLog,
            badges: strings(progress.badges),
          };
          const values = {
            totalArticlesCompleted: stats.totalArticlesCompleted,
            currentStreak: stats.currentStreak,
            beginnerCount: stats.articlesByDifficulty.Beginner,
            intermediateCount: stats.articlesByDifficulty.Intermediate,
            advancedCount: stats.articlesByDifficulty.Advanced,
          };
          const newBadges = badges.filter(
            (badge) =>
              badge.enabled && !stats.badges.includes(badge.id) && values[badge.rule.metric] >= badge.rule.minimum,
          );
          stats.badges = [...stats.badges, ...newBadges.map((badge) => badge.id)];
          const articleActivity = await tx.plazaActivity.create({
            data: {
              userId,
              type: PlazaActivityType.ARTICLE_COMPLETED,
              content: `${userName || 'User'} completed ${article.titleZh}.`,
              metadata: { articleId: article.id, articleTitle: article.titleZh },
            },
            include: { user: { select: { id: true, name: true } } },
          });
          const badgeActivities = await Promise.all(
            newBadges.map((badge) =>
              tx.plazaActivity.create({
                data: {
                  userId,
                  type: PlazaActivityType.BADGE_EARNED,
                  content: `${userName || 'User'} earned ${badge.name}.`,
                  metadata: { badgeCode: badge.id, badgeName: badge.name },
                },
                include: { user: { select: { id: true, name: true } } },
              }),
            ),
          );
          const activities = [articleActivity, ...badgeActivities];
          await tx.userProgress.update({
            where: { id: progress.id },
            data: {
              ...stats,
              beginnerCount: stats.articlesByDifficulty.Beginner,
              intermediateCount: stats.articlesByDifficulty.Intermediate,
              advancedCount: stats.articlesByDifficulty.Advanced,
              completedArticleIds,
            },
          });
          return {
            progress: { completedArticleIds, stats },
            newBadges: newBadges.map((badge) => badge.name),
            activities,
          };
        });
        if (!result) return { kind: 'notFound' };
        await redis.del(`plaza:leaderboard:daily:${learningDate}`, 'plaza:leaderboard:streak').catch(() => undefined);
        for (const activity of result.activities)
          await publish({
            type: 'feed.created',
            activity: {
              ...activity,
              user: { id: activity.user.id, name: activity.user.name || '学习者' },
              createdAt: activity.createdAt.toISOString(),
            },
          }).catch(() => undefined);
        for (const board of ['daily', 'streak'] as const)
          await publish({ type: 'leaderboard.updated', board }).catch(() => undefined);
        return { kind: 'completed', progress: result.progress, newBadges: result.newBadges };
      } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          return { kind: 'conflict' };
        throw error;
      }
    },
  };
}
