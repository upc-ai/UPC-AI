/**
 * HARVEST-ONLY crawl of the college website (user directive 2026-09-05):
 * collect all raw data to disk FIRST — no database, no ingest pipeline,
 * no embeddings, nothing published. We review what exists, then plan the RAG
 * organization together.
 *
 * Output → to-import/crawl/
 *   pages/NNN---Title.html    raw page HTML (the source of truth)
 *   pages/NNN---Title.txt     auto-extracted plain text (review convenience)
 *   pdfs/NNN---name.pdf      linked PDF binaries
 *   manifest.json            [{ file, url, title, kind, bytes, fetchedAt }]
 *
 * Usage: pnpm harvest:site -- [--url https://www.upcollege.ac.in/] [--pages 200] [--pdfs 100] [--depth 4]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { crawlCollegeSite, type CrawledPage } from "../src/modules/sync/crawler";

const OUT_DIR = path.resolve(import.meta.dirname, "../../../to-import/crawl");

function safeName(title: string, fallbackUrl: string, index: number): string {
  const raw = (title || "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (raw) return `${String(index).padStart(3, "0")}---${raw}`;
  const slug = new URL(fallbackUrl).pathname.split("/").filter(Boolean).pop() ?? "untitled";
  return `${String(index).padStart(3, "0")}---${decodeURIComponent(slug)}`;
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const url = get("--url") ?? process.env.COLLEGE_WEBSITE_URL ?? "https://www.upcollege.ac.in/";
  const maxPages = Number(get("--pages") ?? 200);
  const maxPdfs = Number(get("--pdfs") ?? 100);
  const maxDepth = Number(get("--depth") ?? 4);
  if (!/^https?:\/\//.test(url)) throw new Error(`Invalid URL: ${url}`);

  const pagesDir = path.join(OUT_DIR, "pages");
  const pdfsDir = path.join(OUT_DIR, "pdfs");
  await mkdir(pagesDir, { recursive: true });
  await mkdir(pdfsDir, { recursive: true });

  console.log(`[harvest] ${url}  budget: ${maxPages} pages, ${maxPdfs} PDFs, depth ${maxDepth}`);
  console.log(`[harvest] output: ${OUT_DIR}`);
  console.log(`[harvest] NO database, NO ingestion, NO embeddings — raw data only.\n`);

  const manifest: { file: string; url: string; title: string; kind: "html" | "pdf"; bytes: number; fetchedAt: string }[] = [];
  let htmlCount = 0;
  let pdfCount = 0;

  await crawlCollegeSite(url, {
    maxPages,
    maxPdfs,
    maxDepth,
    onPage: async (page: CrawledPage) => {
      try {
        if (page.kind === "html") {
          const name = safeName(page.title, page.url, ++htmlCount);
          const base = path.join(pagesDir, name);
          await writeFile(`${base}.html`, page.html ?? "", "utf-8");
          await writeFile(`${base}.txt`, page.text, "utf-8");
          manifest.push({
            file: `pages/${name}.html`,
            url: page.url,
            title: page.title,
            kind: "html",
            bytes: Buffer.byteLength(page.html ?? ""),
            fetchedAt: new Date().toISOString(),
          });
          console.log(`[page ${htmlCount}] ${page.title.slice(0, 70)}  (${page.url})`);
        } else {
          // PDF titles are URL basenames that already end in .pdf — strip it
          const name = safeName(page.title.replace(/\.pdf$/i, ""), page.url, ++pdfCount);
          const file = path.join(pdfsDir, `${name}.pdf`);
          await writeFile(file, page.bytes!);
          manifest.push({
            file: `pdfs/${name}.pdf`,
            url: page.url,
            title: page.title,
            kind: "pdf",
            bytes: page.bytes!.length,
            fetchedAt: new Date().toISOString(),
          });
          console.log(`[pdf ${pdfCount}] ${page.title.slice(0, 70)}  (${(page.bytes!.length / 1024).toFixed(0)} KB)`);
        }
      } catch (err) {
        console.log(`[save-failed] ${page.url} — ${err instanceof Error ? err.message : err}`);
      }
    },
  });

  await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

  console.log("\n────────────── Harvest report ──────────────");
  console.log(`Pages:  ${manifest.filter((m) => m.kind === "html").length}`);
  console.log(`PDFs:   ${manifest.filter((m) => m.kind === "pdf").length}`);
  console.log(`Total:  ${manifest.length} items → ${OUT_DIR}`);
  console.log(`manifest.json lists every file with its source URL.`);
  console.log("[harvest] done — review the data, then we plan the RAG organization together.");
  process.exit(0);
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
