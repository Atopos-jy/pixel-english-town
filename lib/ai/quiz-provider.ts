import { Difficulty, QuizQuestion } from '@/types';
import { AiConfiguration, AiProviderId, AiQuizProvider, QuizGenerationInput } from './types';

const providerBaseUrls: Record<AiProviderId, string> = {
  deepseek: 'https://api.deepseek.com',
  mimo: 'https://api.xiaomimimo.com/v1',
};

export const supportedModels: Record<AiProviderId, string[]> = {
  deepseek: ['deepseek-v4-flash', 'deepseek-v4-pro'],
  mimo: ['mimo-v2.5-pro', 'mimo-v2.5'],
};

const getQuestionCount = (difficulty: Difficulty) => {
  if (difficulty === Difficulty.Advanced) return 7;
  if (difficulty === Difficulty.Intermediate) return 6;
  return 5;
};

const getProviderError = async (response: Response) => {
  const payload = await response.json().catch(() => null);
  const message = payload?.error?.message || payload?.message;
  return typeof message === 'string' ? message : `请求失败（HTTP ${response.status}）`;
};

const parseQuestions = (raw: string): QuizQuestion[] => {
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(jsonText);
  const questions = Array.isArray(parsed) ? parsed : parsed?.questions;

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('模型未返回有效题目。');
  }

  const validTypes = new Set(['multiple_choice', 'true_false', 'fill_blank']);
  const isValid = questions.every((question) => {
    if (!question || !validTypes.has(question.type) || typeof question.question !== 'string' || typeof question.answer !== 'string' || typeof question.explanation !== 'string') {
      return false;
    }
    return question.type !== 'multiple_choice' || (Array.isArray(question.options) && question.options.length === 4);
  });

  if (!isValid) throw new Error('模型返回的题目结构不完整。');
  return questions as QuizQuestion[];
};

class OpenAiCompatibleQuizProvider implements AiQuizProvider {
  constructor(private readonly provider: AiProviderId) {}

  private async chat(configuration: AiConfiguration, messages: Array<{ role: 'system' | 'user'; content: string }>, maxTokens: number) {
    const response = await fetch(`${providerBaseUrls[this.provider]}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: configuration.model,
        messages,
        temperature: 0.3,
        ...(this.provider === 'mimo' ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
        stream: false,
      }),
    });

    if (!response.ok) throw new Error(await getProviderError(response));
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('模型未返回内容。');
    return content;
  }

  async testConnection(configuration: AiConfiguration) {
    await this.chat(configuration, [
      { role: 'system', content: 'You are a connection test assistant.' },
      { role: 'user', content: 'Reply with OK.' },
    ], 16);
  }

  async generateQuiz(configuration: AiConfiguration, input: QuizGenerationInput) {
    const questionCount = getQuestionCount(input.difficulty);
    const systemPrompt = `You generate English reading-comprehension quizzes. Return JSON only, with no markdown. Return this exact object shape: {"questions":[...]}. Generate ${questionCount} questions that are answerable solely from the article. Include at least 2 multiple_choice questions, 1 true_false question, and 1 fill_blank question. Each multiple_choice question must contain exactly four options prefixed A. through D. Question schema: {"type":"multiple_choice"|"true_false"|"fill_blank","question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"...","explanation":"..."}.`;
    const content = await this.chat(configuration, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Article:\n${input.articleText}` },
    ], 2048);
    return parseQuestions(content);
  }
}

const providers: Record<AiProviderId, AiQuizProvider> = {
  deepseek: new OpenAiCompatibleQuizProvider('deepseek'),
  mimo: new OpenAiCompatibleQuizProvider('mimo'),
};

export const getQuizProvider = (provider: AiProviderId) => providers[provider];

export const isSupportedAiConfiguration = (value: unknown): value is AiConfiguration => {
  if (!value || typeof value !== 'object') return false;
  const configuration = value as AiConfiguration;
  return (configuration.provider === 'deepseek' || configuration.provider === 'mimo')
    && typeof configuration.apiKey === 'string'
    && configuration.apiKey.trim().length >= 8
    && typeof configuration.model === 'string'
    && supportedModels[configuration.provider].includes(configuration.model);
};
