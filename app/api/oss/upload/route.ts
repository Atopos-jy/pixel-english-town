import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getOssClient, getOssPublicUrl } from '@/lib/oss';

// OSS SDK 依赖 Node.js runtime，不能部署到 Edge runtime。
export const runtime = 'nodejs';

/** 管理员上传文章音频到阿里云 OSS。长期 AccessKey 永不返回给浏览器。 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '未找到上传文件' }, { status: 400 });
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = new Set(['mp3', 'wav', 'ogg', 'aac', 'm4a']);
    if (!extension || !allowedExtensions.has(extension)) {
      return NextResponse.json({ error: '仅支持 MP3、WAV、OGG、AAC、M4A 音频' }, { status: 400 });
    }
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: '音频文件不能超过 50MB' }, { status: 400 });
    }

    // 文件名由服务端生成，避免用户传入路径覆盖已有对象。
    const key = `audio/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await getOssClient().put(key, buffer, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        // 防止同名对象覆盖；当前 key 唯一，正常情况下不会触发。
        'x-oss-forbid-overwrite': 'true',
      },
    });

    return NextResponse.json({ key, url: getOssPublicUrl(key) });
  } catch (error) {
    console.error('OSS 音频上传失败', error);
    const message = error instanceof Error ? error.message : 'OSS 音频上传失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
