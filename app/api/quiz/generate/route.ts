import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { QuizQuestion } from '@/types';

/**
 * POST /api/quiz/generate
 * Body: { articleText: string, difficulty: string }
 * 调用 Groq（兼容 OpenAI 格式）生成阅读理解题，返回结构化 JSON
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

  const { articleText, difficulty } = await req.json();
  if (!articleText) {
    return NextResponse.json({ error: '缺少文章内容' }, { status: 400 });
  }

  // 根据难度决定题目数量和侧重点
  const questionCount = difficulty === 'Advanced' ? 7 : difficulty === 'Intermediate' ? 6 : 5;

  const systemPrompt = `You are an English reading comprehension quiz generator.
Your task is to generate ${questionCount} questions based on the given article.

STRICT OUTPUT RULES:
1. Return ONLY a valid JSON array — no markdown, no explanation, no code fences.
2. Mix question types: include at least 2 multiple_choice, 1 true_false, and 1 fill_blank.
3. Questions must be answerable from the article content only.
4. For fill_blank, the blank should replace a key word or short phrase from the article.

JSON schema for each question:
- multiple_choice: { "type": "multiple_choice", "question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "A", "explanation": "..." }
- true_false:      { "type": "true_false", "question": "...", "answer": "true", "explanation": "..." }
- fill_blank:      { "type": "fill_blank", "question": "According to the article, ___ .", "answer": "exact word or phrase", "explanation": "..." }`;

  const userPrompt = `Article:\n${articleText}\n\nGenerate ${questionCount} reading comprehension questions now.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Groq 出题失败:', err);
      return NextResponse.json({ error: `AI 服务错误: ${err?.error?.message || '未知'}` }, { status: 500 });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '';

    // 兼容模型偶尔在 JSON 外包一层 markdown 代码块的情况
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let questions: QuizQuestion[];
    try {
      questions = JSON.parse(jsonStr);
    } catch {
      console.error('JSON 解析失败，原始输出:', raw);
      return NextResponse.json({ error: 'AI 返回格式异常，请重试' }, { status: 500 });
    }

    // 基础校验：确保是数组且每项有 type/question/answer
    if (!Array.isArray(questions) || questions.some(q => !q.type || !q.question || !q.answer)) {
      return NextResponse.json({ error: 'AI 返回结构不完整，请重试' }, { status: 500 });
    }

    return NextResponse.json({ questions });
  } catch (error: any) {
    console.error('quiz/generate 出错:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
