import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/permissions";
import { logAudit, getAuditUser } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("training_records")
    .select("*, training_type:training_types(*)")
    .order("completed_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data });
}

export async function POST(request: NextRequest) {
  const denied = await requireRole('admin', 'editor')();
  if (denied) return denied;
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    if (!body.training_type_id || !body.participant_name || !body.completed_at) {
      return NextResponse.json({ error: "Campos obrigatórios faltando." }, { status: 400 });
    }

    // Calculate expires_at based on training type frequency
    let expiresAt: string | null = null;
    const { data: trainingType } = await supabase
      .from("training_types")
      .select("frequency")
      .eq("id", body.training_type_id)
      .single();

    if (trainingType) {
      const completed = new Date(body.completed_at);
      switch (trainingType.frequency) {
        case "anual":
          completed.setFullYear(completed.getFullYear() + 1);
          expiresAt = completed.toISOString().split("T")[0];
          break;
        case "semestral":
          completed.setMonth(completed.getMonth() + 6);
          expiresAt = completed.toISOString().split("T")[0];
          break;
        case "trimestral":
          completed.setMonth(completed.getMonth() + 3);
          expiresAt = completed.toISOString().split("T")[0];
          break;
        // pontual: no expiry
      }
    }

    const { data, error } = await supabase
      .from("training_records")
      .insert({
        training_type_id: body.training_type_id,
        participant_name: body.participant_name,
        participant_email: body.participant_email || null,
        completed_at: body.completed_at,
        expires_at: expiresAt,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const authSupabase = await createClient();
    const auditUser = await getAuditUser(authSupabase);
    if (auditUser) {
      logAudit({ supabase: createAdminClient(), ...auditUser, action: "created", entityType: "training", entityId: data.id, entityName: body.participant_name });
    }

    return NextResponse.json({ record: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
