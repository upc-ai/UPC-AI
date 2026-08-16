/**
 * Type-aware chunking (Architecture §3.7):
 * - Split on heading boundaries first (## lines from our parsers).
 * - Pack sections into 400–600-token chunks with ~15% overlap.
 * - Never split a table mid-row (tables are atomic chunks).
 * - Each chunk keeps a hierarchy path ("Doc > Section > Sub") and page number.
 */

const AVG_CHARS_PER_TOKEN = 4;
const TARGET_TOKENS = 500;
const MAX_TOKENS = 650;
const OVERLAP_TOKENS = 75;

export interface RawChunk {
  content: string;
  chunkType: "prose" | "table" | "heading_section";
  hierarchyPath: string;
  pageNumber: number | null;
  tableJson?: unknown;
}

export function chunkDocument(
  text: string,
  opts: { pageTexts?: string[]; tables?: { sheet?: string; rows: string[][] }[]; docTitle: string },
): RawChunk[] {
  const chunks: RawChunk[] = [];

  // Tables first — atomic
  for (const table of opts.tables ?? []) {
    const content = `## ${table.sheet ?? "Table"} (extracted)\n` + table.rows.map((r) => r.join(" | ")).join("\n");
    chunks.push({
      content,
      chunkType: "table",
      hierarchyPath: `${opts.docTitle} > ${table.sheet ?? "Table"}`,
      pageNumber: null,
      tableJson: { rows: table.rows.slice(0, 100) },
    });
  }

  // Prose split by headings
  const sections = splitByHeadings(text);
  for (const section of sections) {
    const path = `${opts.docTitle}${section.path ? " > " + section.path : ""}`;
    const pageNumber = pageOf(section.text, opts.pageTexts);
    const pieces = pack(section.text);
    for (const piece of pieces) {
      if (!piece.trim()) continue;
      chunks.push({
        content: piece.trim(),
        chunkType: section.path ? "heading_section" : "prose",
        hierarchyPath: path,
        pageNumber,
      });
    }
  }

  return chunks.map((c, i) => ({ ...c, content: `[${c.hierarchyPath}]\n${c.content}` }));
}

function splitByHeadings(text: string): { path: string; text: string }[] {
  const lines = text.split("\n");
  const sections: { path: string; text: string }[] = [];
  let currentPath = "";
  let buffer: string[] = [];
  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.*)$/);
    if (heading) {
      if (buffer.join("\n").trim()) sections.push({ path: currentPath, text: buffer.join("\n") });
      currentPath = currentPath && heading[0].startsWith("# ") ? heading[1]! : heading[1]!;
      buffer = [line];
    } else {
      buffer.push(line);
    }
  }
  if (buffer.join("\n").trim()) sections.push({ path: currentPath, text: buffer.join("\n") });
  return sections.length ? sections : [{ path: "", text }];
}

/** Pack a section into target-sized chunks with overlap. */
function pack(text: string): string[] {
  const targetChars = TARGET_TOKENS * AVG_CHARS_PER_TOKEN;
  const maxChars = MAX_TOKENS * AVG_CHARS_PER_TOKEN;
  const overlapChars = OVERLAP_TOKENS * AVG_CHARS_PER_TOKEN;

  if (text.length <= maxChars) return [text];

  const out: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + targetChars, text.length);
    if (end < text.length) {
      // prefer breaking at a paragraph/sentence boundary
      const window = text.slice(start, end);
      const breakAt = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "));
      if (breakAt > targetChars * 0.5) end = start + breakAt + 1;
    }
    out.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - overlapChars;
  }
  return out;
}

/** Approximate page number for a text fragment using page text signatures. */
function pageOf(fragment: string, pageTexts?: string[]): number | null {
  if (!pageTexts || pageTexts.length === 0) return null;
  const probe = fragment.replace(/\[.*\]\n/, "").slice(40, 120).trim();
  if (!probe) return null;
  for (let i = 0; i < pageTexts.length; i++) {
    if (pageTexts[i]!.includes(probe.slice(0, 40))) return i + 1;
  }
  return null;
}

/** Approximate token count. */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN);
}
