/** @type {import('next').NextConfig} */
const csp = [
  `default-src 'self' https:`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https: https://a.magsrv.com https://s.magsrv.com https://syndication.exoclick.com https://*.magsrv.com https://*.highperformanceformat.com https://*.highrevenueformat.com https://pl30572939.effectivecpmnetwork.com https://pl30572938.effectivecpmnetwork.com https://www.effectivecpmnetwork.com`,
  `style-src 'self' 'unsafe-inline' https:`,
  `img-src 'self' https: data: blob:`,
  `font-src 'self' https: data:`,
  `connect-src 'self' https: wss:`,
  `frame-src 'self' https: https://a.magsrv.com https://s.magsrv.com https://syndication.exoclick.com https://*.magsrv.com https://*.highperformanceformat.com https://*.highrevenueformat.com https://pl30572939.effectivecpmnetwork.com https://pl30572938.effectivecpmnetwork.com https://www.effectivecpmnetwork.com`,
  `frame-ancestors 'self'`,
  `media-src 'self' https: blob:`,
  `worker-src 'self' https: blob:`,
  `form-action 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
].join("; ");

const nextConfig = {
  // Vercel-friendly production settings
  poweredByHeader: false,
  compress: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  webpack(config) {
    // pdfjs-dist's Node build requires the native `canvas` module for NodeCanvasFactory.
    // Text extraction runs only in the browser (lib/file-import.ts), so stub it out.
    config.resolve.alias.canvas = false;
    return config;
  },
  async redirects() {
    // Old domains redirect to the canonical chotikahini.vercel.app
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "golopokahini.lol" }],
        destination: "https://chotikahini.vercel.app/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.golopokahini.lol" }],
        destination: "https://chotikahini.vercel.app/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/cover_pic/:path*",
        destination: "/images/Cover_pic/:path*",
      },
      {
        source: "/images/cover_pic/:path*",
        destination: "/images/Cover_pic/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sitemap.xml",
        headers: [
          { key: "Content-Type", value: "application/xml; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
        ],
      },
    ];
  },
  experimental: {
    outputFileTracingIncludes: {
      '/**/*': ['./content/**/*'],
      '/api/og/home': [
        './public/fonts/NotoSansBengali.ttf',
        './public/images/Cover_pic/52964258_014_da43.jpg',
      ],
      '/api/og/post/[identifier]': ['./public/fonts/NotoSansBengali.ttf'],
    },
    // Server-only packages are required at runtime, not bundled into the
    // serverless function — keeps the server bundle small and deploy fast.
    serverComponentsExternalPackages: [
      "bcryptjs",
      "jose",
      "gray-matter",
      "reading-time",
      "@napi-rs/canvas",
    ],
  },
};

module.exports = nextConfig;
