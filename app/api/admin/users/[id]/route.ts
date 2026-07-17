import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/users/[id]
 * 获取用户详情（管理员专用）
 */
export async function GET(
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

    // 查询用户及其进度数据，排除password字段
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        progress: true,
        // 排除password字段
      }
    });

    // 验证用户是否存在
    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('获取用户详情失败:', error);
    return NextResponse.json(
      { error: '获取用户详情失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]
 * 删除用户（管理员专用）
 */
export async function DELETE(
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

    // 检查是否尝试删除自己的账户
    if (authResult.session?.user.id === id) {
      return NextResponse.json(
        { error: '不能删除自己的账户' },
        { status: 400 }
      );
    }

    // 删除用户（Prisma会自动级联删除UserProgress）
    await prisma.user.delete({
      where: { id }
    });

    return NextResponse.json({ 
      message: '用户删除成功',
      id 
    });
  } catch (error) {
    console.error('删除用户失败:', error);
    return NextResponse.json(
      { error: '删除用户失败' },
      { status: 500 }
    );
  }
}
