import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import { DEFAULT_BADGES, parseBadgeDefinitions } from '@/lib/badges';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error)
    return NextResponse.json({ success: false, message: auth.error, data: null }, { status: auth.status });
  const config = await prisma.badgeConfig.findUnique({ where: { id: 'default' } });
  return NextResponse.json({
    success: true,
    message: '获取徽章配置成功',
    data: parseBadgeDefinitions(config?.badges) || DEFAULT_BADGES,
  });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (auth.error)
    return NextResponse.json({ success: false, message: auth.error, data: null }, { status: auth.status });
  try {
    const badges = parseBadgeDefinitions((await request.json()).badges);
    if (!badges)
      return NextResponse.json({ success: false, message: '徽章 JSON 格式或规则无效', data: null }, { status: 400 });
    const config = await prisma.badgeConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', badges: badges as unknown as Prisma.InputJsonValue },
      update: { badges: badges as unknown as Prisma.InputJsonValue },
    });
    return NextResponse.json({
      success: true,
      message: '徽章配置已保存',
      data: parseBadgeDefinitions(config.badges) || DEFAULT_BADGES,
    });
  } catch {
    return NextResponse.json({ success: false, message: '请求数据格式错误', data: null }, { status: 400 });
  }
}
