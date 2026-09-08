// OCR pass: transcribe the scanned PDFs to Markdown via Gemini vision, then
// update curation.csv (scanned row → superseded; new .md row → include=Y).
// Uses the same AI_CUSTOM_PROVIDERS Gemini key as the rest of the pipeline.
// Paced + retried for free-tier quota. Resumable: skips PDFs already OCR'd.
// Run: node scripts/ocr-scanned.mjs   (from apps/web)
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../../../to-import/crawl");
const OCR_DIR = path.join(OUT, "ocr");
const CSV_PATH = path.resolve(import.meta.dirname, "../../../to-import/curation.csv");
const MAX_INLINE_BYTES = 13 * 1024 * 1024; // base64 inflates 4/3 — stay under the ~20MB provider cap
const PAUSE_MS = 8_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function geminiKey() {
  // Prefer keys with fresh vision quota: BACKUP2 → BACKUP → GEMINI_API_KEY → chat key.
  for (const k of [process.env.GEMINI_API_KEY_BACKUP2, process.env.GEMINI_API_KEY_BACKUP, process.env.GEMINI_API_KEY]) {
    if (k?.trim()) return { key: k.trim(), baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.5-flash" };
  }
  const customs = JSON.parse(process.env.AI_CUSTOM_PROVIDERS ?? "[]");
  const p = customs.find((x) => /generativelanguage/.test(x.baseUrl));
  if (!p) throw new Error("no Gemini provider in AI_CUSTOM_PROVIDERS");
  return { key: p.apiKey, baseUrl: p.baseUrl.replace(/\/$/, ""), model: "gemini-3.5-flash" };
}

async function transcribePdf(cfg, bytes) {
  const dataUrl = `data:application/pdf;base64,${bytes.toString("base64")}`;
  const body = {
    model: cfg.model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Transcribe this scanned document to Markdown EXACTLY. Preserve: every heading as '## ', lists as '- ', tables as | pipe | rows with a header row, and the page order. Transcribe ALL text including Hindi exactly as written. Output ONLY the markdown transcription — no commentary, no code fences.",
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0,
    max_tokens: 8000,
  };
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        if (res.status === 429 || res.status >= 500) {
          console.log(`  [retry ${attempt + 1}] ${res.status} — backing off`);
          await sleep(15_000 * 2 ** attempt);
          continue;
        }
        return { error: `HTTP ${res.status}: ${detail.slice(0, 200)}` };
      }
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content ?? "";
      if (!text.trim() || text.trim().length < 100) return { error: "transcription too short" };
      return { md: text.replace(/^```markdown\s*/i, "").replace(/```\s*$/, "").trim() };
    } catch (err) {
      if (attempt < 3) {
        console.log(`  [retry ${attempt + 1}] ${err instanceof Error ? err.message : err}`);
        await sleep(15_000 * 2 ** attempt);
        continue;
      }
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return { error: "retries exhausted" };
}

async function main() {
  mkdirSync(OCR_DIR, { recursive: true });
  const cfg = geminiKey();
  const rows = csvParse(readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, ""));
  const header = rows[0];
  const data = rows.slice(1).filter((r) => r.length >= 8);

  const scanned = data.filter((r) => r[2] === "pdf" && r[7] === "scanned");
  console.log(`[ocr] ${scanned.length} scanned PDFs queued; model ${cfg.model}; output ${OCR_DIR}`);

  let ok = 0;
  const failed = [];
  const oversized = [];
  for (let i = 0; i < scanned.length; i++) {
    const r = scanned[i];
    const pdfRel = r[1];
    const pdfAbs = path.join(OUT, pdfRel);
    const mdName = path.basename(pdfRel).replace(/\.pdf$/i, "") + ".md";
    const mdAbs = path.join(OCR_DIR, mdName);
    if (existsSync(mdAbs)) {
      ok++;
      console.log(`[skip-done ${i + 1}/${scanned.length}] ${mdName}`);
      continue;
    }
    const bytes = readFileSync(pdfAbs);
    if (bytes.length > MAX_INLINE_BYTES) {
      oversized.push(pdfRel);
      console.log(`[oversized ${i + 1}/${scanned.length}] ${mdName} (${(bytes.length / 1048576).toFixed(1)} MB — needs page-split step)`);
      continue;
    }
    process.stdout.write(`[ocr ${i + 1}/${scanned.length}] ${mdName} …\n`);
    const result = await transcribePdf(cfg, bytes);
    if (result.error) {
      failed.push({ file: mdName, reason: result.error });
      console.log(`  [failed] ${result.error}`);
      continue;
    }
    writeFileSync(mdAbs, result.md, "utf-8");
    ok++;
    console.log(`  [ok] ${(result.md.length / 1024).toFixed(0)} KB of markdown`);
    await sleep(PAUSE_MS);
  }

  // Update curation.csv: flip OCR'd rows to superseded, append .md rows
  if (ok > 0) {
    const ocrRows = [];
    for (const r of data) {
      if (r[2] === "pdf" && r[7] === "scanned") {
        const mdName = path.basename(r[1]).replace(/\.pdf$/i, "") + ".md";
        if (existsSync(path.join(OCR_DIR, mdName))) {
          r[0] = "N";
          r[8] = (r[8] ? r[8] + "; " : "") + "superseded by OCR markdown";
          ocrRows.push([
            "Y", `ocr/${mdName}`, "md", r[3], r[4], r[5], r[6], "ocr-extracted", `Gemini vision OCR of ${path.basename(r[1])}`,
          ].map(csvEscape).join(","));
        }
      }
    }
    const out = "\uFEFF" + [header.join(","), ...data.map((r) => r.map(csvEscape).join(",")), ...ocrRows].join("\n");
    writeFileSync(CSV_PATH, out, "utf-8");
    console.log(`[curation] +${ocrRows.length} OCR .md rows (include=Y), scanned originals flipped to N`);
  }

  console.log("\n────── OCR report ──────");
  console.log(`transcribed: ${ok}/${scanned.length}`);
  console.log(`oversized (need page-split): ${oversized.length}`);
  console.log(`failed: ${failed.length}`);
  for (const f of failed) console.log(`  ✗ ${f.file}: ${f.reason}`);
  for (const f of oversized) console.log(`  ⚠ ${f}`);
  console.log(`\nNext: re-run pnpm import:curated — the .md files import like any other document.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
