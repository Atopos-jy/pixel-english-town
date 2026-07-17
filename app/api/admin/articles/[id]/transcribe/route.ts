import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/articles/[id]/transcribe
 * 调用 Whisper API 为文章音频生成逐词时间戳（管理员专用）
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = params;

  try {
    // 查询文章
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 });
    }
    if (!article.audioUrl) {
      return NextResponse.json({ error: '该文章没有音频文件' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: '服务器未配置 GROQ_API_KEY' }, { status: 500 });
    }

    // 从对象存储下载音频到内存。
    const audioResponse = await fetch(article.audioUrl);
    if (!audioResponse.ok) {
      return NextResponse.json({ error: '下载音频文件失败' }, { status: 500 });
    }
    const audioBuffer = await audioResponse.arrayBuffer();

    // 根据 URL 推断文件扩展名，默认 mp3
    const ext = article.audioUrl.split('.').pop()?.toLowerCase() || 'mp3';
    const mimeMap: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
    };
    const mimeType = mimeMap[ext] || 'audio/mpeg';
    const audioFile = new File([audioBuffer], `audio.${ext}`, { type: mimeType });

    // 调用 Groq Whisper API，请求逐词时间戳
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');

    const whisperResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const err = await whisperResponse.json();
      console.error('Whisper API 错误:', err);
      return NextResponse.json({ error: `Whisper API 调用失败: ${err.error?.message || '未知错误'}` }, { status: 500 });
    }

    const transcription = await whisperResponse.json();
    const wordTimestamps = transcription.words as Array<{ word: string; start: number; end: number }>;

    if (!wordTimestamps || wordTimestamps.length === 0) {
      return NextResponse.json({ error: 'Whisper 未返回逐词时间戳，请确认音频清晰度' }, { status: 500 });
    }

    // 保存到数据库
    await prisma.article.update({
      where: { id },
      data: { wordTimestamps: wordTimestamps as Prisma.InputJsonValue },
    });

    return NextResponse.json({
      message: '时间戳生成成功',
      wordCount: wordTimestamps.length,
    });
  } catch (error: unknown) {
    console.error('生成时间戳失败:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '生成失败' }, { status: 500 });
  }
}
