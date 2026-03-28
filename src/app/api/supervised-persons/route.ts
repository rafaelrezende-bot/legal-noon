import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const showInactive = request.nextUrl.searchParams.get("all") === "true";

  let query = supabase.from("supervised_persons").select("*").order("name");
  if (!showInactive) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ persons: data });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { name, role, email } = await request.json();
    if (!name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });

    const { data, error } = await supabase
      .from("supervised_persons")
      .insert({ name, role: role || null, email: email || null })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ person: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { id, name, role, email, active } = await request.json();
    if (!id) return NextResponse.json({ error: "ID é obrigatório." }, { status: 400 });

    const updates: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (email !== undefined) updates.email = email;
    if (active !== undefined) updates.active = active;

    const { error } = await supabase.from("supervised_persons").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
