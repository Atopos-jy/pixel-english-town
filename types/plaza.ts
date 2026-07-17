export type PlazaActivityType = 'ENTER_PLAZA' | 'ARTICLE_COMPLETED' | 'BADGE_EARNED';

export type PlazaRealtimeEvent = {
  type: 'feed.created' | 'leaderboard.updated';
  version: number;
  activity?: {
    id: string;
    type: PlazaActivityType;
    content: string;
    metadata: Record<string, string> | null;
    user: { id: string; name: string };
    createdAt: string;
  };
};
