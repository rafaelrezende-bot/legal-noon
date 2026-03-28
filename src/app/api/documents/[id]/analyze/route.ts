import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { anthropic } from "@/lib/anthropic";

const EXTRACTION_PROMPT = `Você é um especialista em compliance regulatório brasileiro, especificamente para gestoras de recursos.
Analise o documento a seguir e identifique TODAS as obrigações regulatórias, prazos e entregas periódicas.

Para cada obrigação encontrada, use a tool sugerir_obrigacao com os dados extraídos.

Considere como obrigações:
- Entregas periódicas a órgãos reguladores (CVM, ANBIMA, COAF, Banco Central)
- Relatórios internos com prazo definido
- Revisões obrigatórias de políticas e procedimentos
- Reuniões periódicas de comitês
- Treinamentos obrigatórios
- Comunicações obrigatórias (como COAF)
- Atualizações cadastrais periódicas

Para cada obrigação, extraia:
- Nome/descrição da obrigação
- Prazo ou data limite (se mencionado)
- Frequência (anual, semestral, trimestral, mensal, pontual)
- Órgão/destinatário (CVM, ANBIMA, COAF, interno, etc.)
- Base legal ou referência no documento (seção, artigo)
- Responsável (se mencionado)`;

const extractionTool = {
  name: "sugerir_obrigacao",
  description: "Sugere uma obrigação regulatória encontrada no documento",
  input_schema: {
    type: "object" as const,
    properties: {
      name: { type: "string", description: "Nome da obrigação" },
      description: { type: "string", description: "Descrição detalhada" },
      deadline_description: { type: "string", description: "Descrição do prazo" },
      frequency: { type: "string", enum: ["anual", "semestral", "trimestral", "mensal", "pontual"] },
      category: { type: "string", enum: ["CVM", "ANBIMA", "PLDFT", "Interno"] },
      regulatory_basis: { type: "string", description: "Base legal ou seção do documento" },
      responsible: { type: "string", description: "Responsável, se mencionado" },
    },
    required: ["name", "description", "frequency", "category"],
  },
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: doc } = await supabase
      .from("policy_documents")
      .select("name, content")
      .eq("id", id)
      .single();

    if (!doc) {
      return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
    }

    // Truncate content if too long (max ~80k chars to leave room for response)
    const truncatedContent = doc.content.length > 80000
      ? doc.content.substring(0, 80000) + "\n\n[... documento truncado por tamanho ...]"
      : doc.content;

    const suggestions: any[] = [];
    const messages: any[] = [
      { role: "user", content: `Analise este documento e identifique todas as obrigações:\n\n## ${doc.name}\n\n${truncatedContent}` },
    ];

    let maxIterations = 10;
    while (maxIterations > 0) {
      maxIterations--;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: EXTRACTION_PROMPT,
        tools: [extractionTool],
        messages,
      });

      if (response.stop_reason === "end_turn") break;

      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });

        const toolResults = [];
        for (const block of response.content) {
          if (block.type === "tool_use" && block.name === "sugerir_obrigacao") {
            suggestions.push(block.input);
            toolResults.push({
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: JSON.stringify({ registered: true }),
            });
          }
        }

        messages.push({ role: "user", content: toolResults });
        continue;
      }

      break;
    }

    return NextResponse.json({ document_name: doc.name, suggestions });
  } catch (error: any) {
    console.error("Analyze error:", error);
    return NextResponse.json({ error: error.message || "Erro na análise." }, { status: 500 });
  }
}
