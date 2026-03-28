import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const STATUS_PRIORITY: Record<string, number> = {
  pending: 1,
  atrasada: 2,
  em_andamento: 3,
  pendente: 4,
  concluida: 5,
  discarded: 6,
};

export async function GET(request: NextRequest) {
  const documentId = request.nextUrl.searchParams.get("documentId");
  if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });

  const supabase = createAdminClient();

  // 1. Extracted obligations (pending + discarded)
  const { data: extracted } = await supabase
    .from("extracted_obligations")
    .select("*")
    .eq("document_id", documentId)
    .in("status", ["pending", "discarded"])
    .order("created_at");

  // 2. Included obligations (with their calendar status)
  const { data: included } = await supabase
    .from("extracted_obligations")
    .select("*, obligation:included_obligation_id(id, title, category_id, frequency, category:categories(id, name, slug, color))")
    .eq("document_id", documentId)
    .eq("status", "included");

  // Get instances for included obligations
  const includedObIds = (included || [])
    .map((eo: any) => eo.obligation?.id)
    .filter(Boolean);

  let instanceMap: Record<string, any> = {};
  if (includedObIds.length > 0) {
    const { data: instances } = await supabase
      .from("obligation_instances")
      .select("obligation_id, due_date, status")
      .in("obligation_id", includedObIds)
      .order("due_date");

    // Get the most relevant instance per obligation (nearest future or most recent past)
    for (const inst of instances || []) {
      const existing = instanceMap[inst.obligation_id];
      if (!existing || inst.due_date > (existing.due_date || "")) {
        instanceMap[inst.obligation_id] = inst;
      }
    }
  }

  // Build unified list
  const obligations: any[] = [];

  // Pending/discarded from extracted
  for (const eo of extracted || []) {
    obligations.push({
      id: eo.id,
      source: "extracted",
      title: eo.title,
      description: eo.description,
      suggested_category: eo.suggested_category,
      frequency: eo.frequency,
      legal_basis: eo.legal_basis,
      due_date: null,
      display_status: eo.status === "pending" ? "pending" : "discarded",
      category: null,
    });
  }

  // Included with calendar status
  for (const eo of included || []) {
    const ob = eo.obligation;
    if (!ob) continue;
    const instance = instanceMap[ob.id];
    const today = new Date().toISOString().split("T")[0];
    let displayStatus = instance?.status || "pendente";
    if (displayStatus !== "concluida" && instance?.due_date && instance.due_date < today) {
      displayStatus = "atrasada";
    }

    obligations.push({
      id: eo.id,
      source: "included",
      title: ob.title || eo.title,
      description: eo.description,
      suggested_category: eo.suggested_category,
      frequency: ob.frequency || eo.frequency,
      legal_basis: eo.legal_basis,
      due_date: eo.due_date || instance?.due_date || null,
      display_status: displayStatus,
      category: ob.category || null,
      obligation_id: ob.id,
      instance_id: instance?.id || null,
    });
  }

  // Sort by status priority, then by due_date
  obligations.sort((a, b) => {
    const pa = STATUS_PRIORITY[a.display_status] || 99;
    const pb = STATUS_PRIORITY[b.display_status] || 99;
    if (pa !== pb) return pa - pb;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  return NextResponse.json({ obligations });
}
