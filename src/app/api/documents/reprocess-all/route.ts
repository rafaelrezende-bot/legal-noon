import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDocumentForRAG } from "@/lib/document-processor";

export async function POST() {
  try {
    const supabase = createAdminClient();

    const { data: docs } = await supabase
      .from("policy_documents")
      .select("id, name, content")
      .or("rag_status.is.null,rag_status.neq.ready")
      .order("name");

    if (!docs || docs.length === 0) {
      return NextResponse.json({ message: "Todos os documentos já foram processados.", processed: 0 });
    }

    let processed = 0;
    const errors: string[] = [];

    for (const doc of docs) {
      if (!doc.content) continue;

      try {
        await supabase.from("policy_documents").update({ rag_status: "processing" }).eq("id", doc.id);
        const result = await processDocumentForRAG(doc.id, doc.content, supabase);
        await supabase.from("policy_documents").update({ rag_status: "ready" }).eq("id", doc.id);
        processed++;
        console.log(`Processed ${doc.name}: ${result.chunksCreated} chunks`);
      } catch (e: any) {
        await supabase.from("policy_documents").update({ rag_status: "error" }).eq("id", doc.id);
        errors.push(`${doc.name}: ${e.message}`);
        console.error(`Error processing ${doc.name}:`, e.message);
      }
    }

    return NextResponse.json({ processed, total: docs.length, errors: errors.length > 0 ? errors : undefined });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
