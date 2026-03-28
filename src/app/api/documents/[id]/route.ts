import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // Get storage path before deleting
    const { data: doc } = await supabase
      .from("policy_documents")
      .select("storage_path")
      .eq("id", id)
      .single();

    // Delete from database
    const { error } = await supabase
      .from("policy_documents")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Delete from storage if exists
    if (doc?.storage_path) {
      await supabase.storage.from("policy-documents").remove([doc.storage_path]);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
