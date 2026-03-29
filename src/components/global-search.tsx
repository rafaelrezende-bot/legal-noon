"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { CalendarDays, FileText, Users } from "lucide-react";
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

// Global open trigger for sidebar button
let globalOpenSearch: (() => void) | null = null;
export function openGlobalSearch() { globalOpenSearch?.(); }

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { globalOpenSearch = () => setOpen(true); return () => { globalOpenSearch = null; }; }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((v) => !v); }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function search(term: string) {
    setLoading(true);
    const pattern = `%${term}%`;

    const [obs, docs, persons] = await Promise.all([
      supabase.from("obligations").select("id, title, description, category:categories(name)").or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(5),
      supabase.from("policy_documents").select("id, name").ilike("name", pattern).limit(5),
      supabase.from("supervised_persons").select("id, name, role, email").or(`name.ilike.${pattern},email.ilike.${pattern}`).limit(5),
    ]);

    setResults([
      ...(obs.data || []).map((o: any) => ({ id: o.id, type: "obligation" as const, title: o.title, subtitle: o.category?.name, href: "/" })),
      ...(docs.data || []).map((d: any) => ({ id: d.id, type: "document" as const, title: d.name, subtitle: "", href: "/admin/documentos" })),
      ...(persons.data || []).map((p: any) => ({ id: p.id, type: "person" as const, title: p.name, subtitle: p.role || p.email, href: "/admin/usuarios" })),
    ]);
    setLoading(false);
  }

  const grouped = results.reduce((acc, r) => { if (!acc[r.type]) acc[r.type] = []; acc[r.type].push(r); return acc; }, {} as Record<string, SearchResult[]>);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar obrigações, documentos, pessoas..." value={query} onValueChange={setQuery} />
      <CommandList>
        {loading && <div className="py-6 text-center text-sm text-gray-500">Buscando...</div>}
        {!loading && query.length >= 2 && results.length === 0 && <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>}
        {!loading && query.length < 2 && <div className="py-6 text-center text-sm text-gray-400">Digite ao menos 2 caracteres para buscar</div>}
        {Object.entries(grouped).map(([type, items]) => {
          const Icon = icons[type as keyof typeof icons];
          return (
            <CommandGroup key={type} heading={labels[type as keyof typeof labels]}>
              {items.map((item) => (
                <CommandItem key={item.id} value={item.title} onSelect={() => { setOpen(false); setQuery(""); router.push(item.href); }} className="cursor-pointer">
                  <Icon className="mr-2 h-4 w-4 text-gray-400" />
                  <div className="flex flex-col">
                    <span className="text-sm">{item.title}</span>
                    {item.subtitle && <span className="text-xs text-gray-400">{item.subtitle}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
