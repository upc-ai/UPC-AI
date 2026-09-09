// Workaround probe for recitation-blocked scans: condensed structured
// extraction instead of verbatim transcription. Run: node scripts/ocr-workaround.mjs (apps/web)
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../../../to-import/crawl");
const OCR_DIR = path.join(OUT, "ocr");
const manifest = JSON.parse(readFileSync(path.join(OUT, "manifest.json"), "utf-8"));

const TARGETS = [
  "syllabus-UGArtsBA-HISTORY-1jOl2Z",
  "syllabus-UGAgricultureBScAg-Agriculture-Engineering-6th-Deans-Committee",
  "syllabus-UGAgricultureBScAg-AG-BOTANY-GPB--1GhBbs",
  "syllabus-Vocational-Retail-Management",
];

const key = process.env.GEMINI_API_KEY; // key-2 — vision confirmed fresh
const PROMPT =
  "This is a scanned university syllabus document. Extract its factual content as structured Markdown: program/subject names, course codes, unit titles with their topics, lecture/tutorial hours, marks distribution, eligibility, and recommended readings. Condense prose into bullet points — do NOT reproduce long passages verbatim. Output ONLY the structured Markdown.";

let okCount = 0;
for (const name of TARGETS) {
  const entry = manifest.find((m) => m.file.endsWith(`${name}.pdf`));
  if (!entry) { console.log(`[skip] no manifest entry for ${name}`); continue; }
  const mdPath = path.join(OCR_DIR, `${name}.md`);
  if (existsSync(mdPath)) { console.log(`[skip] ${name} already exists`); continue; }
  const bytes = readFileSync(path.join(OUT, entry.file));
  console.log(`[workaround] ${name} (${(bytes.length / 1048576).toFixed(1)} MB)…`);
  // up to 4 attempts — 503/timeouts are transient overload, backoff 30s→60s→120s
  let recovered = false;
  for (let attempt = 0; attempt < 4 && !recovered; attempt++) {
    if (attempt > 0) {
      const wait = 30_000 * 2 ** (attempt - 1);
      console.log(`  [retry ${attempt}] waiting ${wait / 1000}s…`);
      await new Promise((r) => setTimeout(r, wait));
    }
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "gemini-3.5-flash",
          messages: [{ role: "user", content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${bytes.toString("base64")}` } },
          ] }],
          temperature: 0.2,
          max_tokens: 8000,
        }),
        signal: AbortSignal.timeout(300_000),
      });
      if (res.status === 429 || res.status === 503) { console.log(`  [busy] HTTP ${res.status}`); continue; }
      if (!res.ok) { console.log(`  [fail] HTTP ${res.status}`); break; }
      const json = await res.json();
      const choice = json.choices?.[0];
      const content = choice?.message?.content ?? "";
      console.log(`  finish_reason: ${choice?.finish_reason} | content: ${content.length} chars`);
      if (String(choice?.finish_reason ?? "").includes("content_filter")) { console.log("  [blocked] recitation filter — prompt workaround cannot pass"); break; }
      if (content.trim().length < 100) { console.log("  [fail] still too short"); continue; }
      const fs = await import("node:fs/promises");
      await fs.writeFile(mdPath, content.trim(), "utf-8");
      okCount++;
      recovered = true;
      console.log(`  [OK] saved ${name}.md (${(content.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.log(`  [retryable] ${err instanceof Error ? err.message : err}`);
    }
  }
}
console.log(`\nworkaround done: ${okCount}/${TARGETS.length} recovered`);
process.exit(0);
