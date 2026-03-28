interface Chunk {
  content: string;
  index: number;
  tokenCount: number;
}

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 400;

export function splitIntoChunks(text: string): Chunk[] {
  const cleanText = text.replace(/\n{3,}/g, "\n\n").trim();

  if (cleanText.length <= CHUNK_SIZE) {
    return [
      {
        content: cleanText,
        index: 0,
        tokenCount: Math.ceil(cleanText.length / 4),
      },
    ];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < cleanText.length) {
    let end = start + CHUNK_SIZE;

    if (end >= cleanText.length) {
      end = cleanText.length;
    } else {
      const paragraphBreak = cleanText.lastIndexOf("\n\n", end);
      if (paragraphBreak > start + CHUNK_SIZE * 0.5) {
        end = paragraphBreak;
      } else {
        const sentenceBreak = cleanText.lastIndexOf(". ", end);
        if (sentenceBreak > start + CHUNK_SIZE * 0.5) {
          end = sentenceBreak + 1;
        }
      }
    }

    const chunkContent = cleanText.slice(start, end).trim();

    if (chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        index: chunkIndex,
        tokenCount: Math.ceil(chunkContent.length / 4),
      });
      chunkIndex++;
    }

    const nextStart = end - CHUNK_OVERLAP;
    start = nextStart <= start ? end : nextStart;
  }

  return chunks;
}
