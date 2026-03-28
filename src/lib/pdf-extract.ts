export async function extractTextFromPDF(
  buffer: Buffer
): Promise<{ text: string; pages: number }> {
  // Use dynamic import to avoid worker issues in serverless
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Point workerSrc to the actual worker file to avoid fake worker error
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

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
