import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/types";

/**
 * PUT /api/admin/users/[id]/role
 * 更新用户角色（管理员专用）
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  // 验证管理员权限
  const authResult = await requireAdmin();
  
  if (authResult.error) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const { id } = params;
    const body = await request.json();
    const { role } = body;

    // 验证用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // 验证角色值
    if (role !== UserRole.User && role !== UserRole.Admin) {
      return NextResponse.json(
        { error: '角色值必须是user或admin' },
        { status: 400 }
      );
    }

    // 更新用户角色
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        // 排除password字段
      }
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('更新用户角色失败:', error);
    return NextResponse.json(
      { error: '更新用户角色失败' },
      { status: 500 }
    );
  }
}
