import { NextRequest, NextResponse } from "next/server";
import { anthropic, SYSTEM_PROMPT } from "@/lib/anthropic";
import { toolDefinitions, executeTool } from "@/lib/chat-tools";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchRelevantChunks } from "@/lib/rag-search";

async function buildSystemPrompt(userMessage: string): Promise<string> {
  try {
    const supabase = createAdminClient();

    // Get document list (names only, no content)
    const { data: documents } = await supabase
      .from("policy_documents")
      .select("name, category")
      .order("name");

    const documentList = (documents || [])
      .map((d) => `- ${d.name} (${d.category || "Geral"})`)
      .join("\n");

    // RAG: search relevant chunks for the user's question
    let ragContext = "Nenhum trecho relevante encontrado nos documentos.";
    try {
      const relevantChunks = await searchRelevantChunks(userMessage, supabase, {
        matchThreshold: 0.65,
        matchCount: 8,
      });

      if (relevantChunks.length > 0) {
        ragContext = relevantChunks
          .map((chunk) => `[Fonte: ${chunk.documentName}]\n${chunk.content}`)
          .join("\n\n---\n\n");
      }
    } catch (ragError) {
      console.error("RAG search failed, continuing without context:", ragError);
    }

    return `${SYSTEM_PROMPT}

## Documentos disponíveis no sistema
${documentList}

## Trechos relevantes dos documentos (recuperados por similaridade)
Os trechos abaixo foram selecionados automaticamente com base na pergunta do usuário.
Use-os para fundamentar suas respostas. Sempre cite o documento fonte.

${ragContext}

## Regras adicionais
- Cite o documento fonte quando usar informações dos trechos acima
- Se a informação não estiver nos trechos fornecidos, diga que não encontrou nos documentos e sugira consultar o documento diretamente
- Use as tools disponíveis para consultar e atualizar dados do sistema
- Seja preciso com prazos, datas e obrigações`;
  } catch {
    return SYSTEM_PROMPT;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const systemPrompt = await buildSystemPrompt(message);

    const messages: { role: "user" | "assistant"; content: any }[] = [
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    let maxIterations = 5;
    while (maxIterations > 0) {
      maxIterations--;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        tools: toolDefinitions,
        messages,
      });

      if (response.stop_reason === "end_turn") {
        const text = response.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("");
        return NextResponse.json({ response: text });
      }

      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });

        const toolResults = [];
        for (const block of response.content) {
          if (block.type === "tool_use") {
            const result = await executeTool(
              block.name,
              block.input as Record<string, any>
            );
            toolResults.push({
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        messages.push({ role: "user", content: toolResults });
        continue;
      }

      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");
      return NextResponse.json({
        response: text || "Não consegui processar a solicitação.",
      });
    }

    return NextResponse.json({
      response:
        "Desculpe, a consulta ficou complexa demais. Tente simplificar sua pergunta.",
    });
  } catch (error: any) {
    console.error("Chat API error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to get response" },
      { status: 500 }
    );
  }
}
