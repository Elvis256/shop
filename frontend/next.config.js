const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  allowedDevOrigins: ["192.168.1.250"],
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'localhost' },
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'http',  hostname: '192.168.1.250' },
      { protocol: 'https', hostname: '192.168.1.250' },
      // Cloud storage — add your Cloudinary/S3 hostname here after setup
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      // Backend on Railway/Render — wildcard covers any subdomain
      { protocol: 'https', hostname: '**.railway.app' },
      { protocol: 'https', hostname: '**.onrender.com' },
    ],
  },
};

module.exports = withPWA(nextConfig);
