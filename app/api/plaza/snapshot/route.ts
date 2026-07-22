import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { authOptions } from '@/lib/auth';
import { getPlazaLeaderboards } from '@/lib/plaza-leaderboards';
import { getPlazaOnlineCount } from '@/lib/plaza-presence';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: '请先登录', data: null }, { status: 401 });
  }

  try {
    const [activityRows, onlineCount, leaderboards, version] = await Promise.all([
      prisma.plazaActivity.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      }),
      getPlazaOnlineCount().catch(() => 0),
      getPlazaLeaderboards(),
      redis.get('plaza:version').catch(() => '0'),
    ]);
    const activities = activityRows.map((activity) => ({
      ...activity,
      metadata:
        activity.metadata && typeof activity.metadata === 'object' && !Array.isArray(activity.metadata)
          ? Object.fromEntries(
              Object.entries(activity.metadata).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string',
              ),
            )
          : null,
      user: {
        id: activity.user.id,
        name: activity.user.name || '学习者',
      },
      createdAt: activity.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      message: '获取广场快照成功',
      data: {
        onlineCount,
        activities,
        leaderboards,
        version: Number(version || 0),
      },
    });
  } catch (error: unknown) {
    console.error('[plaza] 获取广场快照失败', error);
    return NextResponse.json({ success: false, message: '获取广场快照失败', data: null }, { status: 500 });
  }
}
