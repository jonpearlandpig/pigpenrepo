// Document parser: extracts plain text from PDF, DOCX, and TXT files.
// Runs server-side only — pdf-parse and mammoth are Node.js libraries.

export type SupportedFileType = "pdf" | "docx" | "txt";

export function detectFileType(fileName: string, mimeType?: string): SupportedFileType {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf" || mimeType === "application/pdf") return "pdf";
  if (
    ext === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "docx";
  return "txt";
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  fileType: SupportedFileType
): Promise<string> {
  switch (fileType) {
    case "pdf":
      return extractFromPDF(buffer);
    case "docx":
      return extractFromDOCX(buffer);
    case "txt":
      return buffer.toString("utf-8");
  }
}

async function extractFromPDF(buffer: Buffer): Promise<string> {
  // Dynamic import keeps this out of the client bundle
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return normalizeWhitespace(data.text);
}

async function extractFromDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return normalizeWhitespace(result.value);
}

// Collapses excessive blank lines and trims
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// Validates the extracted text has meaningful content
export function validateExtraction(text: string): { valid: boolean; reason?: string } {
  if (!text || text.length < 100) {
    return { valid: false, reason: "Document appears to be empty or too short to process." };
  }
  if (text.length > 500_000) {
    return { valid: false, reason: "Document exceeds 500,000 character limit. Please split into sections." };
  }
  return { valid: true };
}
