/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  images: { unoptimized: true },
  // Remove the rewrites — frontend calls backend directly via NEXT_PUBLIC_API_URL
};

module.exports = nextConfig;