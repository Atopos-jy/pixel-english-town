export type PlazaActivityType = 'ENTER_PLAZA' | 'ARTICLE_COMPLETED' | 'BADGE_EARNED';

export type PlazaActivity = {
  id: string;
  type: PlazaActivityType;
  content: string;
  metadata: Record<string, string> | null;
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
};

export type DailyLeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  completedArticles: number;
  firstCompletedAt: string;
};

export type StreakLeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  streakDays: number;
  completedArticles: number;
  lastCompletedAt: string;
};

export type PlazaLeaderboards = {
  daily: DailyLeaderboardEntry[];
  streak: StreakLeaderboardEntry[];
};

export type PlazaSnapshot = {
  onlineCount: number;
  activities: PlazaActivity[];
  leaderboards: PlazaLeaderboards;
  version: number;
};

export type PlazaRealtimeEvent = {
  type: 'feed.created' | 'leaderboard.updated';
  version: number;
  activity?: PlazaActivity;
  board?: 'daily' | 'streak';
};
