import { NextRequest, NextResponse } from "next/server";
import { anthropic, SYSTEM_PROMPT } from "@/lib/anthropic";
import { toolDefinitions, executeTool } from "@/lib/chat-tools";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { searchRelevantChunks } from "@/lib/rag-search";

async function buildSystemPrompt(userMessage: string): Promise<string> {
  try {
    const supabase = createAdminClient();
    const { data: documents } = await supabase.from("policy_documents").select("name").order("name");
    const documentList = (documents || []).map((d) => `- ${d.name}`).join("\n");

    let ragContext = "Nenhum trecho relevante encontrado nos documentos.";
    try {
      const chunks = await searchRelevantChunks(userMessage, supabase, { matchThreshold: 0.65, matchCount: 8 });
      if (chunks.length > 0) ragContext = chunks.map((c) => `[Fonte: ${c.documentName}]\n${c.content}`).join("\n\n---\n\n");
    } catch {}

    return `${SYSTEM_PROMPT}

## Documentos disponíveis
${documentList}

## Trechos relevantes (RAG)
${ragContext}

## Regras adicionais
- Cite o documento fonte quando usar informações dos trechos
- Se não encontrou nos documentos, diga claramente
- Use as tools para consultar e atualizar dados do sistema`;
  } catch { return SYSTEM_PROMPT; }
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Get authenticated user
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    const userId = user?.id;

    const supabase = createAdminClient();

    // Save user message
    if (userId) {
      await supabase.from("chat_messages").insert({ user_id: userId, role: "user", content: message });
    }

    // Load recent history from DB (last 20 messages)
    let history: { role: string; content: string }[] = [];
    if (userId) {
      const { data: dbHistory } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(20);
      history = dbHistory || [];
    }

    const systemPrompt = await buildSystemPrompt(message);

    const messages: { role: "user" | "assistant"; content: any }[] = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Tool use loop
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
        const text = response.content.filter((b) => b.type === "text").map((b) => (b as any).text).join("");

        // Save assistant response
        if (userId) {
          await supabase.from("chat_messages").insert({ user_id: userId, role: "assistant", content: text });
        }

        return NextResponse.json({ response: text });
      }

      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });
        const toolResults = [];
        for (const block of response.content) {
          if (block.type === "tool_use") {
            const result = await executeTool(block.name, block.input as Record<string, any>);
            toolResults.push({ type: "tool_result" as const, tool_use_id: block.id, content: result });
          }
        }
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      const text = response.content.filter((b) => b.type === "text").map((b) => (b as any).text).join("");
      if (userId) await supabase.from("chat_messages").insert({ user_id: userId, role: "assistant", content: text || "Não consegui processar." });
      return NextResponse.json({ response: text || "Não consegui processar a solicitação." });
    }

    return NextResponse.json({ response: "Desculpe, a consulta ficou complexa demais." });
  } catch (error: any) {
    console.error("Chat API error:", error?.message || error);
    return NextResponse.json({ error: "Failed to get response" }, { status: 500 });
  }
}
