/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@upc/core", "@upc/db", "@upc/ui"],
  experimental: {
    // SSE streaming endpoints must not be buffered
    proxyTimeout: 120_000,
    // ioredis must NOT be bundled by webpack — it resolves from node_modules
    // at runtime instead. (bullmq is gone from the web app entirely; only the
    // worker has it. See the upload route for why the enqueue was removed.)
    serverComponentsExternalPackages: ["ioredis"],
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      // Only meaningful over HTTPS in production; harmless locally
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      {
        // 'unsafe-inline'/'unsafe-eval': Next's inline bootstrap + dev HMR need
        // them (nonce-based CSP is a later hardening step). accounts.google.com
        // is the only third party (Google sign-in). data:/blob: images are the
        // chat attachment previews.
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self' https://accounts.google.com",
          "frame-src https://accounts.google.com",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join("; "),
      },
    ];
    return [
      { source: "/(.*)", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
