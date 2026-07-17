import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Difficulty } from "@/types";

/**
 * GET /api/admin/articles
 * 获取所有文章列表（管理员专用）
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
    // 查询所有文章，按创建时间降序排序
    const articles = await prisma.article.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(articles);
  } catch (error) {
    console.error('获取文章列表失败:', error);
    return NextResponse.json(
      { error: '获取文章列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/articles
 * 创建新文章（管理员专用）
 */
export async function POST(request: Request) {
  // 验证管理员权限
  const authResult = await requireAdmin();
  
  if (authResult.error) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const body = await request.json();
    const { 
      date,
      titleEn, 
      titleZh, 
      summaryEn, 
      summaryZh, 
      content, 
      difficulty, 
      durationSeconds,
      audioUrl
    } = body;

    // 验证必需字段
    if (!titleEn || !titleZh || !summaryEn || !summaryZh || !content || !difficulty) {
      return NextResponse.json(
        { error: '缺少必需字段' },
        { status: 400 }
      );
    }

    // 验证difficulty值
    const validDifficulties = [Difficulty.Beginner, Difficulty.Intermediate, Difficulty.Advanced];
    if (!validDifficulties.includes(difficulty)) {
      return NextResponse.json(
        { error: 'difficulty必须是Beginner、Intermediate或Advanced之一' },
        { status: 400 }
      );
    }

    // 验证durationSeconds为正整数
    if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
      return NextResponse.json(
        { error: 'durationSeconds必须是正整数' },
        { status: 400 }
      );
    }

    // 验证content为数组
    if (!Array.isArray(content)) {
      return NextResponse.json(
        { error: 'content必须是数组' },
        { status: 400 }
      );
    }

    // 验证content数组中的每个元素都有en和zh字段
    for (const block of content) {
      if (!block.en || !block.zh) {
        return NextResponse.json(
          { error: 'content数组中的每个元素必须包含en和zh字段' },
          { status: 400 }
        );
      }
    }

    const articleData = {
      date: date || new Date().toISOString().split('T')[0],
      titleEn,
      titleZh,
      summaryEn,
      summaryZh,
      content,
      difficulty,
      durationSeconds,
      audioUrl: audioUrl || null,
    };

    const article = await prisma.$transaction(async (transaction) => {
      const sequence = await transaction.articleIdSequence.update({
        where: { name: 'article' },
        data: { currentValue: { increment: 1 } },
      });
      const generatedId = `art-${String(sequence.currentValue).padStart(3, '0')}`;

      return transaction.article.create({ data: { id: generatedId, ...articleData } });
    });

    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    console.error('创建文章失败:', error);
    return NextResponse.json(
      { error: '创建文章失败' },
      { status: 500 }
    );
  }
}
