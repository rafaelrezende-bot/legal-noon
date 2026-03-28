import { NextRequest, NextResponse } from "next/server";
import { anthropic, SYSTEM_PROMPT } from "@/lib/anthropic";
import { toolDefinitions, executeTool } from "@/lib/chat-tools";
import { createAdminClient } from "@/lib/supabase/admin";

async function buildSystemPrompt(): Promise<string> {
  try {
    const supabase = createAdminClient();
    const { data: documents } = await supabase
      .from("policy_documents")
      .select("name, category, content")
      .order("name");

    if (!documents || documents.length === 0) return SYSTEM_PROMPT;

    // Truncate each document to ~20k chars to stay within token limits
    const MAX_DOC_CHARS = 20000;
    const docsSection = documents
      .map(
        (d) => {
          const content = d.content.length > MAX_DOC_CHARS
            ? d.content.substring(0, MAX_DOC_CHARS) + "\n\n[... documento truncado ...]"
            : d.content;
          return `### ${d.name} (Categoria: ${d.category})\n\n${content}`;
        }
      )
      .join("\n\n---\n\n");

    return `${SYSTEM_PROMPT}

## DOCUMENTOS DE POLÍTICAS E REGULAMENTOS

A seguir estão os documentos completos das políticas internas e regulamentos da Noon Capital Partners.
Use estes documentos para responder perguntas com precisão, citando o documento e seção relevante.

Quando responder perguntas sobre políticas ou regulamentos, SEMPRE cite o nome do documento
e a seção específica de onde a informação foi extraída. Se a informação não estiver em nenhum
dos documentos carregados, diga claramente que não encontrou essa informação nos documentos disponíveis.

---

${docsSection}`;
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

    const systemPrompt = await buildSystemPrompt();

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
    console.error("Chat API error:", error?.message || error, error?.status, JSON.stringify(error?.error || {}).substring(0, 500));
    return NextResponse.json(
      { error: "Failed to get response" },
      { status: 500 }
    );
  }
}
