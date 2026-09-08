// Harvest the syllabus PDFs that the main crawl missed. Two sources:
//  1) site-hosted /Upload/syllabus/*.pdf and /document/pdf/syllabus/** (direct URLs)
//  2) Google Drive files — NOT downloaded (out of scope: cross-domain, login-free
//     but TOS-ambiguous; recorded in manifest for the user to decide)
// Uses the listing pages to discover titles next to each link.
// Run: node scripts/harvest-syllabus.mjs   (from apps/web)
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const UA = "UPCAI-KnowledgeSync/1.0 (+https://upcai.app; college knowledge base sync)";
const OUT = path.resolve(import.meta.dirname, "../../../to-import/crawl");
const PDFS = path.join(OUT, "pdfs");
const MANIFEST = path.join(OUT, "manifest.json");

const LIST_PAGES = [
  { url: "https://www.upcollege.ac.in/course/list/ug?course=1", label: "UG Arts (BA)" },
  { url: "https://www.upcollege.ac.in/course/list/ug?course=2", label: "UG Science (BSc)" },
  { url: "https://www.upcollege.ac.in/course/list/ug?course=3", label: "UG Agriculture (BSc Ag)" },
  { url: "https://www.upcollege.ac.in/course/list/ug?course=4", label: "UG Commerce (BCom)" },
  { url: "https://www.upcollege.ac.in/course/list/ug?course=5", label: "UG Education (BEd)" },
  { url: "https://www.upcollege.ac.in/course/syllabusdiploma", label: "Diploma" },
  { url: "https://www.upcollege.ac.in/course/syllabusvocational", label: "Vocational" },
  { url: "https://www.upcollege.ac.in/course/minorsyllabus/all", label: "Minor" },
  { url: "https://www.upcollege.ac.in/course/syllabus", label: "Syllabus index" },
];

// label for subject from the anchor's own text or a preceding cell
function subjectLabel(anchorHtml) {
  const t = anchorHtml.match(/>([^<>]{2,80})<\/a>/);
  return t?.[1]?.replace(/\s+/g, " ").trim();
}

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf-8")) : [];
const driveSeen = new Set(manifest.filter((m) => m.kind === "drive").map((m) => m.url));
const pdfUrls = new Set(manifest.filter((m) => m.kind === "pdf").map((m) => m.url));
let saved = 0;

async function fetchTimeout(url, ms) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(ms) });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

const newEntries = [];

for (const { url, label } of LIST_PAGES) {
  const res = await fetchTimeout(url, 20000);
  if (!res) { console.log(`[skip] ${label} — fetch failed`); continue; }
  const html = await res.text();

  // also save the listing pages themselves (they have subject names/titles)
  const pageName = `listing---${label.replace(/[^\w]+/g, "-")}.html`;
  await writeFile(path.join(OUT, "pages", `200---${pageName}`), html, "utf-8");
  console.log(`[page] saved listing: ${label}`);

  // site-hosted PDFs with subject labels: <a ... href="/Upload/syllabus/x.pdf">SUBJECT</a>
  const sitePdfs = [...html.matchAll(/<a\s[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]{0,120}?)<\/a>/gi)]
    .map((m) => ({ href: m[1], label: (m[2] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }))
    .filter((p) => /syllabus/i.test(p.href));
  for (const p of sitePdfs) {
    const abs = new URL(p.href, url).toString();
    if (pdfUrls.has(abs)) continue;
    pdfUrls.add(abs);
    const dl = await fetchTimeout(abs, 30000);
    if (!dl) { console.log(`[pdf-fail] ${abs}`); continue; }
    let bytes;
    try { bytes = Buffer.from(await dl.arrayBuffer()); } catch { console.log(`[pdf-timeout] ${abs}`); continue; }
    if (bytes.length < 1000) { console.log(`[pdf-skip] ${abs} (${bytes.length}b)`); continue; }
    const subject = p.label || decodeURIComponent(abs.split("/").pop() ?? "syllabus");
    const name = `syllabus-${label.replace(/[^\w]+/g, "")}-${subject.replace(/[^\w\u0900-\u097F]+/g, "-").slice(0, 50)}`.replace(/\.pdf$/i, "");
    const file = `pdfs/${name}.pdf`;
    await writeFile(path.join(OUT, file), bytes);
    newEntries.push({ file, url: abs, title: `[Syllabus ${label}] ${subject}`, kind: "pdf", bytes: bytes.length, fetchedAt: new Date().toISOString() });
    saved++;
    console.log(`[pdf ${saved}] ${label} / ${subject}  (${(bytes.length / 1024).toFixed(0)} KB)`);
  }

  // Google Drive links: record only (user decides later)
  const drive = [...html.matchAll(/https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/view[^"']*/g)];
  for (const d of drive) {
    const abs = `https://drive.google.com/file/d/${d[1]}/view`;
    if (driveSeen.has(abs)) continue;
    driveSeen.add(abs);
    newEntries.push({ file: "", url: abs, title: `[Syllabus ${label}] Google Drive file (not downloaded)`, kind: "drive", bytes: 0, fetchedAt: new Date().toISOString() });
    console.log(`[drive] ${label} — ${abs} (recorded, not downloaded)`);
  }
}

if (newEntries.length) {
  manifest.push(...newEntries);
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2), "utf-8");
}

const driveCount = manifest.filter((m) => m.kind === "drive").length;
console.log(`\n── syllabus harvest report ──`);
console.log(`site PDFs saved this run: ${saved}`);
console.log(`Google Drive links recorded (not downloaded): ${driveCount} total in manifest`);
console.log(`manifest now: ${manifest.length} entries`);
