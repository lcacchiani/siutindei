import type { NextConfig } from 'next';

const buildYear = String(
  process.env.NEXT_PUBLIC_BUILD_YEAR ?? new Date().getFullYear(),
);

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_BUILD_YEAR: buildYear,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
