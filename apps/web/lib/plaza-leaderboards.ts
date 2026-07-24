import type { DailyLeaderboardEntry, PlazaLeaderboards, StreakLeaderboardEntry } from '@/types/plaza';

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

const DAILY_CACHE_SECONDS = 24 * 60 * 60;
const STREAK_CACHE_SECONDS = 60 * 60;
const LEADERBOARD_LIMIT = 50;

export function getShanghaiDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
  }).format(date);
}

function subtractDays(dateText: string, days: number): string {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch (error: unknown) {
    console.error(`[plaza] 读取排行榜缓存失败: ${key}`, error);
    return null;
  }
}

async function writeCache(key: string, value: object, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (error: unknown) {
    console.error(`[plaza] 写入排行榜缓存失败: ${key}`, error);
  }
}

async function getDailyLeaderboard(learningDate: string): Promise<DailyLeaderboardEntry[]> {
  const cacheKey = `plaza:leaderboard:daily:${learningDate}`;
  const cached = await readCache<DailyLeaderboardEntry[]>(cacheKey);
  if (cached) return cached;

  const groupedCompletions = await prisma.articleCompletion.groupBy({
    by: ['userId'],
    where: { learningDate },
    _count: { _all: true },
    _min: { completedAt: true },
  });
  const userIds = groupedCompletions.map((entry) => entry.userId);
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      })
    : [];
  const userNames = new Map(users.map((user) => [user.id, user.name || '学习者']));

  const entries = groupedCompletions
    .map((entry) => ({
      userId: entry.userId,
      name: userNames.get(entry.userId) || '学习者',
      completedArticles: entry._count._all,
      firstCompletedAt: entry._min.completedAt ?? new Date(0),
    }))
    .sort(
      (left, right) =>
        right.completedArticles - left.completedArticles ||
        left.firstCompletedAt.getTime() - right.firstCompletedAt.getTime(),
    )
    .slice(0, LEADERBOARD_LIMIT)
    .map<DailyLeaderboardEntry>((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      name: entry.name,
      completedArticles: entry.completedArticles,
      firstCompletedAt: entry.firstCompletedAt.toISOString(),
    }));

  await writeCache(cacheKey, entries, DAILY_CACHE_SECONDS);
  return entries;
}

async function getStreakLeaderboard(): Promise<StreakLeaderboardEntry[]> {
  const cacheKey = 'plaza:leaderboard:streak';
  const cached = await readCache<StreakLeaderboardEntry[]>(cacheKey);
  if (cached) return cached;

  const progressRows = await prisma.userProgress.findMany({
    where: {
      currentStreak: { gt: 0 },
      lastCompletedDate: { not: null },
    },
    select: {
      userId: true,
      currentStreak: true,
      lastCompletedDate: true,
      user: { select: { name: true } },
    },
  });
  const userIds = progressRows.map((progress) => progress.userId);
  const completions = userIds.length
    ? await prisma.articleCompletion.findMany({
        where: { userId: { in: userIds } },
        select: {
          userId: true,
          learningDate: true,
          completedAt: true,
        },
      })
    : [];

  const entries = progressRows
    .map((progress) => {
      const lastCompletedDate = progress.lastCompletedDate as string;
      const cycleStartDate = subtractDays(lastCompletedDate, progress.currentStreak - 1);
      const cycleCompletions = completions.filter(
        (completion) =>
          completion.userId === progress.userId &&
          completion.learningDate >= cycleStartDate &&
          completion.learningDate <= lastCompletedDate,
      );
      const lastCompletedAt = cycleCompletions.reduce<Date | null>(
        (latest, completion) => (!latest || completion.completedAt > latest ? completion.completedAt : latest),
        null,
      );

      return {
        userId: progress.userId,
        name: progress.user.name || '学习者',
        streakDays: progress.currentStreak,
        completedArticles: cycleCompletions.length,
        lastCompletedAt: lastCompletedAt ?? new Date(0),
      };
    })
    .sort(
      (left, right) =>
        right.streakDays - left.streakDays ||
        right.completedArticles - left.completedArticles ||
        right.lastCompletedAt.getTime() - left.lastCompletedAt.getTime(),
    )
    .slice(0, LEADERBOARD_LIMIT)
    .map<StreakLeaderboardEntry>((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      name: entry.name,
      streakDays: entry.streakDays,
      completedArticles: entry.completedArticles,
      lastCompletedAt: entry.lastCompletedAt.toISOString(),
    }));

  await writeCache(cacheKey, entries, STREAK_CACHE_SECONDS);
  return entries;
}

export async function getPlazaLeaderboards(): Promise<PlazaLeaderboards> {
  const [daily, streak] = await Promise.all([getDailyLeaderboard(getShanghaiDate()), getStreakLeaderboard()]);
  return { daily, streak };
}

export async function invalidatePlazaLeaderboards(learningDate: string): Promise<void> {
  try {
    await redis.del(`plaza:leaderboard:daily:${learningDate}`, 'plaza:leaderboard:streak');
  } catch (error: unknown) {
    console.error('[plaza] 清理排行榜缓存失败', error);
  }
}
