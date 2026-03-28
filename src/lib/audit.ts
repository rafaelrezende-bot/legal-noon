export type AuditAction = "created" | "updated" | "deleted" | "included" | "discarded" | "restored";
export type AuditEntityType = "obligation" | "obligation_instance" | "document" | "training" | "declaration" | "person" | "category" | "user" | "extracted_obligation";

interface AuditParams {
  supabase: any;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  entityName?: string;
  details?: Record<string, any>;
}

export function logAudit({ supabase, userId, userName, action, entityType, entityId, entityName, details = {} }: AuditParams) {
  // Fire and forget
  supabase.from("audit_logs").insert({
    user_id: userId, user_name: userName, action, entity_type: entityType,
    entity_id: entityId, entity_name: entityName, details,
  }).then(({ error }: any) => { if (error) console.error("[Audit]", error.message); });
}

export async function getAuditUser(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("invited_users").select("name").eq("email", user.email).single();
  return { userId: user.id, userName: profile?.name || user.email || "Desconhecido" };
}
