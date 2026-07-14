export enum Difficulty {
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
}

export enum UserRole {
  User = 'user',
  Admin = 'admin',
}

export interface ContentBlock {
  en: string;
  zh: string;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface Article {
  id: string;
  title: ContentBlock;
  date: string; // YYYY-MM-DD
  summary: ContentBlock;
  content: ContentBlock[]; // Array of bilingual paragraphs
  audioUrl?: string;
  difficulty: Difficulty;
  durationSeconds: number;
  wordTimestamps?: WordTimestamp[] | null;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: UserStats) => boolean;
}

export interface UserStats {
  totalDaysLearned: number;
  totalArticlesCompleted: number;
  currentStreak: number;
  longestStreak: number;
  articlesByDifficulty: Record<Difficulty, number>;
  lastCompletedDate: string | null;
  activityLog: Record<string, number>; // Date string YYYY-MM-DD -> count
  badges: string[]; // List of Badge IDs
}

export interface UserProgress {
  completedArticleIds: string[];
  stats: UserStats;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithProgress extends AdminUser {
  progress: UserProgress | null;
}

export interface AdminStats {
  totalUsers: number;
  totalArticles: number;
  totalAdmins: number;
  recentUsers: number; // 最近7天注册的用户数
}

// ───── AI 测验 ─────

export type QuizQuestionType = 'multiple_choice' | 'true_false' | 'fill_blank';

export interface QuizQuestion {
  type: QuizQuestionType;
  question: string;
  options?: string[];   // 仅 multiple_choice 有
  answer: string;       // multiple_choice: "A"/"B"/"C"/"D"；true_false: "true"/"false"；fill_blank: 答案词
  explanation: string;
}

export interface QuizResult {
  questionIndex: number;
  userAnswer: string;
  correct: boolean;
}