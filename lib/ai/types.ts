import { Difficulty, QuizQuestion } from '@/types';

export type AiProviderId = 'deepseek' | 'mimo';

export interface AiConfiguration {
  provider: AiProviderId;
  apiKey: string;
  model: string;
}

export interface QuizGenerationInput {
  articleText: string;
  difficulty: Difficulty;
}

export interface AiQuizProvider {
  testConnection(configuration: AiConfiguration): Promise<void>;
  generateQuiz(configuration: AiConfiguration, input: QuizGenerationInput): Promise<QuizQuestion[]>;
}
