// One-off cleanup after the crashed first harvest run: remove the 13 orphan
// PDFs (old numbering, present on disk but not in manifest.json) and fix the
// ".pdf.pdf" double extension on files whose title already ended in .pdf.
import { readFileSync, readdirSync, renameSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "../../../to-import/crawl");
const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf-8"));
const pdfDir = path.join(dir, "pdfs");

// 1. Delete orphans (files on disk not referenced by the manifest)
const referenced = new Set(manifest.map((m) => path.basename(m.file)));
const disk = readdirSync(pdfDir);
let removed = 0;
for (const f of disk) {
  if (!referenced.has(f)) {
    unlinkSync(path.join(pdfDir, f));
    removed++;
    console.log(`orphan removed: ${f}`);
  }
}
console.log(`${removed} orphans removed`);

// 2. Fix double extensions: update both disk name and manifest entries
let renamed = 0;
for (const m of manifest) {
  const base = path.basename(m.file); // e.g. 026---xxx.pdf.pdf
  const fixed = base.replace(/\.pdf\.pdf$/i, ".pdf");
  if (fixed !== base) {
    const from = path.join(pdfDir, base);
    const to = path.join(pdfDir, fixed);
    if (existsSync(from)) renameSync(from, to);
    m.file = m.file.replace(base, fixed);
    renamed++;
  }
}
console.log(`${renamed} files renamed (.pdf.pdf → .pdf)`);

// 3. Re-write the manifest with corrected names
const fs = await import("node:fs/promises");
await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

// Final state
const after = readdirSync(pdfDir);
const verify = after.every((f) => referenced.has(f) || manifest.some((m) => path.basename(m.file) === f));
console.log(`pdfs on disk: ${after.length}, manifest pdfs: ${manifest.filter((m) => m.kind === "pdf").length}, consistent: ${verify}`);
