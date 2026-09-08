export interface ParsedTable {
  sheet?: string;
  rows: string[][];
}

export interface ParsedDocument {
  text: string;
  pages: number | null;
  pageTexts?: string[];
  tables: ParsedTable[];
  ocrApplied: boolean;
  ocrConfidence?: number | null;
  error?: string;
  /** Scanned/image-only PDF detected — must be routed to needs_ocr, never ingested as text. */
  needsOcr?: boolean;
}

export interface IngestJobData {
  documentId: string;
}
