import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

// Disable worker for server-side usage
GlobalWorkerOptions.workerSrc = "";

export async function extractTextFromPDF(
  buffer: Buffer
): Promise<{ text: string; pages: number }> {
  const data = new Uint8Array(buffer);
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const numPages = doc.numPages;
  const textParts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");
    textParts.push(pageText);
  }

  return { text: textParts.join("\n\n"), pages: numPages };
}
