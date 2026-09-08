// Summarize the harvest for review. Run: node scripts/harvest-summary.mjs
import { readFileSync, statSync, readdirSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "../../../to-import/crawl");
const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf-8"));

const pages = manifest.filter((m) => m.kind === "html");
const pdfs = manifest.filter((m) => m.kind === "pdf");
const totalBytes = manifest.reduce((a, m) => a + m.bytes, 0);

console.log(`items: ${manifest.length} (${pages.length} pages, ${pdfs.length} PDFs)`);
console.log(`total size: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);

// Group pages by first URL path segment = site section
const sections = {};
for (const p of pages) {
  const seg = new URL(p.url).pathname.split("/").filter(Boolean)[0] ?? "(root)";
  sections[seg] = (sections[seg] ?? 0) + 1;
}
console.log("\npage sections:");
for (const [k, v] of Object.entries(sections).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(3)}  /${k}`);
}

console.log("\nPDF files on disk but NOT in manifest (leftovers):");
const disk = new Set(readdirSync(path.join(dir, "pdfs")));
const inManifest = new Set(pdfs.map((p) => path.basename(p.file)));
const orphans = [...disk].filter((f) => !inManifest.has(f));
console.log(orphans.length ? orphans.map((o) => `  ${o}`).join("\n") : "  none");

// Largest PDFs
console.log("\n10 largest PDFs:");
for (const p of [...pdfs].sort((a, b) => b.bytes - a.bytes).slice(0, 10)) {
  console.log(`  ${(p.bytes / 1024 / 1024).toFixed(1)} MB  ${path.basename(p.file)}  (${p.url})`);
}
