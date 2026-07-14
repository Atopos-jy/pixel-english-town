/** @type {import('next').NextConfig} */
const nextConfig = {
  // 在开发环境禁用 React Strict Mode 以避免双重渲染导致的重复 API 调用
  reactStrictMode: false,
};

module.exports = nextConfig;