import type { MetadataRoute } from "next";

/**
 * robots.txt — marketing pages are indexable; the app itself is not.
 * /chat and /admin are private (auth-gated), /api is machine-only, and the
 * auth pages carry no search value for students looking up the college.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/chat", "/admin", "/api/", "/login", "/signup", "/verify", "/forgot-password"],
      },
    ],
    sitemap: "https://upcai.app/sitemap.xml",
  };
}
