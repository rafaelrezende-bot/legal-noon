import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: doc } = await supabase
      .from("policy_documents")
      .select("storage_path, filename")
      .eq("id", id)
      .single();

    if (!doc?.storage_path) {
      return NextResponse.json({ error: "Documento não encontrado ou sem arquivo." }, { status: 404 });
    }

    const { data: signedUrl } = await supabase.storage
      .from("policy-documents")
      .createSignedUrl(doc.storage_path, 60);

    if (!signedUrl?.signedUrl) {
      return NextResponse.json({ error: "Erro ao gerar URL de download." }, { status: 500 });
    }

    return NextResponse.redirect(signedUrl.signedUrl);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
