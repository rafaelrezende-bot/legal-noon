"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChatBubble } from "@/components/chat-bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send } from "lucide-react";
import type { ChatMessage } from "@/lib/types";

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (open && !loaded) {
      async function load() {
        const { data } = await supabase
          .from("chat_messages")
          .select("*")
          .order("created_at", { ascending: true });
        setMessages(data || []);
        setLoaded(true);
      }
      load();
    }
  }, [open, loaded]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
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

    await supabase
      .from("chat_messages")
      .insert({ role: "user", content: text });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages
            .slice(-20)
            .map((m) => ({ role: m.role, content: m.content })),
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

      await supabase
        .from("chat_messages")
        .insert({ role: "assistant", content: response });
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
    <>
      {/* Panel */}
      <div
        className={`fixed bottom-20 right-6 w-96 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-in-out z-50 ${
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        style={{ height: "70vh", maxHeight: "600px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: '#033244' }}>
          <div>
            <h2 className="text-sm font-semibold text-white">
              Assistente Legal Noon
            </h2>
            <p className="text-xs" style={{ color: '#B2C7D6' }}>
              Compliance regulatório brasileiro
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 && !loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-xs">
                <div
                  className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: "#F2F2F2" }}
                >
                  <span className="text-base">⚖️</span>
                </div>
                <p className="text-sm text-gray-500">
                  Pergunte sobre obrigações, prazos, políticas ou procedimentos
                  de compliance.
                </p>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          {loading && (
            <div className="flex justify-start mb-4">
              <div className="bg-[#F2F2F2] rounded-2xl rounded-tl-md px-4 py-3 text-sm text-gray-500">
                Pensando<span className="animate-pulse">...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre compliance..."
              className="flex-1 text-sm"
              disabled={loading}
            />
            <Button
              type="submit"
              size="sm"
              disabled={loading || !input.trim()}
              style={{ backgroundColor: "#025382" }}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform duration-200 hover:scale-105 z-50"
        style={{ backgroundColor: "#025382", border: '1px solid #D2BD80' }}
        aria-label={open ? "Fechar chat" : "Abrir assistente"}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </>
  );
}
