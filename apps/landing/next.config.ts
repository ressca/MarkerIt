import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@markerit/ui', '@markerit/api-client', '@markerit/i18n'],
};

export default nextConfig;
