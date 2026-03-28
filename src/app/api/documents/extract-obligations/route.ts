import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { anthropic } from "@/lib/anthropic";

const EXTRACTION_SYSTEM = `Você é um especialista em compliance regulatório do mercado financeiro brasileiro.

Sua tarefa é analisar o documento a seguir e extrair TODAS as obrigações regulatórias,
prazos e compromissos de compliance que ele contém.

Para cada obrigação identificada, retorne um objeto JSON com:
- title: nome curto e descritivo da obrigação (máx 80 caracteres)
- description: descrição completa incluindo o que deve ser feito, por quem e quando
- category: uma de ["CVM", "ANBIMA", "PLDFT", "Interno"]
- frequency: uma de ["anual", "semestral", "trimestral", "mensal", "continuo", "por_evento"]
- deadline_day: dia do mês do prazo (número 1-31, ou null se não aplicável)
- deadline_month: mês do prazo (número 1-12, ou null se recorrente)
- legal_basis: base legal ou referência normativa`;

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json({ error: "documentId é obrigatório." }, { status: 400 });
    }

    // Fetch only this document
    const { data: doc } = await supabase
      .from("policy_documents")
      .select("name, content")
      .eq("id", documentId)
      .single();

    if (!doc?.content) {
      return NextResponse.json({ error: "Documento não encontrado ou sem texto." }, { status: 400 });
    }

    // Fetch existing obligations for dedup
    const { data: existingObs } = await supabase
      .from("obligations")
      .select("title, description")
      .order("title");

    const existingList = (existingObs || [])
      .map((o) => `- ${o.title}`)
      .join("\n");

    // Truncate document if too large (~50k chars max)
    const maxChars = 50000;
    const docText = doc.content.length > maxChars
      ? doc.content.substring(0, maxChars) + "\n\n[... documento truncado ...]"
      : doc.content;

    const systemPrompt = `${EXTRACTION_SYSTEM}

IMPORTANTE: Estas obrigações JÁ EXISTEM no sistema. NÃO as inclua novamente:
${existingList || "(nenhuma obrigação existente)"}

Retorne APENAS um JSON array com as obrigações NOVAS encontradas.
Se não houver obrigações novas, retorne um array vazio [].
Responda APENAS com o JSON, sem texto adicional.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Analise o seguinte documento e extraia as obrigações regulatórias:\n\n---\nDocumento: ${doc.name}\n\n${docText}\n---`,
        },
      ],
    });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Parse JSON from response — handle cases where Claude wraps in markdown
    let obligations: any[] = [];
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        obligations = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error("Failed to parse extraction response:", rawText.substring(0, 500));
      return NextResponse.json({ error: "Não foi possível processar a resposta da IA." }, { status: 500 });
    }

    // Validate and normalize
    obligations = obligations.filter((o: any) => o.title && o.category && o.frequency).map((o: any) => ({
      title: String(o.title).substring(0, 120),
      description: o.description || "",
      category: ["CVM", "ANBIMA", "PLDFT", "Interno"].includes(o.category) ? o.category : "Interno",
      frequency: ["anual", "semestral", "trimestral", "mensal", "continuo", "por_evento"].includes(o.frequency) ? o.frequency : "anual",
      deadline_day: typeof o.deadline_day === "number" && o.deadline_day >= 1 && o.deadline_day <= 31 ? o.deadline_day : null,
      deadline_month: typeof o.deadline_month === "number" && o.deadline_month >= 1 && o.deadline_month <= 12 ? o.deadline_month : null,
      legal_basis: o.legal_basis || null,
    }));

    return NextResponse.json({ document_name: doc.name, obligations });
  } catch (error: any) {
    console.error("Extract obligations error:", error?.message || error);
    return NextResponse.json({ error: error.message || "Erro na extração." }, { status: 500 });
  }
}
