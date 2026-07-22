import { z } from 'zod';

export const completeArticleSchema = z.object({
  articleId: z.string().min(1),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
});

export type CompleteArticleInput = z.infer<typeof completeArticleSchema>;
export type UserProgressResponse = {
  completedArticleIds: string[];
  stats: {
    totalDaysLearned: number;
    totalArticlesCompleted: number;
    currentStreak: number;
    longestStreak: number;
    articlesByDifficulty: { Beginner: number; Intermediate: number; Advanced: number };
    lastCompletedDate: string | null;
    activityLog: Record<string, number>;
    badges: string[];
  };
};
