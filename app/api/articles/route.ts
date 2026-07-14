import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MOCK_ARTICLES } from '@/constants';

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
            content: article.content as any,
            difficulty: article.difficulty,
            durationSeconds: article.durationSeconds,
            audioUrl: article.audioUrl
          }
        });
      }
    }

    const articles = await prisma.article.findMany({
      orderBy: { date: 'desc' }
    });

    // Transform back to frontend structure
    const formattedArticles = articles.map(a => ({
      id: a.id,
      title: { en: a.titleEn, zh: a.titleZh },
      date: a.date,
      summary: { en: a.summaryEn, zh: a.summaryZh },
      content: a.content,
      difficulty: a.difficulty as any,
      durationSeconds: a.durationSeconds,
      audioUrl: a.audioUrl || undefined,
      wordTimestamps: a.wordTimestamps || null
    }));

    return NextResponse.json(formattedArticles);
  } catch (error) {
    console.warn('Database connection failed. Returning mock articles for fallback.', error);
    // Fallback to MOCK_ARTICLES if DB fails
    return NextResponse.json(MOCK_ARTICLES);
  }
}