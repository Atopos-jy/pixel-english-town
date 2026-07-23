import { z } from 'zod';

export const questionIdParamsSchema = z.object({ questionId: z.string().min(1) });
export const articleIdParamsSchema = z.object({ articleId: z.string().min(1) });
export const attemptBodySchema = z.object({ answer: z.string().trim().min(1) });

export const bookmarkQuerySchema = z.object({
  category: z.string().optional().default('all'),
  type: z.string().optional().default('all'),
  wrongCount: z.string().optional().default('all'),
});

export type AttemptResult = { correct: boolean; correctAnswer: string; explanation: string | null };
export type BookmarkResult = { isBookmarked: boolean };

export type BookmarkedQuestion = {
  id: string;
  type: string;
  question: string;
  options?: string[];
  knowledgePoints: unknown;
  stats: {
    attemptCount: number;
    correctCount: number;
    wrongCount: number;
    lastAnsweredAt: Date | null;
  };
};

export type PracticeResult = {
  availableCount: number;
  questions: Array<{ id: string; type: string; question: string; options?: string[] }>;
};

export type AnalysisResult = {
  overview: {
    key: string;
    bookmarkedCount: number;
    attemptedQuestionCount: number;
    attemptCount: number;
    correctCount: number;
    wrongCount: number;
    accuracy: number | null;
  };
  typePerformance: Array<{
    key: string;
    bookmarkedCount: number;
    attemptedQuestionCount: number;
    attemptCount: number;
    correctCount: number;
    wrongCount: number;
    accuracy: number | null;
  }>;
  knowledgePointPerformance: Array<{
    key: string;
    bookmarkedCount: number;
    attemptedQuestionCount: number;
    attemptCount: number;
    correctCount: number;
    wrongCount: number;
    accuracy: number | null;
  }>;
  weakPoints: Array<{
    key: string;
    bookmarkedCount: number;
    attemptedQuestionCount: number;
    attemptCount: number;
    correctCount: number;
    wrongCount: number;
    accuracy: number | null;
  }>;
};
