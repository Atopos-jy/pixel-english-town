import type { ApiEnv } from '../../config/env.js';

const supportedProviders = ['deepseek', 'mimo'] as const;
const supportedQuestionTypes = ['multiple_choice', 'true_false', 'fill_blank'] as const;
const supportedKnowledgePoints = [
  'vocabulary_context',
  'detail_location',
  'main_idea',
  'inference',
  'tense',
  'grammar_structure',
] as const;

export type QuizQuestionType = (typeof supportedQuestionTypes)[number];
export type QuizQuestion = {
  type: QuizQuestionType;
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  knowledgePoints: string[];
};

interface AiConfiguration {
  provider: string;
  model: string;
  apiKey: string;
}

function getQuestionCount(difficulty: string): number {
  if (difficulty === 'Advanced') return 7;
  if (difficulty === 'Intermediate') return 6;
  return 5;
}

function parseQuestions(raw: string): QuizQuestion[] {
  const jsonText = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const parsed: unknown = JSON.parse(jsonText);
  const questions = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && 'questions' in parsed
      ? parsed.questions
      : null;

  if (!Array.isArray(questions) || questions.length === 0) throw new Error('模型未返回有效题目。');

  const valid = questions.every((question): question is QuizQuestion => {
    if (!question || typeof question !== 'object') return false;
    const value = question as Record<string, unknown>;
    if (
      !supportedQuestionTypes.includes(value.type as QuizQuestionType) ||
      typeof value.question !== 'string' ||
      typeof value.answer !== 'string' ||
      typeof value.explanation !== 'string' ||
      !Array.isArray(value.knowledgePoints) ||
      !value.knowledgePoints.every(
        (point) =>
          typeof point === 'string' &&
          supportedKnowledgePoints.includes(point as (typeof supportedKnowledgePoints)[number]),
      )
    ) {
      return false;
    }
    return (
      value.type !== 'multiple_choice' ||
      (Array.isArray(value.options) &&
        value.options.length === 4 &&
        value.options.every((option) => typeof option === 'string'))
    );
  });

  if (!valid) throw new Error('模型返回的题目结构不完整。');
  return questions;
}

async function getProviderError(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object') return `AI 请求失败（HTTP ${response.status}）`;
  const value = payload as { error?: { message?: unknown }; message?: unknown };
  return typeof value.error?.message === 'string'
    ? value.error.message
    : typeof value.message === 'string'
      ? value.message
      : `AI 请求失败（HTTP ${response.status}）`;
}

export async function generateQuiz(
  _env: ApiEnv,
  configuration: AiConfiguration,
  articleText: string,
  difficulty: string,
): Promise<QuizQuestion[]> {
  if (!supportedProviders.includes(configuration.provider as (typeof supportedProviders)[number])) {
    throw new Error('已保存的 AI 厂商无效。');
  }
  const provider = configuration.provider as (typeof supportedProviders)[number];
  const baseUrl = provider === 'mimo' ? 'https://api.xiaomimimo.com/v1' : 'https://api.deepseek.com';
  const questionCount = getQuestionCount(difficulty);
  const systemPrompt = `You generate English reading-comprehension quizzes. Return JSON only, with no markdown. Return this exact object shape: {"questions":[...]}. Generate ${questionCount} questions that are answerable solely from the article. Include at least 2 multiple_choice questions, 1 true_false question, and 1 fill_blank question. Each multiple_choice question must contain exactly four options prefixed A. through D. Add one to three knowledgePoints to every question, selected only from: ${supportedKnowledgePoints.join(', ')}. Question schema: {"type":"multiple_choice"|"true_false"|"fill_blank","question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"...","explanation":"...","knowledgePoints":["..."]}.`;

  const request = async (retry: boolean): Promise<string> => {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${configuration.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: configuration.model,
        messages: [
          {
            role: 'system',
            content: retry
              ? `${systemPrompt} Your previous response was invalid. Return a complete, compact JSON object only.`
              : systemPrompt,
          },
          { role: 'user', content: `Article:\n${articleText}` },
        ],
        temperature: 0.3,
        ...(provider === 'mimo'
          ? { max_completion_tokens: 4096 }
          : { max_tokens: 4096, thinking: { type: 'disabled' } }),
        stream: false,
      }),
    });
    if (!response.ok) throw new Error(await getProviderError(response));
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('模型未返回可用内容。');
    return content;
  };

  try {
    return parseQuestions(await request(false));
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.message === '模型返回的题目结构不完整。')) {
      return parseQuestions(await request(true));
    }
    throw error;
  }
}
