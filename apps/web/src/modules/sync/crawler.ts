/**
 * College-website crawler + sync (RAG v2): admin-triggered, same-domain,
 * polite. Extracts page text and linked PDFs, dedupes by content hash, and
 * hands each unit to the sync route which runs the standard ingest pipeline.
 *
 * Constraints (plan decisions): depth ≤ 3, ≤ 30 pages + ≤ 10 PDFs, 300 ms
 * politeness delay, custom UA, same-domain only, manual trigger only. No new
 * dependencies — link extraction is regex over <a href>.
 */

const MAX_PAGES = 30;
const MAX_PDFS = 10;
const MAX_DEPTH = 3;
const POLITENESS_MS = 300;
const UA = "UPCAI-KnowledgeSync/1.0 (+https://upcai.app; college knowledge base sync)";

export interface CrawledPage {
  url: string;
  title: string;
  /** Extracted readable text (html stripped). */
  text: string;
  kind: "html" | "pdf";
  /** Raw bytes for PDFs (fed to the ingest pipeline). */
  bytes?: Buffer;
}

/** Extract same-domain links from raw HTML. */
export function extractLinks(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  const base = new URL(baseUrl);
  // Capture up to the closing quote; hashes/queries are stripped post-parse
  // (excluding '#' in the class would drop href="/page#section" entirely).
  const hrefs = html.matchAll(/<a\s[^>]*href\s*=\s*["']([^"']+)["']/gi);
  for (const m of hrefs) {
    try {
      const u = new URL(m[1]!, base);
      u.hash = "";
      u.search = ""; // avoid crawl loops over query permutations
      if (u.hostname !== base.hostname) continue;
      if (!/^https?:$/.test(u.protocol)) continue;
      const path = u.pathname.toLowerCase();
      if (/\.(jpg|jpeg|png|gif|webp|svg|css|js|ico|zip|rar|mp4|mp3|avi|exe|dmg|doc|docx|xls|xlsx|ppt|pptx)$/.test(path)) {
        continue; // binaries the pipeline doesn't handle; pdf handled separately
      }
      out.add(u.toString());
    } catch {
      /* malformed href — skip */
    }
  }
  return [...out];
}

/** Pull a best-effort <title> from raw HTML. */
export function extractTitle(html: string, fallbackUrl: string): string {
  const m = html.match(/<title[^>]*>([\s\S]{1,300}?)<\/title>/i);
  const t = m?.[1]?.replace(/\s+/g, " ").trim();
  if (t) return t;
  const path = new URL(fallbackUrl).pathname.replace(/\/$/, "").split("/").filter(Boolean).pop();
  return path ? decodeURIComponent(path).replace(/[-_]+/g, " ") : fallbackUrl;
}

/** Minimal HTML → text (mirrors ingest/parse.ts htmlToText, minus headings markup). */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<h[1-6][^>]*>/gi, "\n\n## ")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url: string, ms: number): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(ms),
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

/**
 * Crawl the college website. Breadth-first, same-domain, budgeted. Returns
 * readable text pages first, then up to MAX_PDFS linked PDF binaries.
 */
export async function crawlCollegeSite(startUrl: string): Promise<CrawledPage[]> {
  const start = new URL(startUrl);
  const seen = new Set<string>([startUrl]);
  const pages: CrawledPage[] = [];
  const pdfs: CrawledPage[] = [];
  const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const { url, depth } = queue.shift()!;
    const res = await fetchWithTimeout(url, 15_000);
    if (!res) continue;
    const ctype = res.headers.get("content-type") ?? "";
    if (ctype.includes("text/html") || ctype.includes("xhtml")) {
      const html = await res.text();
      const text = htmlToText(html);
      if (text.length >= 150) {
        // skip nav-shell pages with no real content
        pages.push({ url, title: extractTitle(html, url), text, kind: "html" });
      }
      if (depth < MAX_DEPTH) {
        for (const link of extractLinks(html, url)) {
          if (!seen.has(link)) {
            seen.add(link);
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      }
      // Collect linked PDFs as we go (they live on any page's anchors)
      const pdfLinks = html.matchAll(/<a\s[^>]*href\s*=\s*["']([^"'#]+\.pdf)["']/gi);
      for (const m of pdfLinks) {
        try {
          const u = new URL(m[1]!, start);
          if (u.hostname !== start.hostname) continue;
          const key = u.toString();
          if (pdfs.some((p) => p.url === key)) continue;
          if (pdfs.length >= MAX_PDFS) break;
          pdfs.push({ url: key, title: "", text: "", kind: "pdf" });
        } catch {
          /* skip */
        }
      }
    }
    await sleep(POLITENESS_MS);
  }

  // Fetch the collected PDFs (they flow through the full parse pipeline)
  for (const p of pdfs) {
    if (pages.length + pdfs.filter((x) => x.bytes).length >= MAX_PAGES + MAX_PDFS) break;
    const res = await fetchWithTimeout(p.url, 30_000);
    if (!res) continue;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 1000) continue; // 404 HTML bodies etc.
    p.bytes = bytes;
    p.title = decodeURIComponent(new URL(p.url).pathname.split("/").pop() ?? "document.pdf");
    await sleep(POLITENESS_MS);
  }

  return [...pages, ...pdfs.filter((p) => p.bytes)];
}
