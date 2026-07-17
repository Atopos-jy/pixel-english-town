import { randomUUID, timingSafeEqual } from 'node:crypto';

import { PlazaActivityType } from '@prisma/client';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { publishPlazaEvent, redis } from '@/lib/redis';

type EnterPlazaRequest = {
  userId?: string;
};

const ENTER_COOLDOWN_SECONDS = 5 * 60;

function getInternalSecret(): string | undefined {
  if (process.env.PLAZA_INTERNAL_SECRET) return process.env.PLAZA_INTERNAL_SECRET;
  if (process.env.NODE_ENV !== 'production') return process.env.NEXTAUTH_SECRET;
  return undefined;
}

function isAuthorized(request: Request): boolean {
  const expectedSecret = getInternalSecret();
  const authorization = request.headers.get('authorization');
  const receivedSecret = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';

  if (!expectedSecret || !receivedSecret) return false;

  const expectedBuffer = Buffer.from(expectedSecret);
  const receivedBuffer = Buffer.from(receivedSecret);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

async function releaseCooldown(key: string, requestId: string): Promise<void> {
  await redis.eval(
    `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`,
    1,
    key,
    requestId,
  );
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, message: '内部服务认证失败', data: null }, { status: 401 });
  }

  let body: EnterPlazaRequest;
  try {
    body = (await request.json()) as EnterPlazaRequest;
  } catch {
    return NextResponse.json({ success: false, message: '请求数据格式错误', data: null }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ success: false, message: '缺少用户标识', data: null }, { status: 400 });
  }

  const cooldownKey = `plaza:enter-cooldown:${body.userId}`;
  const requestId = randomUUID();

  try {
    const acquired = await redis.set(cooldownKey, requestId, 'EX', ENTER_COOLDOWN_SECONDS, 'NX');
    if (!acquired) {
      return NextResponse.json({
        success: true,
        message: '进入动态仍在冷却中',
        data: { created: false, activity: null },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, name: true },
    });
    if (!user) {
      await releaseCooldown(cooldownKey, requestId);
      return NextResponse.json({ success: false, message: '用户不存在', data: null }, { status: 404 });
    }

    const activity = await prisma.plazaActivity.create({
      data: {
        userId: user.id,
        type: PlazaActivityType.ENTER_PLAZA,
        content: `欢迎 ${user.name || '学习者'} 来到学习广场`,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
    const activityPayload = {
      ...activity,
      metadata: null,
      user: {
        id: activity.user.id,
        name: activity.user.name || '学习者',
      },
      createdAt: activity.createdAt.toISOString(),
    };

    await publishPlazaEvent({
      type: 'feed.created',
      activity: activityPayload,
    }).catch((error: unknown) => {
      console.error('[plaza] 发布进入广场动态失败', error);
    });

    return NextResponse.json({
      success: true,
      message: '进入广场动态已创建',
      data: { created: true, activity: activityPayload },
    });
  } catch (error: unknown) {
    await releaseCooldown(cooldownKey, requestId).catch(() => undefined);
    console.error('[plaza] 创建进入广场动态失败', error);
    return NextResponse.json({ success: false, message: '创建进入广场动态失败', data: null }, { status: 500 });
  }
}
