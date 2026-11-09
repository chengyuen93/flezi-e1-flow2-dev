import type { NextConfig } from 'next';

const apiOrigin = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/register', destination: `${apiOrigin}/register` },
      { source: '/login', destination: `${apiOrigin}/login` },
      { source: '/me', destination: `${apiOrigin}/me` },
    ];
  },
};

export default nextConfig;
