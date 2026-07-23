import type { Prisma } from '@prisma/client';
import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createRequireAuth } from '../../middleware/auth.js';
import { response } from '../../utils/response.js';
import { createAuthService } from '../auth/service.js';

const contentSchema = z.array(z.object({ en: z.string().min(1), zh: z.string().min(1) })).min(1);
const articleCreateSchema = z.object({
  date: z.string().min(1).optional(),
  titleEn: z.string().min(1),
  titleZh: z.string().min(1),
  summaryEn: z.string().min(1),
  summaryZh: z.string().min(1),
  content: contentSchema,
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  durationSeconds: z.number().int().positive(),
  audioUrl: z.string().url().nullable().optional(),
});
const articleUpdateSchema = articleCreateSchema.partial();
const idSchema = z.object({ id: z.string().min(1) });
const roleSchema = z.object({ role: z.enum(['user', 'admin']) });
const badgeSchema = z
  .array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string(),
      icon: z.string(),
      enabled: z.boolean().optional(),
      rule: z.object({
        metric: z.enum([
          'totalArticlesCompleted',
          'currentStreak',
          'beginnerCount',
          'intermediateCount',
          'advancedCount',
        ]),
        minimum: z.number().int().min(1),
      }),
    }),
  )
  .min(1);
const defaultBadges = [
  {
    id: 'badge-first-step',
    name: '初次启程',
    description: '完成你的第一篇文章',
    icon: '🌱',
    enabled: true,
    rule: { metric: 'totalArticlesCompleted', minimum: 1 },
  },
  {
    id: 'badge-on-fire',
    name: '状态火热',
    description: '达成连续 3 天学习打卡',
    icon: '🔥',
    enabled: true,
    rule: { metric: 'currentStreak', minimum: 3 },
  },
  {
    id: 'badge-scholar',
    name: '博学者',
    description: '累计完成 10 篇文章',
    icon: '📚',
    enabled: true,
    rule: { metric: 'totalArticlesCompleted', minimum: 10 },
  },
  {
    id: 'badge-master',
    name: '阅读大师',
    description: '完成一篇高级难度文章',
    icon: '🏆',
    enabled: true,
    rule: { metric: 'advancedCount', minimum: 1 },
  },
];

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  const auth = createRequireAuth(createAuthService({ prisma: app.prisma }));
  const admin = async (request: FastifyRequest, reply: import('fastify').FastifyReply) => {
    await auth(request, reply);
    if (!request.authenticatedSession) return;
    if (request.authenticatedSession.user.role !== 'admin')
      await reply.status(403).send(response(ApiCode.FORBIDDEN, '需要管理员权限', null));
  };
  const invalid = (reply: import('fastify').FastifyReply, message: string) =>
    reply.status(400).send(response(ApiCode.VALIDATION_ERROR, message, null));
  app.get('/api/v1/admin/stats', { preHandler: admin }, async (_request, reply) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const [totalUsers, totalArticles, totalAdmins, recentUsers] = await Promise.all([
      app.prisma.user.count(),
      app.prisma.article.count(),
      app.prisma.user.count({ where: { role: 'admin' } }),
      app.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    ]);
    return reply.send(
      response(ApiCode.OK, '获取统计数据成功', { totalUsers, totalArticles, totalAdmins, recentUsers }),
    );
  });
  app.get('/api/v1/admin/articles', { preHandler: admin }, async (_request, reply) =>
    reply.send(
      response(ApiCode.OK, '获取文章列表成功', await app.prisma.article.findMany({ orderBy: { createdAt: 'desc' } })),
    ),
  );
  app.post('/api/v1/admin/articles', { preHandler: admin }, async (request, reply) => {
    const parsed = articleCreateSchema.safeParse(request.body);
    if (!parsed.success) return invalid(reply, '文章参数无效');
    const sequence = await app.prisma.$transaction(async (tx) => {
      const next = await tx.articleIdSequence.update({
        where: { name: 'article' },
        data: { currentValue: { increment: 1 } },
      });
      return tx.article.create({
        data: {
          id: `art-${String(next.currentValue).padStart(3, '0')}`,
          ...parsed.data,
          date: parsed.data.date || new Date().toISOString().slice(0, 10),
          audioUrl: parsed.data.audioUrl || null,
        },
      });
    });
    return reply.status(201).send(response(ApiCode.OK, '创建文章成功', sequence));
  });
  app.get('/api/v1/admin/articles/:id', { preHandler: admin }, async (request, reply) => {
    const parsed = idSchema.safeParse(request.params);
    if (!parsed.success) return invalid(reply, '文章参数无效');
    const article = await app.prisma.article.findUnique({ where: { id: parsed.data.id } });
    return article
      ? reply.send(response(ApiCode.OK, '获取文章成功', article))
      : reply.status(404).send(response(ApiCode.NOT_FOUND, '文章不存在', null));
  });
  app.put('/api/v1/admin/articles/:id', { preHandler: admin }, async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    const body = articleUpdateSchema.safeParse(request.body);
    if (!params.success || !body.success) return invalid(reply, '文章参数无效');
    const exists = await app.prisma.article.findUnique({ where: { id: params.data.id }, select: { id: true } });
    if (!exists) return reply.status(404).send(response(ApiCode.NOT_FOUND, '文章不存在', null));
    return reply.send(
      response(
        ApiCode.OK,
        '更新文章成功',
        await app.prisma.article.update({
          where: { id: params.data.id },
          data: body.data as Prisma.ArticleUpdateInput,
        }),
      ),
    );
  });
  app.delete('/api/v1/admin/articles/:id', { preHandler: admin }, async (request, reply) => {
    const parsed = idSchema.safeParse(request.params);
    if (!parsed.success) return invalid(reply, '文章参数无效');
    const exists = await app.prisma.article.findUnique({ where: { id: parsed.data.id }, select: { id: true } });
    if (!exists) return reply.status(404).send(response(ApiCode.NOT_FOUND, '文章不存在', null));
    await app.prisma.article.delete({ where: { id: parsed.data.id } });
    return reply.send(response(ApiCode.OK, '文章删除成功', { id: parsed.data.id }));
  });
  const userSelect = { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true } as const;
  app.get('/api/v1/admin/users', { preHandler: admin }, async (_request, reply) =>
    reply.send(
      response(
        ApiCode.OK,
        '获取用户列表成功',
        await app.prisma.user.findMany({ select: userSelect, orderBy: { createdAt: 'desc' } }),
      ),
    ),
  );
  app.get('/api/v1/admin/users/:id', { preHandler: admin }, async (request, reply) => {
    const parsed = idSchema.safeParse(request.params);
    if (!parsed.success) return invalid(reply, '用户参数无效');
    const user = await app.prisma.user.findUnique({
      where: { id: parsed.data.id },
      select: { ...userSelect, progress: true },
    });
    return user
      ? reply.send(response(ApiCode.OK, '获取用户成功', user))
      : reply.status(404).send(response(ApiCode.NOT_FOUND, '用户不存在', null));
  });
  app.put('/api/v1/admin/users/:id/role', { preHandler: admin }, async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    const body = roleSchema.safeParse(request.body);
    if (!params.success || !body.success) return invalid(reply, '角色参数无效');
    const user = await app.prisma.user.findUnique({ where: { id: params.data.id }, select: { id: true } });
    if (!user) return reply.status(404).send(response(ApiCode.NOT_FOUND, '用户不存在', null));
    return reply.send(
      response(
        ApiCode.OK,
        '更新角色成功',
        await app.prisma.user.update({ where: { id: params.data.id }, data: body.data, select: userSelect }),
      ),
    );
  });
  app.delete('/api/v1/admin/users/:id', { preHandler: admin }, async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    const current = request.authenticatedSession?.user;
    if (!params.success) return invalid(reply, '用户参数无效');
    if (params.data.id === current?.id) return invalid(reply, '不能删除自己的账户');
    const user = await app.prisma.user.findUnique({ where: { id: params.data.id }, select: { id: true } });
    if (!user) return reply.status(404).send(response(ApiCode.NOT_FOUND, '用户不存在', null));
    await app.prisma.user.delete({ where: { id: params.data.id } });
    return reply.send(response(ApiCode.OK, '用户删除成功', { id: params.data.id }));
  });
  app.get('/api/v1/admin/badges', { preHandler: admin }, async (_request, reply) => {
    const config = await app.prisma.badgeConfig.findUnique({ where: { id: 'default' } });
    const badges = badgeSchema.safeParse(config?.badges).success ? badgeSchema.parse(config?.badges) : defaultBadges;
    return reply.send(response(ApiCode.OK, '获取徽章配置成功', badges));
  });
  app.put('/api/v1/admin/badges', { preHandler: admin }, async (request, reply) => {
    const parsed = z.object({ badges: badgeSchema }).safeParse(request.body);
    if (!parsed.success) return invalid(reply, '徽章 JSON 格式或规则无效');
    const config = await app.prisma.badgeConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', badges: parsed.data.badges },
      update: { badges: parsed.data.badges },
    });
    return reply.send(response(ApiCode.OK, '徽章配置已保存', badgeSchema.parse(config.badges)));
  });
}
