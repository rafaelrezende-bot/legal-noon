import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { extracted_obligation_id, due_date, category_id } = await request.json();

    if (!extracted_obligation_id || !due_date) {
      return NextResponse.json({ error: "ID e data de entrega são obrigatórios." }, { status: 400 });
    }

    // Get the extracted obligation
    const { data: eo } = await supabase
      .from("extracted_obligations")
      .select("*")
      .eq("id", extracted_obligation_id)
      .single();

    if (!eo) return NextResponse.json({ error: "Obrigação não encontrada." }, { status: 404 });

    // Determine category_id - use provided or try to match suggested
    let finalCategoryId = category_id;
    if (!finalCategoryId && eo.suggested_category) {
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .ilike("name", `%${eo.suggested_category}%`)
        .limit(1)
        .single();
      finalCategoryId = cat?.id;
    }
    if (!finalCategoryId) {
      const { data: interno } = await supabase.from("categories").select("id").eq("slug", "interno").single();
      finalCategoryId = interno?.id;
    }

    // Create obligation
    const { data: obligation, error: obError } = await supabase
      .from("obligations")
      .insert({
        category_id: finalCategoryId,
        title: eo.title,
        description: eo.description,
        legal_basis: eo.legal_basis,
        frequency: eo.frequency || "anual",
        fixed_month: eo.deadline_month,
        fixed_day: eo.deadline_day,
        is_business_day: false,
      })
      .select()
      .single();

    if (obError) return NextResponse.json({ error: obError.message }, { status: 500 });

    // Create obligation instance with the provided due_date
    await supabase.from("obligation_instances").insert({
      obligation_id: obligation.id,
      due_date,
      status: "pendente",
    });

    // Update extracted obligation
    await supabase.from("extracted_obligations").update({
      status: "included",
      included_obligation_id: obligation.id,
      due_date,
      decided_at: new Date().toISOString(),
    }).eq("id", extracted_obligation_id);

    return NextResponse.json({ success: true, obligation_id: obligation.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
