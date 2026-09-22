export function validateFile(name: string, type: string, data: Buffer) {
  if (!data.length || data.length > 5 * 1024 * 1024)
    throw new Error("Upload a file between 1 byte and 5 MB.");
  if (type === "application/pdf") {
    if (
      !name.toLowerCase().endsWith(".pdf") ||
      data.subarray(0, 5).toString() !== "%PDF-"
    )
      throw new Error("This is not a valid PDF file.");
  } else {
    if (!/\.(txt|md)$/i.test(name))
      throw new Error("Use a PDF, TXT, or Markdown file.");
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
      if (/[\x00-\x08\x0e-\x1f]/.test(text)) throw new Error();
    } catch {
      throw new Error(
        "Text files must contain valid UTF-8 text, not binary data.",
      );
    }
  }
}
export function chunkPages(pages: { page: number; text: string }[]) {
  const chunks: { page: number; text: string }[] = [];
  for (const page of pages) {
    const text = page.text.replace(/\s+/g, " ").trim();
    for (let start = 0; start < text.length; start += 1000) {
      const content = text.slice(start, start + 1200).trim();
      if (content.length >= 20) chunks.push({ page: page.page, text: content });
    }
  }
  if (!chunks.length)
    throw new Error(
      "No readable text found. Scanned PDFs need OCR; upload a text-based PDF or TXT file.",
    );
  if (chunks.length > 500)
    throw new Error("Document is too long. Split it into smaller files.");
  return chunks;
}
