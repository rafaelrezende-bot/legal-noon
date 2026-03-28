import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/permissions";
import { getNextAvailableColor } from "@/lib/category-colors";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("categories").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data });
}

export async function POST(request: NextRequest) {
  const denied = await requireRole('admin')();
  if (denied) return denied;
  try {
    const supabase = createAdminClient();
    const { name, color: providedColor } = await request.json();
    if (!name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Auto-assign color if not provided
    let finalColor = providedColor;
    if (!finalColor) {
      const { data: existing } = await supabase.from("categories").select("color");
      const usedColors = (existing || []).map((c: any) => c.color).filter(Boolean);
      finalColor = getNextAvailableColor(usedColors);
    }

    const { data, error } = await supabase.from("categories").insert({ name, slug, color: finalColor }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ category: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireRole('admin')();
  if (denied) return denied;
  try {
    const supabase = createAdminClient();
    const { id, name } = await request.json();
    if (!id || !name) return NextResponse.json({ error: "ID e nome são obrigatórios." }, { status: 400 });
    const { error } = await supabase.from("categories").update({ name }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
