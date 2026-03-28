import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export type UserRole = "admin" | "editor" | "leitor";

export async function getUserRole(): Promise<{ userId: string; role: UserRole } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  return { userId: user.id, role: (data?.role as UserRole) || "leitor" };
}

export function requireRole(...allowedRoles: UserRole[]) {
  return async function checkRole() {
    const userRole = await getUserRole();
    if (!userRole) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!allowedRoles.includes(userRole.role)) return NextResponse.json({ error: "Sem permissão para esta ação" }, { status: 403 });
    return null;
  };
}
