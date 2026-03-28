import { NextRequest, NextResponse } from "next/server";
import { anthropic, SYSTEM_PROMPT } from "@/lib/anthropic";
import { toolDefinitions, executeTool } from "@/lib/chat-tools";

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const messages: { role: "user" | "assistant"; content: any }[] = [
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    // Tool use loop: keep calling Claude until we get a final text response
    let maxIterations = 5;
    while (maxIterations > 0) {
      maxIterations--;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: toolDefinitions,
        messages,
      });

      // If stop_reason is "end_turn", extract final text
      if (response.stop_reason === "end_turn") {
        const text = response.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("");
        return NextResponse.json({ response: text });
      }

      // If stop_reason is "tool_use", execute tools and continue
      if (response.stop_reason === "tool_use") {
        // Add assistant response with tool_use blocks
        messages.push({ role: "assistant", content: response.content });

        // Execute each tool call and build tool_result blocks
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

        // Add tool results as user message
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // Fallback: extract any text
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");
      return NextResponse.json({ response: text || "Não consegui processar a solicitação." });
    }

    return NextResponse.json({
      response: "Desculpe, a consulta ficou complexa demais. Tente simplificar sua pergunta.",
    });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to get response" },
      { status: 500 }
    );
  }
}
