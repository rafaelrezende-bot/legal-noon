import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/permissions";
import { logAudit, getAuditUser } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const denied = await requireRole('admin', 'editor')();
  if (denied) return denied;
  try {
    const supabase = createAdminClient();
    const { declaration_id, status, items, notes } = await request.json();

    if (!declaration_id || !status) {
      return NextResponse.json({ error: "Campos obrigatórios faltando." }, { status: 400 });
    }

    // Update declaration status
    const { error: updateError } = await supabase
      .from("personal_declarations")
      .update({
        status,
        submitted_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq("id", declaration_id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    // Insert items if provided
    if (items && items.length > 0) {
      const itemsWithDeclaration = items.map((item: any) => ({
        ...item,
        declaration_id,
      }));

      const { error: itemsError } = await supabase
        .from("declaration_items")
        .insert(itemsWithDeclaration);

      if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const authSupabase = await createClient();
    const auditUser = await getAuditUser(authSupabase);
    if (auditUser) {
      logAudit({ supabase: createAdminClient(), ...auditUser, action: "created", entityType: "declaration", entityId: declaration_id, details: { status } });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
