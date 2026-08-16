/** Untyped deps (pdf-parse ships no types). */
declare module "pdf-parse" {
  interface PdfResult {
    text: string;
    numpages: number;
    info: unknown;
  }
  function pdfParse(buffer: Buffer): Promise<PdfResult>;
  export default pdfParse;
}
