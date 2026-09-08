// Sync curation.csv with the OCR output on disk: for every .md in ocr/ that
// has no row yet, flip its scanned-PDF original to include=N (superseded) and
// append an include=Y .md row. Run after an interrupted OCR pass.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../../../to-import/crawl");
const OCR_DIR = path.join(OUT, "ocr");
const CSV_PATH = path.resolve(import.meta.dirname, "../../../to-import/curation.csv");

function csvParse(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function csvEscape(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const text = readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
const rows = csvParse(text);
const header = rows[0];
const data = rows.slice(1).filter((r) => r.length >= 8);

// Map: pdf basename (no ext) → row index, and set of .md basenames already listed
const pdfRowByBase = new Map();
const mdListed = new Set();
for (let i = 0; i < data.length; i++) {
  const file = data[i][1] ?? "";
  if (file.startsWith("pdfs/")) pdfRowByBase.set(path.basename(file).replace(/\.pdf$/i, ""), i);
  if (file.startsWith("ocr/")) mdListed.add(path.basename(file).replace(/\.md$/i, ""));
}

const newRows = [];
let flipped = 0;
for (const f of readdirSync(OCR_DIR)) {
  if (!f.endsWith(".md")) continue;
  const base = f.replace(/\.md$/, "");
  if (mdListed.has(base)) continue;
  const rowIdx = pdfRowByBase.get(base);
  if (rowIdx === undefined) {
    console.log(`[sync] no scanned-PDF row found for ${f} — appending as standalone`);
    newRows.push(["Y", `ocr/${f}`, "md", "", base.replace(/-/g, " ").slice(0, 80), "notices", "hi", "ocr-extracted", `Gemini vision OCR (no original row)`].map(csvEscape).join(","));
    continue;
  }
  const r = data[rowIdx];
  if (r[0] !== "N") { r[0] = "N"; r[8] = (r[8] ? r[8] + "; " : "") + "superseded by OCR markdown"; flipped++; }
  newRows.push(["Y", `ocr/${f}`, "md", r[3], r[4], r[5], r[6], "ocr-extracted", `Gemini vision OCR of ${path.basename(r[1] ?? base)}`].map(csvEscape).join(","));
}

if (newRows.length) {
  const out = "\uFEFF" + [header.join(","), ...data.map((r) => r.map(csvEscape).join(",")), ...newRows].join("\n");
  writeFileSync(CSV_PATH, out, "utf-8");
}
console.log(`[sync] ${newRows.length} .md rows appended, ${flipped} scanned originals flipped to N`);
console.log(`[sync] curation now lists ${(data.filter((r) => (r[1] ?? "").startsWith("ocr/")).length + newRows.length)} OCR rows`);
