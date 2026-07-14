import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/stats
 * 获取管理员仪表板统计数据（管理员专用）
 */
export async function GET() {
  // 验证管理员权限
  const authResult = await requireAdmin();
  
  if (authResult.error) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    // 查询总用户数
    const totalUsers = await prisma.user.count();

    // 查询总文章数
    const totalArticles = await prisma.article.count();

    // 查询管理员数量
    const totalAdmins = await prisma.user.count({
      where: { role: 'admin' }
    });

    // 计算7天前的日期
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 查询最近7天注册的用户数
    const recentUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo
        }
      }
    });

    return NextResponse.json({
      totalUsers,
      totalArticles,
      totalAdmins,
      recentUsers
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    );
  }
}
