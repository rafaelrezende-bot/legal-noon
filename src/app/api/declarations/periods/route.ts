import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PESSOAS = ["Patrick Ledoux", "Carlos Aguiar", "Nelson Bechara", "Tereza Cidade", "Ricardo Kanitz", "Eduardo Alcalay"];

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("declaration_periods")
    .select("*, declarations:personal_declarations(id, participant_name, status, submitted_at, notes)")
    .order("due_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ periods: data });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    const { data: period, error } = await supabase
      .from("declaration_periods")
      .insert({
        type: body.type,
        reference_label: body.reference_label,
        due_date: body.due_date,
        year: body.year,
        quarter: body.quarter || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Create pending declarations for all participants
    const declarations = PESSOAS.map((name) => ({
      period_id: period.id,
      participant_name: name,
      status: "pendente",
    }));

    await supabase.from("personal_declarations").insert(declarations);

    return NextResponse.json({ period });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
