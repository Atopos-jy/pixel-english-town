import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BADGES } from '@/constants';
import { Difficulty } from '@/types';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // @ts-ignore
    const userId = session.user.id;
    const { articleId, difficulty } = await request.json();
    
    let progress = await prisma.userProgress.findUnique({
        where: { userId: userId }
    });

    if (!progress) {
        return NextResponse.json({ error: 'Progress record not found' }, { status: 404 });
    }

    const completedIds = progress.completedArticleIds as string[];
    if (completedIds.includes(articleId)) {
        return NextResponse.json({ message: 'Already completed' });
    }

    const today = new Date().toISOString().split('T')[0];
    const lastDate = progress.lastCompletedDate;
    
    // Stats logic
    let newStreak = progress.currentStreak;
    let newTotalDays = progress.totalDaysLearned;

    if (lastDate !== today) {
        if (lastDate) {
            const lastDateObj = new Date(lastDate);
            const todayObj = new Date(today);
            const diffTime = Math.abs(todayObj.getTime() - lastDateObj.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays === 1) newStreak += 1;
            else newStreak = 1;
        } else {
            newStreak = 1;
        }
        newTotalDays += 1;
    }

    // Activity Log
    const activityLog = (progress.activityLog as Record<string, number>) || {};
    activityLog[today] = (activityLog[today] || 0) + 1;

    // Difficulty counts
    let beginner = progress.beginnerCount;
    let intermediate = progress.intermediateCount;
    let advanced = progress.advancedCount;
    
    if (difficulty === Difficulty.Beginner) beginner++;
    if (difficulty === Difficulty.Intermediate) intermediate++;
    if (difficulty === Difficulty.Advanced) advanced++;

    // Construct stats object for badge checking
    const currentStats = {
        totalDaysLearned: newTotalDays,
        totalArticlesCompleted: progress.totalArticlesCompleted + 1,
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, progress.longestStreak),
        articlesByDifficulty: {
            [Difficulty.Beginner]: beginner,
            [Difficulty.Intermediate]: intermediate,
            [Difficulty.Advanced]: advanced,
        },
        lastCompletedDate: today,
        activityLog,
        badges: progress.badges as string[]
    };

    // Check Badges
    const newBadges: string[] = [];
    const earnedBadgeIds = [...currentStats.badges];
    
    BADGES.forEach(badge => {
        if (!earnedBadgeIds.includes(badge.id) && badge.condition(currentStats)) {
            earnedBadgeIds.push(badge.id);
            newBadges.push(badge.name);
        }
    });

    // Update DB
    await prisma.userProgress.update({
        where: { id: progress.id },
        data: {
            totalDaysLearned: newTotalDays,
            totalArticlesCompleted: { increment: 1 },
            currentStreak: newStreak,
            longestStreak: Math.max(newStreak, progress.longestStreak),
            lastCompletedDate: today,
            activityLog: activityLog as any,
            badges: earnedBadgeIds as any,
            completedArticleIds: [...completedIds, articleId] as any,
            beginnerCount: beginner,
            intermediateCount: intermediate,
            advancedCount: advanced,
        }
    });

    return NextResponse.json({
        progress: {
            completedArticleIds: [...completedIds, articleId],
            stats: { ...currentStats, badges: earnedBadgeIds }
        },
        newBadges
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }
}