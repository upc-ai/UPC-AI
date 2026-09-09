// Debug why 4 specific scanned PDFs return "transcription too short".
// Sends ONE of them to Gemini with full debug output of the raw response.
// Run: node scripts/ocr-debug-one.mjs "syllabus-UGArtsBA-HISTORY-1jOl2Z" (from apps/web)
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { readFileSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../../../to-import/crawl");
const name = process.argv[2] ?? "syllabus-UGArtsBA-HISTORY-1jOl2Z";

// find the original scanned PDF for this .md name
const manifest = JSON.parse(readFileSync(path.join(OUT, "manifest.json"), "utf-8"));
const entry = manifest.find((m) => m.file.endsWith(`${name}.pdf`));
if (!entry) {
  console.log("No manifest entry for", name, "— available candidates:");
  for (const m of manifest) if (m.kind === "pdf" && m.title.toLowerCase().includes(name.split("-")[1]?.slice(0, 6) ?? "")) console.log("  ", m.file, m.url);
  process.exit(1);
}
console.log("probing:", entry.file, "|", entry.url);

const pdfBytes = readFileSync(path.join(OUT, entry.file));
console.log("size:", (pdfBytes.length / 1048576).toFixed(1), "MB");

// fresh key with vision quota
const key = process.env.GEMINI_API_KEY; // key-2 — vision confirmed 200 in latest probe
const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model: "gemini-3.5-flash",
    messages: [
      { role: "user", content: [
        { type: "text", text: "Transcribe this document to Markdown. Headings as ##, lists as -, tables as | pipes. ALL text, Hindi included. Output ONLY the transcription." },
        { type: "image_url", image_url: { url: `data:application/pdf;base64,${pdfBytes.toString("base64")}` } },
      ] },
    ],
    temperature: 0,
    max_tokens: 8000,
  }),
  signal: AbortSignal.timeout(180_000),
});
console.log("HTTP:", res.status);
const json = await res.json();
const choice = json.choices?.[0];
const content = choice?.message?.content ?? "";
console.log("finish_reason:", choice?.finish_reason ?? json.choices?.[0]?.finish_reason);
console.log("usage:", JSON.stringify(json.usage ?? {}));
console.log("content length:", content.length);
console.log("--- first 600 chars ---");
console.log(content.slice(0, 600));
if (content.length < 100) {
  console.log("--- FULL raw choice object (diagnosing emptiness) ---");
  console.log(JSON.stringify(choice, null, 2).slice(0, 2000));
}
