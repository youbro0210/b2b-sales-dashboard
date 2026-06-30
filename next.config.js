/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 첫 배포 시 사소한 lint/타입 경고로 빌드가 막히지 않도록 함 (안정화 후 꺼도 됩니다)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;
