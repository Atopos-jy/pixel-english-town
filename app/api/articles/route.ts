import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { MOCK_ARTICLES } from '@/constants';
import { Difficulty } from '@/types';

export async function GET() {
  try {
    // Attempt to connect to DB. If this fails, catch block will run.
    const count = await prisma.article.count();

    if (count === 0) {
      // Seed DB with mock articles if empty
      for (const article of MOCK_ARTICLES) {
        await prisma.article.create({
          data: {
            id: article.id,
            date: article.date,
            titleEn: article.title.en,
            titleZh: article.title.zh,
            summaryEn: article.summary.en,
            summaryZh: article.summary.zh,
            content: article.content.map((block): Prisma.InputJsonObject => ({ en: block.en, zh: block.zh })),
            difficulty: article.difficulty,
            durationSeconds: article.durationSeconds,
            audioUrl: article.audioUrl,
          },
        });
      }
    }

    const articles = await prisma.article.findMany({
      orderBy: { date: 'desc' },
    });

    // Transform back to frontend structure
    const formattedArticles = articles.map((a) => ({
      id: a.id,
      title: { en: a.titleEn, zh: a.titleZh },
      date: a.date,
      summary: { en: a.summaryEn, zh: a.summaryZh },
      content: a.content,
      difficulty: a.difficulty as Difficulty,
      durationSeconds: a.durationSeconds,
      audioUrl: a.audioUrl || undefined,
      wordTimestamps: a.wordTimestamps || null,
    }));

    return NextResponse.json(formattedArticles);
  } catch (error) {
    console.error('Database connection failed.', error);
    return NextResponse.json({ error: '数据库连接失败，无法获取文章' }, { status: 503 });
  }
}
