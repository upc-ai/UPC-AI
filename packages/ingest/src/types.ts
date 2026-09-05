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
}

export interface IngestJobData {
  documentId: string;
}
