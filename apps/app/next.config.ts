import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@markerit/ui', '@markerit/validators', '@markerit/api-client'],
};

export default nextConfig;
