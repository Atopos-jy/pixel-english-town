export interface BadgeRule {
  metric: 'totalArticlesCompleted' | 'currentStreak' | 'beginnerCount' | 'intermediateCount' | 'advancedCount';
  minimum: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  rule: BadgeRule;
}

export interface BadgeDef {
  id: string;
  name: string;
  enabled: boolean;
  rule: BadgeRule;
}

export const DEFAULT_BADGES: Badge[] = [
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

/** Subset used by learning progress badge evaluation (no description/icon needed). */
export const BADGE_DEFS_FOR_PROGRESS: BadgeDef[] = DEFAULT_BADGES.map(({ id, name, enabled, rule }) => ({
  id,
  name,
  enabled,
  rule,
}));
