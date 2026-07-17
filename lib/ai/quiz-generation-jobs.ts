import { prisma } from '@/lib/prisma';
import { getStoredAiConfiguration } from '@/lib/ai/settings';
import { getQuizProvider } from '@/lib/ai/quiz-provider';
import { Difficulty } from '@/types';

const runningJobs = new Set<string>();
const MAX_ARTICLE_CHARACTERS = 40_000;

export function startQuizGenerationJob(jobId: string) {
  if (runningJobs.has(jobId)) return;
  runningJobs.add(jobId);

  void processQuizGenerationJob(jobId).finally(() => runningJobs.delete(jobId));
}

async function processQuizGenerationJob(jobId: string) {
  try {
    const job = await prisma.quizGenerationJob.findUnique({
      where: { id: jobId },
      include: { article: true },
    });
    if (!job || job.status === 'completed' || job.status === 'failed') return;

    await prisma.quizGenerationJob.update({ where: { id: job.id }, data: { status: 'processing', error: null } });

    const configuration = await getStoredAiConfiguration(job.userId);
    if (!configuration) throw new Error('请先在 AI 设置中保存可用的厂商、模型和 API Key。');
    if (!Object.values(Difficulty).includes(job.article.difficulty as Difficulty)) throw new Error('文章难度无效。');

    const articleText = Array.isArray(job.article.content)
      ? job.article.content.map((block) => (
        block && typeof block === 'object' && 'en' in block && typeof block.en === 'string' ? block.en : ''
      )).filter(Boolean).join('\n\n')
      : '';
    if (!articleText) throw new Error('文章内容无效。');
    if (articleText.length > MAX_ARTICLE_CHARACTERS) throw new Error('文章内容过长，暂时无法出题。');

    const questions = await getQuizProvider(configuration.provider).generateQuiz(configuration, {
      articleText,
      difficulty: job.article.difficulty as Difficulty,
    });

    await prisma.$transaction([
      ...questions.map((question) => prisma.articleQuestion.create({
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
      })),
      prisma.quizGenerationJob.update({
        where: { id: job.id },
        data: { status: 'completed', completedAt: new Date() },
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 服务暂时不可用。';
    console.error('Quiz generation job failed', { jobId, message });
    await prisma.quizGenerationJob.update({
      where: { id: jobId },
      data: { status: 'failed', error: message },
    }).catch(() => undefined);
  }
}
