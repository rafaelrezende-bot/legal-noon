import { generateQueryEmbedding } from "./embeddings";

interface SearchResult {
  content: string;
  documentName: string;
  similarity: number;
}

export async function searchRelevantChunks(
  query: string,
  supabaseClient: any,
  options: { matchThreshold?: number; matchCount?: number } = {}
): Promise<SearchResult[]> {
  const { matchThreshold = 0.65, matchCount = 8 } = options;

  const queryEmbedding = await generateQueryEmbedding(query);

  const { data, error } = await supabaseClient.rpc("match_document_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    console.error("RAG search error:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    content: row.content,
    documentName: row.document_name,
    similarity: row.similarity,
  }));
}
