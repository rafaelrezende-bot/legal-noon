"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChatBubble } from "@/components/chat-bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import type { ChatMessage } from "@/lib/types";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true });
      setMessages(data || []);
    }
    load();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    await supabase.from("chat_messages").insert({ role: "user", content: text });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const { response } = await res.json();

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      await supabase.from("chat_messages").insert({ role: "assistant", content: response });
    } catch {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Desculpe, ocorreu um erro. Tente novamente.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b border-gray-200 bg-white px-8 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Assistente IA</h1>
        <p className="text-xs text-gray-400">Especialista em compliance regulatório brasileiro</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6">
        {messages.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "#EBF5FA" }}>
                <span className="text-xl">⚖️</span>
              </div>
              <h2 className="font-semibold text-gray-900 mb-2">Assistente de Compliance</h2>
              <p className="text-sm text-gray-500">
                Pergunte sobre obrigações regulatórias, prazos da CVM/ANBIMA, políticas internas ou procedimentos de PLDFT.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-[#EBF5FA] rounded-2xl rounded-tl-md px-4 py-3 text-sm text-gray-500">
              Pensando<span className="animate-pulse">...</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 bg-white px-8 py-4">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="flex gap-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre compliance, prazos, obrigações..."
            className="flex-1"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()} style={{ backgroundColor: "#1E7FA8" }}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
