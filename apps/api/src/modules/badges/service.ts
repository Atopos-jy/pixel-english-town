import type { PrismaClient } from '@prisma/client';
import { DEFAULT_BADGES, type Badge } from '../shared/badgeDefaults.js';

interface BadgeServiceDependencies {
  prisma: PrismaClient;
}

export interface BadgeService {
  getBadges(): Promise<Badge[]>;
}

export function createBadgeService({ prisma }: BadgeServiceDependencies): BadgeService {
  return {
    async getBadges() {
      const config = await prisma.badgeConfig.findUnique({ where: { id: 'default' } });
      return Array.isArray(config?.badges) ? (config.badges as unknown as Badge[]) : DEFAULT_BADGES;
    },
  };
}
