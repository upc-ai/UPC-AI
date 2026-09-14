import type { MetadataRoute } from "next";

/**
 * sitemap.xml — static marketing pages. The knowledge base is chat-only
 * (proprietary); no document pages are exposed.
 */
const SITE = "https://upcai.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const pages: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
    { path: "/blog", priority: 0.8, changeFrequency: "weekly" },
    { path: "/security", priority: 0.7, changeFrequency: "monthly" },
    { path: "/guide", priority: 0.8, changeFrequency: "monthly" },
    { path: "/about", priority: 0.8, changeFrequency: "monthly" },
    { path: "/knowledge", priority: 0.7, changeFrequency: "monthly" },
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
