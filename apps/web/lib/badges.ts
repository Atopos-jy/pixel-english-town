import { Difficulty, type UserStats } from '@/types';

export type BadgeRuleMetric =
  'totalArticlesCompleted' | 'currentStreak' | 'beginnerCount' | 'intermediateCount' | 'advancedCount';

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  rule: { metric: BadgeRuleMetric; minimum: number };
}

export const DEFAULT_BADGES: BadgeDefinition[] = [
  {
    id: 'badge-first-step',
    name: '初次启程',
    description: '完成你的第一篇文章',
    icon: '🌱',
    enabled: true,
    rule: { metric: 'totalArticlesCompleted', minimum: 1 },
  },
  {
    id: 'badge-on-fire',
    name: '状态火热',
    description: '达成连续 3 天学习打卡',
    icon: '🔥',
    enabled: true,
    rule: { metric: 'currentStreak', minimum: 3 },
  },
  {
    id: 'badge-scholar',
    name: '博学者',
    description: '累计完成 10 篇文章',
    icon: '📚',
    enabled: true,
    rule: { metric: 'totalArticlesCompleted', minimum: 10 },
  },
  {
    id: 'badge-master',
    name: '阅读大师',
    description: '完成一篇高级难度文章',
    icon: '🏆',
    enabled: true,
    rule: { metric: 'advancedCount', minimum: 1 },
  },
];

const metrics: BadgeRuleMetric[] = [
  'totalArticlesCompleted',
  'currentStreak',
  'beginnerCount',
  'intermediateCount',
  'advancedCount',
];

export function parseBadgeDefinitions(value: unknown): BadgeDefinition[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const ids = new Set<string>();
  const badges: BadgeDefinition[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const badge = item as Partial<BadgeDefinition>;
    if (
      !badge.rule ||
      typeof badge.id !== 'string' ||
      !badge.id.trim() ||
      ids.has(badge.id) ||
      typeof badge.name !== 'string' ||
      !badge.name.trim() ||
      typeof badge.description !== 'string' ||
      typeof badge.icon !== 'string' ||
      (badge.enabled !== undefined && typeof badge.enabled !== 'boolean') ||
      !metrics.includes(badge.rule.metric as BadgeRuleMetric) ||
      !Number.isInteger(badge.rule.minimum) ||
      badge.rule.minimum < 1
    )
      return null;
    ids.add(badge.id);
    badges.push({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      enabled: badge.enabled !== false,
      rule: { metric: badge.rule.metric as BadgeRuleMetric, minimum: badge.rule.minimum },
    });
  }
  return badges;
}

export function isBadgeEarned(badge: BadgeDefinition, stats: UserStats): boolean {
  const values: Record<BadgeRuleMetric, number> = {
    totalArticlesCompleted: stats.totalArticlesCompleted,
    currentStreak: stats.currentStreak,
    beginnerCount: stats.articlesByDifficulty[Difficulty.Beginner],
    intermediateCount: stats.articlesByDifficulty[Difficulty.Intermediate],
    advancedCount: stats.articlesByDifficulty[Difficulty.Advanced],
  };
  return values[badge.rule.metric] >= badge.rule.minimum;
}
