import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const denied = await requireRole("admin")();
  if (denied) return denied;

  const supabase = createAdminClient();
  const entityType = request.nextUrl.searchParams.get("entity_type");
  const days = request.nextUrl.searchParams.get("days");
  const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
  const limit = 50;
  const offset = (page - 1) * limit;

  let query = supabase.from("audit_logs").select("*", { count: "exact" }).order("created_at", { ascending: false });

  if (entityType && entityType !== "all") query = query.eq("entity_type", entityType);
  if (days && days !== "all") {
    const since = new Date(Date.now() - parseInt(days) * 86400000).toISOString();
    query = query.gte("created_at", since);
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data, total: count, page, limit });
}
