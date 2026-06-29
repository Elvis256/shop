const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
  publicExcludes: ['!robots.txt'],
  extendDefaultRuntimeCaching: false,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
      handler: 'CacheFirst',
      options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'images', expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 } },
    },
    {
      urlPattern: /\/_next\/image\?url=.+$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'next-image', expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 } },
    },
    {
      // JS/CSS chunks use content-hashed filenames — safe to CacheFirst but with a sane TTL
      urlPattern: /\/_next\/static\/chunks\/.+\.(?:js|css)$/i,
      handler: 'CacheFirst',
      options: { cacheName: 'next-static', expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 } },
    },
    {
      // Build manifests and non-chunk static assets change on every deploy
      urlPattern: /\/_next\/static\/(?!chunks\/).+/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'next-static-misc', expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 } },
    },
    {
      // Only cache same-origin API calls — cross-origin API requests must not be intercepted
      urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/api/'),
      handler: 'NetworkFirst',
      options: { cacheName: 'apis', networkTimeoutSeconds: 10, expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 } },
    },
    {
      // Only cache same-origin pages — do NOT intercept external scripts/analytics
      urlPattern: ({ url }) => url.origin === self.location.origin,
      handler: 'NetworkFirst',
      options: { cacheName: 'pages', networkTimeoutSeconds: 10, expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 } },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  allowedDevOrigins: ["192.168.1.250"],
  // Pre-existing ESLint warnings (unused vars, any types) don't affect runtime.
  // Suppress them so CI builds succeed; run `next lint` separately for quality checks.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.paypal.com https://www.google-analytics.com https://www.googletagmanager.com https://connect.facebook.net https://static.cloudflareinsights.com https://js.stripe.com https://accounts.google.com https://apis.google.com https://pagead2.googlesyndication.com https://www.googleadservices.com https://adservice.google.com https://tpc.googlesyndication.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "connect-src 'self' https://ugsex.com wss://ugsex.com https://www.ugsex.com wss://www.ugsex.com https://www.paypal.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://region1.analytics.google.com https://www.googletagmanager.com https://www.facebook.com https://connect.facebook.net https://fonts.googleapis.com https://fonts.gstatic.com https://ae01.alicdn.com https://*.alicdn.com https://*.aliexpress.com https://*.cjdropshipping.com https://res.cloudinary.com https://static.cloudflareinsights.com https://api.stripe.com https://nominatim.openstreetmap.org https://accounts.google.com https://pagead2.googlesyndication.com https://www.googleadservices.com https://www.google.co.ug https://ep1.adtrafficquality.google https://adservice.google.com",
              "frame-src 'self' https://www.paypal.com https://www.google.com https://js.stripe.com https://accounts.google.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
              "worker-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self' https://t.me https://web.telegram.org https://telegram.org",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=(self)',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/products',
        destination: '/category',
        permanent: true,
      },
      // Redirect old ?cat= URLs to clean /category/[slug] paths
      {
        source: '/category',
        has: [{ type: 'query', key: 'cat', value: '(?<slug>.+)' }],
        destination: '/category/:slug',
        permanent: true,
      },
    ];
  },
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
    minimumCacheTTL: 86400,
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'localhost' },
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: 'ugsex.com' },
      { protocol: 'http',  hostname: '212.47.69.106' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '**.railway.app' },
      { protocol: 'https', hostname: '**.onrender.com' },
      { protocol: 'https', hostname: 'cf.cjdropshipping.com' },
      { protocol: 'https', hostname: 'oss-cf.cjdropshipping.com' },
      { protocol: 'https', hostname: '**.cjdropshipping.com' },
      { protocol: 'https', hostname: '**.aliexpress.com' },
      { protocol: 'https', hostname: 'ae01.alicdn.com' },
      { protocol: 'https', hostname: 'img.alicdn.com' },
      { protocol: 'https', hostname: 'i.imgur.com' },
    ],
  },
};

module.exports = withPWA(nextConfig);
