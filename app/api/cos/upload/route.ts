import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import COS from 'cos-nodejs-sdk-v5';

/**
 * POST /api/cos/upload
 * 上传文件到腾讯云COS（管理员专用）
 */
export async function POST(request: NextRequest) {
  // 验证管理员权限
  const authResult = await requireAdmin();
  
  if (authResult.error) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: '未找到文件' },
        { status: 400 }
      );
    }

    // 验证文件类型
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/m4a'];
    if (!file.type.startsWith('audio/') && !allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '不支持的文件类型' },
        { status: 400 }
      );
    }

    // 验证文件大小（50MB）
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: '文件大小不能超过50MB' },
        { status: 400 }
      );
    }

    // 初始化COS客户端
    const cos = new COS({
      SecretId: process.env.COS_SECRET_ID!,
      SecretKey: process.env.COS_SECRET_KEY!,
    });

    // 生成文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop();
    const key = `audio/${timestamp}_${randomStr}.${ext}`;

    // 将File转换为Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 上传到COS
    const result = await new Promise<any>((resolve, reject) => {
      cos.putObject(
        {
          Bucket: process.env.NEXT_PUBLIC_COS_BUCKET!,
          Region: process.env.NEXT_PUBLIC_COS_REGION!,
          Key: key,
          Body: buffer,
          ContentType: file.type,
        },
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        }
      );
    });

    // 构建完整的URL
    const url = `https://${result.Location}`;

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('上传失败:', error);
    return NextResponse.json(
      { error: error.message || '上传失败' },
      { status: 500 }
    );
  }
}

// 配置最大文件大小为50MB
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};
