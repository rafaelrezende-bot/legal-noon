import { splitIntoChunks } from "./chunking";
import { generateEmbeddings } from "./embeddings";

export async function processDocumentForRAG(
  documentId: string,
  extractedText: string,
  supabaseClient: any
): Promise<{ chunksCreated: number }> {
  // Delete old chunks
  await supabaseClient
    .from("document_chunks")
    .delete()
    .eq("document_id", documentId);

  // Split into chunks
  const chunks = splitIntoChunks(extractedText);
  if (chunks.length === 0) return { chunksCreated: 0 };

  // Generate embeddings
  const texts = chunks.map((c) => c.content);
  const embeddings = await generateEmbeddings(texts);

  // Save chunks + embeddings in batches
  const rows = chunks.map((chunk, i) => ({
    document_id: documentId,
    chunk_index: chunk.index,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[i]),
    token_count: chunk.tokenCount,
    metadata: {},
  }));

  const BATCH_SIZE = 50;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabaseClient
      .from("document_chunks")
      .insert(batch);
    if (error) throw new Error(`Erro ao salvar chunks: ${error.message}`);
  }

  return { chunksCreated: chunks.length };
}
