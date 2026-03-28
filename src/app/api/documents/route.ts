import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("policy_documents")
    .select("id, name, filename, category_id, pages, storage_path, last_reviewed_at, rag_status, extraction_status, created_at, category:categories(id, name, slug, color)")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get pending extracted obligations counts per document
  const { data: counts } = await supabase
    .from("extracted_obligations")
    .select("document_id, status");

  const countMap: Record<string, { pending: number; included: number; discarded: number }> = {};
  for (const row of counts || []) {
    if (!countMap[row.document_id]) countMap[row.document_id] = { pending: 0, included: 0, discarded: 0 };
    if (row.status === 'pending') countMap[row.document_id].pending++;
    else if (row.status === 'included') countMap[row.document_id].included++;
    else if (row.status === 'discarded') countMap[row.document_id].discarded++;
  }

  const enriched = (data || []).map((d: any) => ({
    ...d,
    obligations_pending: countMap[d.id]?.pending || 0,
    obligations_included: countMap[d.id]?.included || 0,
    obligations_discarded: countMap[d.id]?.discarded || 0,
  }));

  return NextResponse.json({ documents: enriched });
}
