import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/speaking-eval
 * 接收用户录音，调用 Groq Whisper 转录，返回识别文字
 * 前端再用 textDiff 工具做单词级对比评分
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: '服务器未配置 GROQ_API_KEY' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const audio = formData.get('audio') as File | null;
    if (!audio) {
      return NextResponse.json({ error: '缺少音频数据' }, { status: 400 });
    }

    // 转发给 Groq Whisper（纯文本转录，不需要时间戳）
    const whisperForm = new FormData();
    whisperForm.append('file', audio, audio.name || 'recording.webm');
    whisperForm.append('model', 'whisper-large-v3-turbo');
    whisperForm.append('response_format', 'text');
    whisperForm.append('language', 'en');

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.json().catch(() => ({}));
      console.error('Whisper 转录失败:', err);
      return NextResponse.json({ error: `转录失败: ${err?.error?.message || '未知错误'}` }, { status: 500 });
    }

    // response_format=text 时直接返回纯文本字符串
    const transcript = await whisperRes.text();
    return NextResponse.json({ transcript: transcript.trim() });
  } catch (error: unknown) {
    console.error('speaking-eval 出错:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '服务器错误' }, { status: 500 });
  }
}
