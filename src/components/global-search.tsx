"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CalendarDays, FileText, Users, Search, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SearchResult {
  id: string;
  type: "obligation" | "document" | "person";
  title: string;
  subtitle?: string;
  href: string;
}

const icons = { obligation: CalendarDays, document: FileText, person: Users };
const labels = { obligation: "Obrigações", document: "Documentos", person: "Pessoas" };

let globalOpenFn: (() => void) | null = null;
export function openGlobalSearch() { globalOpenFn?.(); }

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { globalOpenFn = () => setOpen(true); return () => { globalOpenFn = null; }; }, []);

  // ⌘K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen(v => !v); }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const doSearch = useCallback(async (term: string) => {
    setLoading(true);
    const pattern = `%${term}%`;
    try {
      const [obs, docs, persons] = await Promise.all([
        supabase.from("obligations").select("id, title, description").or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(5),
        supabase.from("policy_documents").select("id, name").ilike("name", pattern).limit(5),
        supabase.from("supervised_persons").select("id, name, role").or(`name.ilike.${pattern}`).limit(5),
      ]);
      setResults([
        ...(obs.data || []).map((o: any) => ({ id: o.id, type: "obligation" as const, title: o.title, subtitle: "", href: "/" })),
        ...(docs.data || []).map((d: any) => ({ id: d.id, type: "document" as const, title: d.name, subtitle: "", href: "/admin/documentos" })),
        ...(persons.data || []).map((p: any) => ({ id: p.id, type: "person" as const, title: p.name, subtitle: p.role || "", href: "/admin/usuarios" })),
      ]);
    } catch { setResults([]); }
    setLoading(false);
  }, []);

  const handleSelect = (r: SearchResult) => { setOpen(false); setQuery(""); router.push(r.href); };

  const grouped = results.reduce((acc, r) => { if (!acc[r.type]) acc[r.type] = []; acc[r.type].push(r); return acc; }, {} as Record<string, SearchResult[]>);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setQuery(""); setResults([]); } }}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <div className="flex items-center border-b border-gray-200 px-4">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar obrigações, documentos, pessoas..."
            className="border-0 focus-visible:ring-0 text-sm h-12"
            autoFocus
          />
          {loading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />}
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Nenhum resultado encontrado.</p>
          )}
          {query.length > 0 && query.length < 2 && (
            <p className="text-sm text-gray-400 text-center py-8">Digite ao menos 2 caracteres</p>
          )}
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = icons[type as keyof typeof icons];
            const label = labels[type as keyof typeof labels];
            return (
              <div key={type}>
                <p className="text-[10px] font-medium text-gray-400 uppercase px-4 pt-3 pb-1">{label}</p>
                {items.map((item) => (
                  <button key={item.id} onClick={() => handleSelect(item)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors">
                    <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm text-gray-800 block truncate">{item.title}</span>
                      {item.subtitle && <span className="text-xs text-gray-400 block truncate">{item.subtitle}</span>}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
