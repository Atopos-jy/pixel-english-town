import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withRetry } from '@/lib/db-utils';
import { Difficulty } from '@/types';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get specific user progress with retry mechanism
    let progress = await withRetry(() => 
      prisma.userProgress.findUnique({
        where: { userId: userId }
      })
    );

    // If somehow progress is missing but user exists (shouldn't happen with new registration flow), create it
    if (!progress) {
      progress = await prisma.userProgress.create({
        data: {
          userId: userId,
          activityLog: {},
          badges: [],
          completedArticleIds: [],
        }
      });
    }

    // Format for frontend
    const formattedProgress = {
      completedArticleIds: progress.completedArticleIds,
      stats: {
        totalDaysLearned: progress.totalDaysLearned,
        totalArticlesCompleted: progress.totalArticlesCompleted,
        currentStreak: progress.currentStreak,
        longestStreak: progress.longestStreak,
        articlesByDifficulty: {
          [Difficulty.Beginner]: progress.beginnerCount,
          [Difficulty.Intermediate]: progress.intermediateCount,
          [Difficulty.Advanced]: progress.advancedCount,
        },
        lastCompletedDate: progress.lastCompletedDate,
        activityLog: progress.activityLog,
        badges: progress.badges,
      }
    };

    return NextResponse.json(formattedProgress);
  } catch (error: unknown) {
    console.error('获取进度失败:', error);
    
    // 返回更友好的错误信息
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2024') {
      return NextResponse.json({ 
        error: '数据库连接池已满，请稍后重试' 
      }, { status: 503 });
    }
    
    if (error instanceof Prisma.PrismaClientInitializationError && error.errorCode === 'P1001') {
      return NextResponse.json({ 
        error: '无法连接到数据库服务器' 
      }, { status: 503 });
    }
    
    return NextResponse.json({ 
      error: '获取进度失败，请刷新页面重试' 
    }, { status: 500 });
  }
}
