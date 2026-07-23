import { Prisma, type PrismaClient } from '@prisma/client';
import { DEFAULT_BADGES, type Badge } from '../shared/badgeDefaults.js';
import {
  badgeItemSchema,
  userSelect,
  type ArticleCreateInput,
  type ArticleUpdateInput,
  type BadgeItem,
} from './types.js';

interface AdminServiceDependencies {
  prisma: PrismaClient;
}

export interface AdminService {
  getStats(): Promise<{ totalUsers: number; totalArticles: number; totalAdmins: number; recentUsers: number }>;
  listArticles(): Promise<Record<string, unknown>[]>;
  createArticle(input: ArticleCreateInput): Promise<Record<string, unknown>>;
  getArticle(id: string): Promise<Record<string, unknown> | null>;
  updateArticle(id: string, input: ArticleUpdateInput): Promise<Record<string, unknown> | null>;
  deleteArticle(id: string): Promise<boolean>;
  listUsers(): Promise<Record<string, unknown>[]>;
  getUser(id: string): Promise<Record<string, unknown> | null>;
  updateUserRole(id: string, role: string): Promise<Record<string, unknown> | null>;
  deleteUser(id: string): Promise<boolean>;
  getBadges(): Promise<BadgeItem[]>;
  updateBadges(badges: BadgeItem[]): Promise<BadgeItem[]>;
}

export function createAdminService({ prisma }: AdminServiceDependencies): AdminService {
  return {
    async getStats() {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const [totalUsers, totalArticles, totalAdmins, recentUsers] = await Promise.all([
        prisma.user.count(),
        prisma.article.count(),
        prisma.user.count({ where: { role: 'admin' } }),
        prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      ]);
      return { totalUsers, totalArticles, totalAdmins, recentUsers };
    },

    async listArticles() {
      return prisma.article.findMany({ orderBy: { createdAt: 'desc' } });
    },

    async createArticle(input) {
      return prisma.$transaction(async (tx) => {
        const next = await tx.articleIdSequence.update({
          where: { name: 'article' },
          data: { currentValue: { increment: 1 } },
        });
        return tx.article.create({
          data: {
            id: `art-${String(next.currentValue).padStart(3, '0')}`,
            ...input,
            date: input.date || new Date().toISOString().slice(0, 10),
            audioUrl: input.audioUrl || null,
          },
        });
      });
    },

    async getArticle(id) {
      return prisma.article.findUnique({ where: { id } });
    },

    async updateArticle(id, input) {
      const exists = await prisma.article.findUnique({ where: { id }, select: { id: true } });
      if (!exists) return null;
      return prisma.article.update({
        where: { id },
        data: input as Prisma.ArticleUpdateInput,
      });
    },

    async deleteArticle(id) {
      const exists = await prisma.article.findUnique({ where: { id }, select: { id: true } });
      if (!exists) return false;
      await prisma.article.delete({ where: { id } });
      return true;
    },

    async listUsers() {
      return prisma.user.findMany({ select: userSelect, orderBy: { createdAt: 'desc' } });
    },

    async getUser(id) {
      return prisma.user.findUnique({
        where: { id },
        select: { ...userSelect, progress: true },
      });
    },

    async updateUserRole(id, role) {
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
      if (!user) return null;
      return prisma.user.update({ where: { id }, data: { role }, select: userSelect });
    },

    async deleteUser(id) {
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
      if (!user) return false;
      await prisma.user.delete({ where: { id } });
      return true;
    },

    async getBadges() {
      const config = await prisma.badgeConfig.findUnique({ where: { id: 'default' } });
      const parsed = badgeItemSchema.array().safeParse(config?.badges);
      return parsed.success ? parsed.data : DEFAULT_BADGES;
    },

    async updateBadges(badges) {
      const config = await prisma.badgeConfig.upsert({
        where: { id: 'default' },
        create: { id: 'default', badges },
        update: { badges },
      });
      const parsed = badgeItemSchema.array().safeParse(config.badges);
      return parsed.success ? parsed.data : DEFAULT_BADGES;
    },
  };
}
