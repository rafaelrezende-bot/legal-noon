import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const denied = await requireRole('admin', 'editor')();
  if (denied) return denied;
  try {
    const supabase = createAdminClient();
    const { documentId } = await request.json();

    if (!documentId) return NextResponse.json({ error: "documentId é obrigatório." }, { status: 400 });

    // Delete only pending extracted obligations (keep included/discarded)
    await supabase
      .from("extracted_obligations")
      .delete()
      .eq("document_id", documentId)
      .eq("status", "pending");

    // Reset extraction status
    await supabase
      .from("policy_documents")
      .update({ extraction_status: "pending" })
      .eq("id", documentId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
