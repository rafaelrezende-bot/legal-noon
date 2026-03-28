import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const denied = await requireRole('admin', 'editor')();
  if (denied) return denied;
  try {
    const supabase = createAdminClient();
    const { extracted_obligation_id } = await request.json();
    if (!extracted_obligation_id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const { error } = await supabase.from("extracted_obligations").update({
      status: "pending",
      decided_at: null,
      decided_by: null,
    }).eq("id", extracted_obligation_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
