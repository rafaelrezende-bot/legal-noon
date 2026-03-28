import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/permissions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireRole('admin', 'editor')();
  if (denied) return denied;
  try {
    const { id } = await params;
    const supabase = createAdminClient();
    const { notes, document_updated } = await request.json();

    // Update document
    const { error: updateError } = await supabase
      .from("policy_documents")
      .update({
        last_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Insert review record
    const { error: reviewError } = await supabase
      .from("policy_reviews")
      .insert({
        document_id: id,
        notes: notes || null,
        document_updated: document_updated || false,
      });

    if (reviewError) {
      return NextResponse.json({ error: reviewError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro." }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("policy_reviews")
      .select("*")
      .eq("document_id", id)
      .order("reviewed_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reviews: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
