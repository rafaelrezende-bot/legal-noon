import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const denied = await requireRole('admin')();
  if (denied) return denied;
  try {
    const supabaseAdmin = createAdminClient();
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório." }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("invited_users")
      .update({ invited_at: new Date().toISOString() })
      .eq("email", email);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://legal-noon.vercel.app";
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?type=invite`,
    });

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro interno." }, { status: 500 });
  }
}
