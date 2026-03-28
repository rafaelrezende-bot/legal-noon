import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const denied = await requireRole("admin")();
  if (denied) return denied;
  try {
    const supabaseAdmin = createAdminClient();
    const { name, email, role: selectedRole } = await request.json();

    if (!name || !email) {
      return NextResponse.json({ error: "Nome e email são obrigatórios." }, { status: 400 });
    }

    const userRole = selectedRole || "leitor";

    const { error: insertError } = await supabaseAdmin
      .from("invited_users")
      .insert({ name, email, role: userRole });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "Este email já foi convidado." }, { status: 409 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://legal-noon.vercel.app";
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { name },
      redirectTo: `${siteUrl}/auth/callback?type=invite`,
    });

    if (inviteError) {
      await supabaseAdmin.from("invited_users").delete().eq("email", email);
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    // Create user_profile with selected role
    if (inviteData?.user) {
      await supabaseAdmin.from("user_profiles").upsert({
        user_id: inviteData.user.id,
        role: userRole,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro interno." }, { status: 500 });
  }
}
