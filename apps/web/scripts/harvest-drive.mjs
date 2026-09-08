// Download the 30 Google-Drive syllabus files recorded in manifest.json
// (kind:"drive"). Subject names are re-derived from the saved listing pages.
// Strategy: direct usercontent endpoint with confirm=t first (usually serves
// the file immediately), then the uc?export=download + confirm-form dance.
// Every network call is fully guarded — a failed file skips, never crashes.
// Run: node scripts/harvest-drive.mjs   (from apps/web)
import { writeFile } from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const UA = "UPCAI-KnowledgeSync/1.0 (+https://upcai.app; college knowledge base sync)";
const OUT = path.resolve(import.meta.dirname, "../../../to-import/crawl");
const PDFS = path.join(OUT, "pdfs");
const MANIFEST = path.join(OUT, "manifest.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. Map drive file-id → subject from the saved listing pages ──────────
// Real structure (verified): <th><a href="https://drive.google.com/file/d/ID/…">ANCIENT HISTORY</a></th>
// — the anchor text IS the subject. Fallback: enclosing row's cell text.
const subjectById = new Map();
for (const f of readdirSync(path.join(OUT, "pages"))) {
  if (!/^200---listing.*\.html$/.test(f)) continue;
  const html = readFileSync(path.join(OUT, "pages", f), "utf-8");
  const program = f.replace(/^200---listing---/, "").replace(/\.html$/, "").replace(/-+$/, "").replace(/-/g, " ");
  for (const a of html.matchAll(
    /<a\s[^>]*href="https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/view[^"]*"[^>]*>([\s\S]{0,300}?)<\/a>/gi,
  )) {
    const text = a[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text && !/syllabus|download|view|click/i.test(text)) {
      subjectById.set(a[1], { subject: text, program });
    }
  }
  // Fallback rows (anchor text empty → take first sensible cell in the row)
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const drive = row[1].match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (!drive || subjectById.has(drive[1])) continue;
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    );
    const subject = cells.find((c) => c && !/^\d+$/.test(c) && !/syllabus|download|view|click/i.test(c));
    if (subject) subjectById.set(drive[1], { subject, program });
  }
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf-8"));
const driveEntries = manifest.filter((m) => m.kind === "drive");
console.log(`[drive] ${driveEntries.length} Drive links; ${subjectById.size} subjects mapped`);

// ── 2. Network helpers (everything guarded; body reads included) ────────
async function safeFetch(url, ms) {
  try {
    return await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(ms),
    });
  } catch {
    return null;
  }
}

async function safeBody(res) {
  try {
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function looksLikePdf(buf) {
  return buf.subarray(0, 5).toString("latin1") === "%PDF-";
}

/** One full attempt to fetch the file bytes. Returns {buf|error}. */
async function attemptDownload(id) {
  // Strategy A: direct usercontent endpoint (confirm=t serves most files)
  let res = await safeFetch(
    `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
    60_000,
  );
  if (res) {
    let buf = await safeBody(res);
    if (buf && looksLikePdf(buf)) return { buf };
    // Maybe an HTML confirm page with a form — parse it
    if (buf && buf.subarray(0, 200).toString("latin1").includes("<!DOCTYPE html")) {
      const html = buf.toString("utf-8");
      const action = html.match(/action="([^"]*download[^"]*)"/)?.[1];
      const params = {};
      for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)) {
        params[m[1]] = m[2];
      }
      if (action && params.id) {
        const url = new URL(action, "https://drive.usercontent.google.com/");
        for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
        url.searchParams.set("confirm", "1");
        const res2 = await safeFetch(url.toString(), 90_000);
        if (res2) {
          const buf2 = await safeBody(res2);
          if (buf2 && (looksLikePdf(buf2) || !buf2.subarray(0, 200).toString("latin1").includes("<!DOCTYPE html"))) {
            return { buf: buf2 };
          }
        }
      }
    }
  }
  // Strategy B: classic uc endpoint
  res = await safeFetch(`https://drive.google.com/uc?export=download&id=${id}`, 60_000);
  if (res) {
    const buf = await safeBody(res);
    if (buf && looksLikePdf(buf)) return { buf };
    const cd = res.headers.get("content-disposition") ?? "";
    if (buf && cd.includes("attachment") && !buf.subarray(0, 100).toString("latin1").includes("<!DOCTYPE")) {
      return { buf };
    }
  }
  return { error: "all strategies failed (timeout or permission wall)" };
}

function extFor(buf, contentType = "") {
  if (looksLikePdf(buf)) return "pdf";
  if (/jpeg|jpg/.test(contentType)) return "jpg";
  if (/png/.test(contentType)) return "png";
  if (/msword/.test(contentType)) return "doc";
  if (/openxmlformats/.test(contentType)) return "docx";
  return "bin";
}

// ── 3. Download loop: 2 attempts per file, skip on failure ─────────────
let ok = 0;
const failures = [];
for (let i = 0; i < driveEntries.length; i++) {
  const e = driveEntries[i];
  const id = e.url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!id) { failures.push({ url: e.url, reason: "unparseable id" }); continue; }
  const { subject, program } = subjectById.get(id) ?? { subject: `drive-${id.slice(0, 8)}`, program: "Syllabus" };

  let buf = null;
  let lastError = "";
  for (let attempt = 0; attempt < 2 && !buf; attempt++) {
    const r = await attemptDownload(id);
    if (r.error) { lastError = r.error; await sleep(5000); continue; }
    if (r.buf && r.buf.length >= 1000) { buf = r.buf; break; }
    lastError = `too small (${r.buf?.length ?? 0}b)`;
  }

  if (!buf) {
    failures.push({ url: e.url, subject, reason: lastError });
    console.log(`[fail] ${program} / ${subject} — ${lastError}`);
    continue;
  }
  const ext = extFor(buf);
  // Collision-proof: real subject when known, else the drive id; dedupe by id
  const subj = subject && subject !== "unnamed" ? subject : `file-${id.slice(0, 10)}`;
  const name = `syllabus-${program.replace(/[^\w]+/g, "")}-${subj.replace(/[^\w\u0900-\u097F]+/g, "-").slice(0, 50)}-${id.slice(0, 6)}`;
  const file = `pdfs/${name}.${ext}`;
  await writeFile(path.join(OUT, file), buf);
  e.kind = "pdf";
  e.file = file;
  e.bytes = buf.length;
  e.title = `[Syllabus ${program}] ${subject}`;
  ok++;
  console.log(`[${ok}/${driveEntries.length}] ${program} / ${subject} — ${(buf.length / 1024).toFixed(0)} KB${ext === "pdf" ? "" : ` (NOT pdf: .${ext})`}`);
  await sleep(1500);
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2), "utf-8");

console.log(`\n── Drive harvest report ──`);
console.log(`downloaded: ${ok}/${driveEntries.length}`);
console.log(`failures: ${failures.length}`);
for (const f of failures) console.log(`  ✗ ${f.subject ?? ""} ${f.url} — ${f.reason}`);
console.log(`manifest: ${manifest.length} entries, ${manifest.filter((m) => m.kind === "drive").length} drive links remain undownloaded`);
process.exit(0);
