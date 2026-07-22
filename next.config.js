/** @type {import('next').NextConfig} */
const nextConfig = {
  // 在开发环境禁用 React Strict Mode 以避免双重渲染导致的重复 API 调用
  reactStrictMode: false,
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN || 'http://localhost:4000';
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }];
  },
};

module.exports = nextConfig;
