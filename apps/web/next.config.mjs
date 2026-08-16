/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@upc/core", "@upc/db", "@upc/ui"],
  experimental: {
    // SSE streaming endpoints must not be buffered
    proxyTimeout: 120_000,
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
