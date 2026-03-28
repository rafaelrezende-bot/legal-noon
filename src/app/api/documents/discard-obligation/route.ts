import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { extracted_obligation_id } = await request.json();

    if (!extracted_obligation_id) {
      return NextResponse.json({ error: "ID é obrigatório." }, { status: 400 });
    }

    const { error } = await supabase.from("extracted_obligations").update({
      status: "discarded",
      decided_at: new Date().toISOString(),
    }).eq("id", extracted_obligation_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
