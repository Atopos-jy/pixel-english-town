import { PlazaActivityType, type PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const PRESENCE_KEY = 'plaza:presence';
const DAILY_CACHE_SECONDS = 24 * 60 * 60;
const STREAK_CACHE_SECONDS = 60 * 60;
const LEADERBOARD_LIMIT = 50;

type Activity = {
  id: string;
  type: PlazaActivityType;
  content: string;
  metadata: Record<string, string> | null;
  user: { id: string; name: string };
  createdAt: string;
};

function getShanghaiDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(date);
}

function toActivity(activity: {
  id: string;
  type: PlazaActivityType;
  content: string;
  metadata: unknown;
  createdAt: Date;
  user: { id: string; name: string | null };
}): Activity {
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
    user: { id: activity.user.id, name: activity.user.name || '学习者' },
    createdAt: activity.createdAt.toISOString(),
  };
}

function subtractDays(dateText: string, days: number): string {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function createPlazaService(prisma: PrismaClient, redis: import('ioredis').default) {
  const publish = async (payload: object): Promise<void> => {
    const version = await redis.incr('plaza:version');
    await redis.publish('plaza:events', JSON.stringify({ ...payload, version }));
  };
  const getLeaderboards = async () => {
    const learningDate = getShanghaiDate();
    const dailyKey = `plaza:leaderboard:daily:${learningDate}`;
    const read = async <T>(key: string): Promise<T | null> => {
      const value = await redis.get(key).catch(() => null);
      return value ? (JSON.parse(value) as T) : null;
    };
    const [cachedDaily, cachedStreak] = await Promise.all([
      read<object[]>(dailyKey),
      read<object[]>('plaza:leaderboard:streak'),
    ]);
    const daily =
      cachedDaily ??
      (await (async () => {
        const grouped = await prisma.articleCompletion.groupBy({
          by: ['userId'],
          where: { learningDate },
          _count: { _all: true },
          _min: { completedAt: true },
        });
        const users = grouped.length
          ? await prisma.user.findMany({
              where: { id: { in: grouped.map((item) => item.userId) } },
              select: { id: true, name: true },
            })
          : [];
        const names = new Map(users.map((user) => [user.id, user.name || '学习者']));
        const entries = grouped
          .sort(
            (a, b) =>
              b._count._all - a._count._all ||
              (a._min.completedAt?.getTime() ?? 0) - (b._min.completedAt?.getTime() ?? 0),
          )
          .slice(0, LEADERBOARD_LIMIT)
          .map((item, index) => ({
            rank: index + 1,
            userId: item.userId,
            name: names.get(item.userId) || '学习者',
            completedArticles: item._count._all,
            firstCompletedAt: item._min.completedAt?.toISOString() || new Date(0).toISOString(),
          }));
        await redis.set(dailyKey, JSON.stringify(entries), 'EX', DAILY_CACHE_SECONDS).catch(() => undefined);
        return entries;
      })());
    const streak =
      cachedStreak ??
      (await (async () => {
        const progress = await prisma.userProgress.findMany({
          where: { currentStreak: { gt: 0 }, lastCompletedDate: { not: null } },
          select: { userId: true, currentStreak: true, lastCompletedDate: true, user: { select: { name: true } } },
        });
        const completions = progress.length
          ? await prisma.articleCompletion.findMany({
              where: { userId: { in: progress.map((item) => item.userId) } },
              select: { userId: true, learningDate: true, completedAt: true },
            })
          : [];
        const entries = progress
          .map((item) => {
            const lastDate = item.lastCompletedDate!;
            const matches = completions.filter(
              (completion) =>
                completion.userId === item.userId &&
                completion.learningDate >= subtractDays(lastDate, item.currentStreak - 1) &&
                completion.learningDate <= lastDate,
            );
            const lastCompletedAt = matches.reduce<Date | null>(
              (latest, completion) => (!latest || completion.completedAt > latest ? completion.completedAt : latest),
              null,
            );
            return {
              userId: item.userId,
              name: item.user.name || '学习者',
              streakDays: item.currentStreak,
              completedArticles: matches.length,
              lastCompletedAt: lastCompletedAt || new Date(0),
            };
          })
          .sort(
            (a, b) =>
              b.streakDays - a.streakDays ||
              b.completedArticles - a.completedArticles ||
              b.lastCompletedAt.getTime() - a.lastCompletedAt.getTime(),
          )
          .slice(0, LEADERBOARD_LIMIT)
          .map((item, index) => ({
            rank: index + 1,
            userId: item.userId,
            name: item.name,
            streakDays: item.streakDays,
            completedArticles: item.completedArticles,
            lastCompletedAt: item.lastCompletedAt.toISOString(),
          }));
        await redis
          .set('plaza:leaderboard:streak', JSON.stringify(entries), 'EX', STREAK_CACHE_SECONDS)
          .catch(() => undefined);
        return entries;
      })());
    return { daily, streak };
  };
  return {
    async snapshot() {
      const [rows, leaderboards, version, online] = await Promise.all([
        prisma.plazaActivity.findMany({
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true } } },
        }),
        getLeaderboards(),
        redis.get('plaza:version').catch(() => '0'),
        redis
          .eval(
            `redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1]); local users = {}; for _, member in ipairs(redis.call('ZRANGE', KEYS[1], 0, -1)) do local index = string.find(member, '|', 1, true); if index then users[string.sub(member, index + 1)] = true end end; local count = 0; for _ in pairs(users) do count = count + 1 end; return count`,
            1,
            PRESENCE_KEY,
            Date.now(),
          )
          .catch(() => 0),
      ]);
      return {
        onlineCount: Number(online),
        activities: rows.map(toActivity),
        leaderboards,
        version: Number(version || 0),
      };
    },
    async enter(userId: string) {
      const key = `plaza:enter-cooldown:${userId}`;
      const requestId = crypto.randomUUID();
      if (!(await redis.set(key, requestId, 'EX', 300, 'NX'))) return { created: false, activity: null };
      try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
        if (!user) {
          await redis.del(key);
          return null;
        }
        const row = await prisma.plazaActivity.create({
          data: { userId, type: PlazaActivityType.ENTER_PLAZA, content: `${user.name || '学习者'} 进入了学习广场` },
          include: { user: { select: { id: true, name: true } } },
        });
        const activity = toActivity(row);
        await publish({ type: 'feed.created', activity }).catch(() => undefined);
        return { created: true, activity };
      } catch (error) {
        await redis
          .eval(
            `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`,
            1,
            key,
            requestId,
          )
          .catch(() => undefined);
        throw error;
      }
    },
  };
}
