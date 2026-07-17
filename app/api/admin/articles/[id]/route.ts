import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Difficulty } from '@/types';

/**
 * GET /api/admin/articles/[id]
 * 获取单篇文章详情（管理员专用）
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  // 验证管理员权限
  const authResult = await requireAdmin();

  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { id } = params;

    // 查询文章
    const article = await prisma.article.findUnique({
      where: { id },
    });

    // 验证文章是否存在
    if (!article) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 });
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error('获取文章详情失败:', error);
    return NextResponse.json({ error: '获取文章详情失败' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/articles/[id]
 * 更新文章（管理员专用）
 */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  // 验证管理员权限
  const authResult = await requireAdmin();

  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { id } = params;
    const body = await request.json();

    // 验证文章是否存在
    const existingArticle = await prisma.article.findUnique({
      where: { id },
    });

    if (!existingArticle) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 });
    }

    // 构建更新数据对象（只包含提供的字段）
    const updateData: Prisma.ArticleUpdateInput = {};

    // 验证并添加各个字段
    if (body.titleEn !== undefined) updateData.titleEn = body.titleEn;
    if (body.titleZh !== undefined) updateData.titleZh = body.titleZh;
    if (body.summaryEn !== undefined) updateData.summaryEn = body.summaryEn;
    if (body.summaryZh !== undefined) updateData.summaryZh = body.summaryZh;
    if (body.date !== undefined) updateData.date = body.date;
    if (body.audioUrl !== undefined) updateData.audioUrl = body.audioUrl;

    // 验证difficulty（如果提供）
    if (body.difficulty !== undefined) {
      const validDifficulties = [Difficulty.Beginner, Difficulty.Intermediate, Difficulty.Advanced];
      if (!validDifficulties.includes(body.difficulty)) {
        return NextResponse.json({ error: 'difficulty必须是Beginner、Intermediate或Advanced之一' }, { status: 400 });
      }
      updateData.difficulty = body.difficulty;
    }

    // 验证durationSeconds（如果提供）
    if (body.durationSeconds !== undefined) {
      if (!Number.isInteger(body.durationSeconds) || body.durationSeconds <= 0) {
        return NextResponse.json({ error: 'durationSeconds必须是正整数' }, { status: 400 });
      }
      updateData.durationSeconds = body.durationSeconds;
    }

    // 验证content（如果提供）
    if (body.content !== undefined) {
      if (!Array.isArray(body.content)) {
        return NextResponse.json({ error: 'content必须是数组' }, { status: 400 });
      }

      // 验证content数组中的每个元素
      for (const block of body.content) {
        if (!block.en || !block.zh) {
          return NextResponse.json({ error: 'content数组中的每个元素必须包含en和zh字段' }, { status: 400 });
        }
      }
      updateData.content = body.content as Prisma.InputJsonValue;
    }

    // 更新文章（updatedAt会自动更新）
    const updatedArticle = await prisma.article.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedArticle);
  } catch (error) {
    console.error('更新文章失败:', error);
    return NextResponse.json({ error: '更新文章失败' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/articles/[id]
 * 删除文章（管理员专用）
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  // 验证管理员权限
  const authResult = await requireAdmin();

  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { id } = params;

    // 验证文章是否存在
    const existingArticle = await prisma.article.findUnique({
      where: { id },
    });

    if (!existingArticle) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 });
    }

    // 删除文章
    await prisma.article.delete({
      where: { id },
    });

    return NextResponse.json({
      message: '文章删除成功',
      id,
    });
  } catch (error) {
    console.error('删除文章失败:', error);
    return NextResponse.json({ error: '删除文章失败' }, { status: 500 });
  }
}
