import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { DEFAULT_BADGES, parseBadgeDefinitions } from '@/lib/badges';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, message: '请先登录', data: null }, { status: 401 });
  const config = await prisma.badgeConfig.findUnique({ where: { id: 'default' } });
  return NextResponse.json({
    success: true,
    message: '获取徽章配置成功',
    data: parseBadgeDefinitions(config?.badges) || DEFAULT_BADGES,
  });
}
