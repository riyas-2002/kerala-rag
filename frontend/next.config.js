/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable gzip compression
  compress: true,
  // Optimize images
  images: {
    unoptimized: true, // Vercel free tier
  },
  // Rewrites to backend (optional — can also use direct API URL)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
