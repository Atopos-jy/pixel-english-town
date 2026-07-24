import type { Article, PrismaClient } from '@prisma/client';
import { articleSchema, type ArticleResponse } from './types.js';

interface ArticleServiceDependencies {
  prisma: PrismaClient;
}

export interface ArticleService {
  listArticles(): Promise<ArticleResponse[]>;
  findArticleById(articleId: string): Promise<ArticleResponse | null>;
}

function toArticleResponse(article: Article): ArticleResponse {
  return articleSchema.parse({
    id: article.id,
    title: { en: article.titleEn, zh: article.titleZh },
    date: article.date,
    summary: { en: article.summaryEn, zh: article.summaryZh },
    content: article.content,
    difficulty: article.difficulty,
    durationSeconds: article.durationSeconds,
    audioUrl: article.audioUrl ?? undefined,
    wordTimestamps: article.wordTimestamps ?? null,
  });
}

export function createArticleService({ prisma }: ArticleServiceDependencies): ArticleService {
  return {
    async listArticles() {
      const articles = await prisma.article.findMany({ orderBy: { date: 'desc' } });
      return articles.map(toArticleResponse);
    },

    async findArticleById(articleId) {
      const article = await prisma.article.findUnique({ where: { id: articleId } });
      return article ? toArticleResponse(article) : null;
    },
  };
}
