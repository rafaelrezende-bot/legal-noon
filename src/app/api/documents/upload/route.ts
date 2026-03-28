import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractTextFromPDF } from "@/lib/pdf-extract";
import { processDocumentForRAG } from "@/lib/document-processor";
import { requireRole } from "@/lib/permissions";
import { logAudit, getAuditUser } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const denied = await requireRole('admin', 'editor')();
  if (denied) return denied;
  try {
    const supabase = createAdminClient();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const categoryId = formData.get("category_id") as string;

    if (!file || !name) {
      return NextResponse.json({ error: "Campos obrigatórios faltando." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo deve ter no máximo 10MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uuid = crypto.randomUUID();
    const storagePath = `${uuid}/${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("policy-documents")
      .upload(storagePath, buffer, { contentType: "application/pdf" });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { text: content, pages } = await extractTextFromPDF(buffer);

    const { data: doc, error: insertError } = await supabase
      .from("policy_documents")
      .insert({
        name,
        filename: file.name,
        category_id: categoryId || null,
        content,
        pages,
        storage_path: storagePath,
        rag_status: "processing",
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Process for RAG (chunking + embeddings) in background
    try {
      await processDocumentForRAG(doc.id, content, supabase);
      await supabase.from("policy_documents").update({ rag_status: "ready" }).eq("id", doc.id);
    } catch (ragError: any) {
      console.error("RAG processing error:", ragError.message);
      await supabase.from("policy_documents").update({ rag_status: "error" }).eq("id", doc.id);
    }

    const authSupabase = await createClient();
    const auditUser = await getAuditUser(authSupabase);
    if (auditUser) {
      logAudit({ supabase: createAdminClient(), ...auditUser, action: "created", entityType: "document", entityId: doc.id, entityName: name });
    }

    return NextResponse.json({ document: doc });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Erro no upload." }, { status: 500 });
  }
}
