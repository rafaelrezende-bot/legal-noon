import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { obligations } = await request.json();

    if (!obligations || !Array.isArray(obligations) || obligations.length === 0) {
      return NextResponse.json({ error: "Nenhuma obrigação fornecida." }, { status: 400 });
    }

    const categoryMap: Record<string, string> = {};
    const { data: cats } = await supabase.from("categories").select("id, slug");
    for (const c of cats || []) {
      categoryMap[c.slug] = c.id;
    }

    // Map category names to slugs
    const nameToSlug: Record<string, string> = {
      CVM: "cvm",
      ANBIMA: "anbima",
      PLDFT: "pldft",
      Interno: "interno",
      "PLDFT / COAF": "pldft",
    };

    const year = new Date().getFullYear();
    let created = 0;

    for (const ob of obligations) {
      const slug = nameToSlug[ob.category] || "interno";
      const catId = categoryMap[slug];
      if (!catId) continue;

      // Insert obligation
      const { data: newOb, error } = await supabase
        .from("obligations")
        .insert({
          category_id: catId,
          title: ob.title,
          description: ob.description || null,
          legal_basis: ob.legal_basis || null,
          frequency: ob.frequency || "anual",
          fixed_month: ob.deadline_month || null,
          fixed_day: ob.deadline_day || null,
          is_business_day: false,
        })
        .select()
        .single();

      if (error || !newOb) continue;

      // Generate instances for current year
      const instances: { obligation_id: string; due_date: string; status: string }[] = [];

      switch (ob.frequency) {
        case "anual":
          instances.push({
            obligation_id: newOb.id,
            due_date: `${year}-${String(ob.deadline_month || 12).padStart(2, "0")}-${String(ob.deadline_day || 31).padStart(2, "0")}`,
            status: "pendente",
          });
          break;
        case "semestral":
          instances.push(
            { obligation_id: newOb.id, due_date: `${year}-06-30`, status: "pendente" },
            { obligation_id: newOb.id, due_date: `${year}-12-31`, status: "pendente" }
          );
          break;
        case "trimestral":
          for (const d of ["03-31", "06-30", "09-30", "12-31"]) {
            instances.push({ obligation_id: newOb.id, due_date: `${year}-${d}`, status: "pendente" });
          }
          break;
        case "mensal":
          for (let m = 1; m <= 12; m++) {
            const day = ob.deadline_day || 28;
            instances.push({ obligation_id: newOb.id, due_date: `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`, status: "pendente" });
          }
          break;
      }

      if (instances.length > 0) {
        await supabase.from("obligation_instances").insert(instances);
      }

      created++;
    }

    return NextResponse.json({ success: true, created });
  } catch (error: any) {
    console.error("Batch create error:", error?.message || error);
    return NextResponse.json({ error: error.message || "Erro ao criar obrigações." }, { status: 500 });
  }
}
