import OSS from 'ali-oss';

// 只在服务端创建 OSS 客户端，避免将长期 AccessKey 打包到浏览器端。
export function getOssClient() {
  const accessKeyId = process.env.OSS_SECRET_ID;
  const accessKeySecret = process.env.OSS_SECRET_KEY;
  const bucket = process.env.OSS_BUCKET;
  const region = process.env.OSS_REGION;

  if (!accessKeyId || !accessKeySecret || !bucket || !region) {
    throw new Error('OSS 配置不完整：请设置 OSS_SECRET_ID、OSS_SECRET_KEY、OSS_BUCKET、OSS_REGION');
  }

  return new OSS({
    // 例如 oss-cn-hangzhou；必须与 Bucket 所在地域一致。
    region,
    accessKeyId,
    accessKeySecret,
    // 阿里云 OSS V4 签名。
    authorizationV4: true,
    bucket,
    // 强制使用 HTTPS 返回与上传对象。
    secure: true,
  });
}

// 生成供文章音频播放器保存的对象地址；Bucket 为私有读时需改为 CDN 或签名 URL 方案。
export function getOssPublicUrl(key: string) {
  const baseUrl = process.env.OSS_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (baseUrl) return `${baseUrl}/${key}`;

  const bucket = process.env.OSS_BUCKET;
  const region = process.env.OSS_REGION;
  if (!bucket || !region) throw new Error('OSS 配置不完整：缺少 OSS_BUCKET 或 OSS_REGION');

  return `https://${bucket}.${region}.aliyuncs.com/${key}`;
}
