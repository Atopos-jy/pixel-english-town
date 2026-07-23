import { ApiCode } from '@pixel-english-town/contracts';
import type { FastifyInstance } from 'fastify';
import { createRequireAuth } from '../../middleware/auth.js';
import { response } from '../../utils/response.js';
import { createAuthService } from '../auth/service.js';

const defaults = [
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
export async function registerBadgeRoutes(app: FastifyInstance): Promise<void> {
  const auth = createRequireAuth(createAuthService({ prisma: app.prisma }));
  app.get('/api/v1/badges', { preHandler: auth }, async (_request, reply) => {
    const config = await app.prisma.badgeConfig.findUnique({ where: { id: 'default' } });
    const badges = Array.isArray(config?.badges) ? config.badges : defaults;
    return reply.send(response(ApiCode.OK, '获取徽章配置成功', badges));
  });
}
