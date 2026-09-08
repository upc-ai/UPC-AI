/**
 * Curation sheet generator (RAG organization, user checkpoint).
 * Reads the harvest (to-import/crawl/) + probes every PDF (text-layer vs
 * scanned, language, content title) and writes to-import/curation.csv —
 * one row per item with a proposed category and include/exclude decision.
 *
 * The user reviews/edits the CSV in Excel (include=Y/N, category fixes),
 * then `pnpm import:curated` consumes it. Idempotent: PDF probes are cached.
 *
 * Usage: pnpm curate:harvest
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../../../to-import/crawl");

type PdfProbe = { pages: number; chars: number; firstLine: string; lang: "hi" | "en"; scanned: boolean };

function devanagariRatio(s: string): number {
  const letters = s.match(/\p{L}/gu)?.length ?? 0;
  if (!letters) return 0;
  const dev = s.match(/[\u0900-\u097F]/gu)?.length ?? 0;
  return dev / letters;
}

function langOf(s: string): "hi" | "en" {
  return devanagariRatio(s.slice(0, 3000)) > 0.3 ? "hi" : "en";
}

/** Page → {category, include, note} per the agreed "core student-facing" scope. */
function decidePage(url: string): { category: string; include: boolean; note: string } {
  const u = url.toLowerCase();
  const path = new URL(url).pathname.toLowerCase();
  const aboutTail = path.replace(/^\/about\/?/, "");

  // Hard excludes: galleries, teacher pages, admin/junk, NAAC/IQAC bureaucracy
  if (/^\/teacher\//.test(path)) return { category: "", include: false, note: "teacher profile page — thin content" };
  if (path.startsWith("/gatspjs7j")) return { category: "", include: false, note: "admin login page" };
  if (path === "/student/psldikcndhwt5eskk72") return { category: "", include: false, note: "junk/scaffold page" };
  if (/^\/about\/(viewgallery|photogallery|videogallery)/.test(path)) return { category: "", include: false, note: "photo/video gallery — no text value" };
  if (
    /^\/about\/(iqac|naacreport|naacdvv|naaccriteria|nirf|uppraman|bestpractice|codeconduct|codeconductcommittee|cell|nationalschemeprogram|nationalscheme|researchcommittee|report|mentormentree|feedbackform|feebackteacher|studentfeedback)/.test(path)
  ) {
    return { category: "", include: false, note: "accreditation/administrative — excluded from student-facing core" };
  }
  // Homepage duplicates
  if (path === "/home" || path === "/home/") return { category: "about-college", include: false, note: "duplicate of homepage (/)" };

  if (path === "/" || path === "") return { category: "about-college", include: true, note: "homepage" };
  if (/^\/faculty\/department\//.test(path)) return { category: "faculty-info", include: true, note: "department page" };
  if (/^\/about\/examination/.test(path)) return { category: "exams", include: true, note: "examination page" };
  if (/^\/about\/notice/.test(path)) return { category: "notices", include: true, note: "notice board page" };
  if (/^\/about\/academiccalender/.test(path)) return { category: "study-material", include: true, note: "academic calendar" };
  if (/^\/about\/vocationalcourse/.test(path)) return { category: "courses", include: true, note: "vocational courses" };
  if (/^\/about\/course/.test(path)) return { category: "courses", include: true, note: "course listing" };
  if (/^\/course\/(oldpaper|modelpaper)/.test(path)) return { category: "study-material", include: true, note: "old/model papers" };
  if (/^\/course\/(syllabus|list|minorsyllabus|syllabusdiploma|syllabusvocational)/.test(path)) return { category: "syllabus", include: true, note: "syllabus listing" };
  if (/^\/course\//.test(path)) return { category: "courses", include: true, note: "course page" };
  if (/^\/entrance\//.test(path)) return { category: "admissions", include: true, note: "entrance/admission page" };
  if (/^\/facility/.test(path)) return { category: "facilities", include: true, note: "facility page" };
  if (path === "/student/examination") return { category: "exams", include: true, note: "student examination" };
  if (path === "/student/applicationform") return { category: "forms", include: true, note: "application forms" };
  if (path === "/student/econtent") return { category: "study-material", include: true, note: "e-content" };
  if (/^\/student\//.test(path)) return { category: "study-material", include: true, note: "student corner page" };
  if (path === "/about/contact" || path === "/alumni" || path === "/student/studentunion") return { category: "about-college", include: true, note: "college info page" };
  if (aboutTail && !aboutTail.startsWith("/")) {
    // remaining /about/* pages: history, founder, vision, administration, messages, upes, mou, seminar, magazine…
    return { category: "about-college", include: true, note: "about-the-college page" };
  }
  return { category: "about-college", include: true, note: "general page" };
}

/** PDF → {category, include} by URL family. */
function decidePdf(url: string, filename: string): { category: string; include: boolean; note: string } {
  const u = url.toLowerCase();
  if (/^syllabus-/.test(filename)) return { category: "syllabus", include: true, note: "syllabus PDF" };
  if (u.includes("/appimage/notice/")) return { category: "notices", include: true, note: "notice PDF" };
  if (u.includes("/document/pdf/ent/")) return { category: "admissions", include: true, note: "entrance/admission document" };
  if (u.includes("/document/pdf/form/")) return { category: "forms", include: true, note: "form/certificate" };
  if (u.includes("/document/pdf/syllabus/")) return { category: "syllabus", include: true, note: "syllabus PDF" };
  if (u.includes("/upload/syllabus/")) return { category: "syllabus", include: true, note: "syllabus PDF" };
  if (u.includes("calendar")) return { category: "study-material", include: true, note: "academic calendar PDF" };
  if (u.includes("/document/pdf/")) return { category: "about-college", include: true, note: "official college document" };
  return { category: "notices", include: true, note: "linked college PDF" };
}

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const manifest: { file: string; url: string; title: string; kind: string; bytes: number }[] = JSON.parse(
    readFileSync(path.join(OUT, "manifest.json"), "utf-8"),
  );

  // PDF probe cache (pdf-parse is slow on 240MB — one-time cost)
  const cachePath = path.join(OUT, "pdf-probe.json");
  const cache: Record<string, PdfProbe> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf-8")) : {};

  const rows: { include: string; file: string; kind: string; url: string; title: string; category: string; language: string; text_status: string; notes: string }[] = [];

  for (const m of manifest) {
    if (m.kind === "html") {
      const d = decidePage(m.url);
      let lang = "en";
      let textStatus = "ok";
      try {
        const txt = readFileSync(path.join(OUT, m.file.replace(/\.html$/, ".txt")), "utf-8");
        lang = langOf(txt);
        textStatus = txt.trim().length < 200 ? "thin" : "ok";
      } catch {
        textStatus = "missing";
      }
      rows.push({
        include: d.include ? "Y" : "N",
        file: m.file,
        kind: "page",
        url: m.url,
        title: m.title,
        category: d.category,
        language: lang,
        text_status: textStatus,
        notes: d.note,
      });
      continue;
    }

    // PDF
    const d = decidePdf(m.url, path.basename(m.file));
    const abs = path.join(OUT, m.file);
    let probe: PdfProbe | undefined = cache[m.file];
    if (!probe && existsSync(abs)) {
      try {
        // @ts-expect-error pdf-parse/lib/pdf-parse.js is untyped
        const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
        const result = await pdfParse(readFileSync(abs));
        const pageTexts = result.text.split("\f").filter((p: string) => p.trim().length > 0);
        const text = result.text as string;
        const firstLine =
          text
            .split("\n")
            .map((l: string) => l.trim())
            .find((l: string) => l.length > 3)
            ?.slice(0, 120) ?? "";
        probe = {
          pages: pageTexts.length,
          chars: text.trim().length,
          firstLine,
          lang: langOf(text),
          scanned: !text.trim() || (pageTexts.length > 0 && text.trim().length / pageTexts.length < 120),
        };
        cache[m.file] = probe;
        writeFileSync(cachePath, JSON.stringify(cache, null, 1));
      } catch (err) {
        probe = { pages: 0, chars: 0, firstLine: "", lang: "hi", scanned: true };
        cache[m.file] = probe;
        console.log(`[probe-fail] ${m.file}: ${err instanceof Error ? err.message : err}`);
      }
    }
    const textStatus = probe ? (probe.scanned ? "scanned" : probe.chars < 200 ? "thin" : "text-layer") : "missing";
    const betterTitle = probe?.firstLine && /^[0-9_-]+$/.test(m.title.replace(/\.pdf$/i, "")) ? probe.firstLine : m.title;
    const notes = [d.note, probe?.scanned ? "SCANNED — needs OCR (auto-excluded from import)" : "", textStatus === "thin" ? "thin text layer" : ""]
      .filter(Boolean)
      .join("; ");
    rows.push({
      include: d.include && textStatus !== "scanned" ? "Y" : "N",
      file: m.file,
      kind: "pdf",
      url: m.url,
      title: betterTitle.slice(0, 120),
      category: d.category,
      language: probe?.lang ?? "en",
      text_status: textStatus,
      notes,
    });
  }

  const header = "include,file,kind,url,title,category,language,text_status,notes";
  const csv = "\uFEFF" + [header, ...rows.map((r) => [r.include, r.file, r.kind, r.url, r.title, r.category, r.language, r.text_status, r.notes].map(csvEscape).join(","))].join("\n");
  writeFileSync(path.join(path.dirname(OUT), "curation.csv"), csv, "utf-8");

  // Summary
  const inc = rows.filter((r) => r.include === "Y");
  const byCat: Record<string, number> = {};
  for (const r of inc) byCat[r.category] = (byCat[r.category] ?? 0) + 1;
  const scanned = rows.filter((r) => r.text_status === "scanned");
  console.log(`\n───── curation summary ─────`);
  console.log(`total items:    ${rows.length}`);
  console.log(`include=Y:      ${inc.length}`);
  console.log(`exclude=N:      ${rows.length - inc.length} (galleries, teacher pages, NAAC/IQAC admin, homepage dupes, scanned PDFs)`);
  console.log(`scanned PDFs:   ${scanned.length} (flagged needs_ocr, auto-excluded)`);
  console.log(`by category:    ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`\nwrote: ${path.join(path.dirname(OUT), "curation.csv")}`);
  console.log(`review it in Excel (include column + category column), then run: pnpm import:curated`);
  process.exit(0);
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
