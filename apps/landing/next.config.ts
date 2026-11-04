import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@markerit/ui', '@markerit/api-client'],
};

export default nextConfig;
