import type { MetadataRoute } from "next";

/**
 * sitemap.xml — the public marketing pages. Private/auth-gated routes
 * (/chat, /admin, auth pages) are excluded via robots.ts and never listed.
 */
const SITE = "https://upcai.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const pages: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/about", priority: 0.8, changeFrequency: "monthly" },
    { path: "/knowledge", priority: 0.8, changeFrequency: "monthly" },
    { path: "/study-tools", priority: 0.8, changeFrequency: "monthly" },
    { path: "/for-faculty", priority: 0.7, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "monthly" },
    { path: "/terms", priority: 0.3, changeFrequency: "monthly" },
    { path: "/accessibility", priority: 0.3, changeFrequency: "monthly" },
  ];
  return pages.map((p) => ({
    url: `${SITE}${p.path}`,
    lastModified,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
