/**
 * Document parsing: extract text (+ page boundaries) per format.
 * Strategy table: Architecture doc §3.4 (text-native PDF, DOCX, PPTX, XLSX, images, text).
 *
 * NOTE: image/OCR parsing is deliberately NOT here — tesseract.js is a heavy
 * native dep that must never enter the web bundle. The BullMQ worker keeps its
 * own OCR path (apps/worker/src/parse.ts); this package serves the web route.
 */
import type { ParsedDocument } from "./types";

export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
): Promise<ParsedDocument> {
  switch (true) {
    case mimeType.includes("pdf"):
      return parsePdf(buffer);
    case mimeType.includes("wordprocessingml") || mimeType.includes("msword"):
      return parseDocx(buffer);
    case mimeType.includes("presentationml") || mimeType.includes("mspowerpoint"):
      return parsePptx(buffer);
    case mimeType.includes("spreadsheetml") || mimeType.includes("ms-excel") || mimeType.includes("csv"):
      return parseSpreadsheet(buffer);
    default:
      // text/html, text/plain, text/markdown — and image/ returns a clear
      // stage error rather than silently indexing nothing (OCR is worker-only).
      if (mimeType.startsWith("image/")) {
        return { text: "", pages: null, tables: [], ocrApplied: false, error: "Image OCR is not available on this path — upload a text-native file (PDF/Word/PPT/XLSX/CSV/TXT)" };
      }
      return { text: buffer.toString("utf-8"), pages: null, tables: [], ocrApplied: false };
  }
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  // pdf-parse's index.js runs debug code when NODE_ENV detection misfires in
  // bundles; the lib path is the stable entry. The package ships no type
  // declarations — the local signature types it for every consuming program
  // (web, worker, ingest itself) without an ambient .d.ts that only the
  // including tsconfig would see.
  type PdfParseResult = { text: string };
  // @ts-expect-error pdf-parse/lib/pdf-parse.js is untyped
  const { default: pdfParse } = (await import("pdf-parse/lib/pdf-parse.js")) as {
    default: (buffer: Buffer) => Promise<PdfParseResult>;
  };
  const result = await pdfParse(buffer);
  // pdf-parse gives total text; approximate page boundaries by form feeds if present
  const pageTexts = result.text.split("\f").filter((p) => p.trim().length > 0);
  return {
    text: result.text.replace(/\f/g, "\n"),
    pages: pageTexts.length || null,
    pageTexts,
    tables: [],
    ocrApplied: false,
  };
}

async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const mammoth = await import("mammoth");
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const text = htmlToText(html);
  return { text, pages: null, tables: [], ocrApplied: false };
}

async function parsePptx(buffer: Buffer): Promise<ParsedDocument> {
  // Slides are chunk boundaries — extract per-slide text via unzip of slide XMLs.
  const JSZip = (await import("jszip").catch(() => null)) as typeof import("jszip") | null;
  if (!JSZip) return { text: "", pages: null, tables: [], ocrApplied: false, error: "jszip unavailable" };
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNo(a) - slideNo(b));
  const pageTexts: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name]!.async("string");
    const text = (xml.match(/<a:t>([^<]*)<\/a:t>/g) ?? [])
      .map((t) => t.replace(/<\/?a:t>/g, ""))
      .join("\n");
    if (text.trim()) pageTexts.push(text);
  }
  return { text: pageTexts.join("\n\n"), pages: pageTexts.length, pageTexts, tables: [], ocrApplied: false };
}

function slideNo(name: string): number {
  const m = name.match(/slide(\d+)\.xml/);
  return m ? Number(m[1]) : 0;
}

async function parseSpreadsheet(buffer: Buffer): Promise<ParsedDocument> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const tables: { sheet: string; rows: string[][] }[] = [];
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName]!, { header: 1 });
    tables.push({ sheet: sheetName, rows });
    parts.push(`## ${sheetName}\n` + rows.map((r) => r.join(" | ")).join("\n"));
  }
  return { text: parts.join("\n\n"), pages: null, tables, ocrApplied: false };
}

function htmlToText(html: string): string {
  return html
    .replace(/<h[1-6][^>]*>/g, "\n\n## ")
    .replace(/<\/h[1-6]>/g, "\n")
    .replace(/<li[^>]*>/g, "\n- ")
    .replace(/<\/p>/g, "\n\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
