import type { MetadataRoute } from "next";

/**
 * robots.txt — marketing + /college knowledge pages are indexable; the app
 * itself is not. AI crawler user-agents are explicitly ALLOWED (GEO): being
 * cited by ChatGPT, Google AI Overviews and Perplexity is a goal, not a risk.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // AI engines: full access to public content (GEO)
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/" })),
      // Search engines: marketing + /college yes; private app surfaces no
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/chat", "/admin", "/api/", "/login", "/signup", "/verify", "/forgot-password"],
      },
    ],
    sitemap: "https://upcai.app/sitemap.xml",
  };
}
