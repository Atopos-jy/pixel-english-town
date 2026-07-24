import type { PrismaClient, QuizGenerationJob } from '@prisma/client';
import type Redis from 'ioredis';
import type { ApiEnv } from '../../config/env.js';
import { decryptApiKey } from './encryption.js';
import { generateQuiz } from './provider.js';

const MAX_ARTICLE_CHARACTERS = 40_000;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 3;
const runningJobs = new Set<string>();

export type QuizJobResponse = {
  id: string;
  articleId: string;
  status: string;
  error: string | null;
  questions?: Array<{ id: string; type: string; question: string; options?: string[] }>;
};

function toJobResponse(
  job: QuizGenerationJob & { questions?: Array<{ id: string; type: string; stem: string; options: unknown }> },
): QuizJobResponse {
  return {
    id: job.id,
    articleId: job.articleId,
    status: job.status,
    error: job.error,
    ...(job.status === 'completed'
      ? {
          questions: (job.questions ?? []).map((question) => ({
            id: question.id,
            type: question.type,
            question: question.stem,
            ...(Array.isArray(question.options) && question.options.every((option) => typeof option === 'string')
              ? { options: question.options }
              : {}),
          })),
        }
      : {}),
  };
}

export function createQuizService(prisma: PrismaClient, env: ApiEnv, redis?: Redis) {
  const checkRateLimit = async (userId: string): Promise<number | null> => {
    if (!redis) return null;
    const key = `rate-limit:quiz-generate:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    if (count <= RATE_LIMIT_MAX_REQUESTS) return null;
    return Math.max(await redis.ttl(key), 1);
  };
  const start = (jobId: string): void => {
    if (runningJobs.has(jobId)) return;
    runningJobs.add(jobId);
    void (async () => {
      try {
        const job = await prisma.quizGenerationJob.findUnique({
          where: { id: jobId },
          include: { article: true, user: { include: { aiSetting: true } } },
        });
        if (!job || job.status === 'completed' || job.status === 'failed') return;
        await prisma.quizGenerationJob.update({ where: { id: job.id }, data: { status: 'processing', error: null } });
        if (!job.user.aiSetting) throw new Error('请先在 AI 设置中保存可用的厂商、模型和 API Key。');
        if (!['Beginner', 'Intermediate', 'Advanced'].includes(job.article.difficulty))
          throw new Error('文章难度无效。');

        const articleText = Array.isArray(job.article.content)
          ? job.article.content
              .map((block) =>
                block && typeof block === 'object' && 'en' in block && typeof block.en === 'string' ? block.en : '',
              )
              .filter(Boolean)
              .join('\n\n')
          : '';
        if (!articleText) throw new Error('文章内容无效。');
        if (articleText.length > MAX_ARTICLE_CHARACTERS) throw new Error('文章内容过长，暂时无法出题。');

        const questions = await generateQuiz(
          env,
          {
            provider: job.user.aiSetting.provider,
            model: job.user.aiSetting.selectedModel,
            apiKey: decryptApiKey(job.user.aiSetting.encryptedApiKey, env.AI_SETTINGS_ENCRYPTION_KEY),
          },
          articleText,
          job.article.difficulty,
        );
        await prisma.$transaction([
          ...questions.map((question) =>
            prisma.articleQuestion.create({
              data: {
                articleId: job.articleId,
                createdByUserId: job.userId,
                generationJobId: job.id,
                type: question.type,
                stem: question.question,
                options: question.options,
                correctAnswer: question.answer,
                explanation: question.explanation,
                knowledgePoints: question.knowledgePoints,
              },
            }),
          ),
          prisma.quizGenerationJob.update({
            where: { id: job.id },
            data: { status: 'completed', completedAt: new Date() },
          }),
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI 服务暂时不可用。';
        await prisma.quizGenerationJob
          .update({ where: { id: jobId }, data: { status: 'failed', error: message } })
          .catch(() => undefined);
      } finally {
        runningJobs.delete(jobId);
      }
    })();
  };

  return {
    checkRateLimit,
    async create(userId: string, articleId: string) {
      const article = await prisma.article.findUnique({ where: { id: articleId }, select: { id: true } });
      if (!article) return { kind: 'notFound' as const };
      const existing = await prisma.quizGenerationJob.findFirst({
        where: { userId, articleId, status: { in: ['pending', 'processing'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        start(existing.id);
        return { kind: 'existing' as const, job: toJobResponse(existing) };
      }
      const job = await prisma.quizGenerationJob.create({ data: { userId, articleId } });
      start(job.id);
      return { kind: 'created' as const, job: toJobResponse(job) };
    },
    async get(userId: string, jobId: string): Promise<QuizJobResponse | null> {
      const job = await prisma.quizGenerationJob.findFirst({
        where: { id: jobId, userId },
        include: { questions: { orderBy: { createdAt: 'asc' } } },
      });
      if (!job) return null;
      if (job.status === 'pending' || job.status === 'processing') start(job.id);
      return toJobResponse(job);
    },
  };
}
