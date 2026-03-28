import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractTextFromPDF } from "@/lib/pdf-extract";

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const category = formData.get("category") as string;

    if (!file || !name || !category) {
      return NextResponse.json({ error: "Campos obrigatórios faltando." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo deve ter no máximo 10MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uuid = crypto.randomUUID();
    const storagePath = `${uuid}/${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("policy-documents")
      .upload(storagePath, buffer, { contentType: "application/pdf" });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { text: content, pages } = await extractTextFromPDF(buffer);

    const { data: doc, error: insertError } = await supabase
      .from("policy_documents")
      .insert({
        name,
        filename: file.name,
        category,
        content,
        pages,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ document: doc });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Erro no upload." }, { status: 500 });
  }
}
