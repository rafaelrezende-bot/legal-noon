"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ObligationCard } from "@/components/obligation-card";
import { StatusBadge } from "@/components/status-badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const STATUSES = ["pendente", "em_andamento", "concluida", "atrasada"] as const;

export default function CalendarioPage() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(new Date().getMonth());
  const [instances, setInstances] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<any | null>(null);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    const startOfMonth = new Date(year, month, 1).toISOString().split("T")[0];
    const endOfMonth = new Date(year, month + 1, 0).toISOString().split("T")[0];

    const { data } = await supabase
      .from("obligation_instances")
      .select("*, obligation:obligations(*, category:categories(*))")
      .gte("due_date", startOfMonth)
      .lte("due_date", endOfMonth)
      .order("due_date");

    setInstances(data || []);

    const { data: cats } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    setCategories(cats || []);
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const toggleCategory = (slug: string) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const today = new Date().toISOString().split("T")[0];

  const filtered = instances.filter((i) => {
    const catSlug = i.obligation?.category?.slug;
    const effectiveStatus =
      i.status !== "concluida" && i.due_date < today ? "atrasada" : i.status;
    if (selectedCategories.length > 0 && !selectedCategories.includes(catSlug)) return false;
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(effectiveStatus)) return false;
    return true;
  });

  const grouped = filtered.reduce((acc: Record<string, any[]>, i) => {
    const d = i.due_date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(i);
    return acc;
  }, {});

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === "concluida") updates.completed_at = new Date().toISOString();
    else updates.completed_at = null;

    await supabase.from("obligation_instances").update(updates).eq("id", id);
    setSelectedInstance(null);
    fetchData();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendário</h1>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-base font-semibold text-gray-900 min-w-[180px] text-center">
            {MONTHS[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => toggleCategory(cat.slug)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              selectedCategories.includes(cat.slug)
                ? "text-white"
                : "bg-white text-gray-600 border-gray-200"
            }`}
            style={
              selectedCategories.includes(cat.slug)
                ? { backgroundColor: cat.color, borderColor: cat.color }
                : {}
            }
          >
            {cat.name}
          </button>
        ))}
        <div className="w-px bg-gray-200 mx-1" />
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => toggleStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              selectedStatuses.includes(s)
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            {s === "pendente" ? "Pendente" : s === "em_andamento" ? "Em andamento" : s === "concluida" ? "Concluída" : "Atrasada"}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {Object.keys(grouped)
          .sort()
          .map((date) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-gray-500 mb-3">
                {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h3>
              <div className="grid gap-3">
                {grouped[date].map((instance: any) => (
                  <ObligationCard
                    key={instance.id}
                    instance={instance}
                    onClick={() => setSelectedInstance(instance)}
                  />
                ))}
              </div>
            </div>
          ))}
        {Object.keys(grouped).length === 0 && (
          <p className="text-sm text-gray-400 py-8 text-center">
            Nenhuma obrigação encontrada para este mês.
          </p>
        )}
      </div>

      <Dialog open={!!selectedInstance} onOpenChange={() => setSelectedInstance(null)}>
        <DialogContent className="max-w-lg">
          {selectedInstance && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedInstance.obligation?.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: selectedInstance.obligation?.category?.color + "15",
                      color: selectedInstance.obligation?.category?.color,
                    }}
                  >
                    {selectedInstance.obligation?.category?.name}
                  </span>
                  <StatusBadge
                    status={
                      selectedInstance.status !== "concluida" && selectedInstance.due_date < today
                        ? "atrasada"
                        : selectedInstance.status
                    }
                    size="sm"
                  />
                </div>
                <p className="text-sm text-gray-600">
                  {selectedInstance.obligation?.description}
                </p>
                {selectedInstance.obligation?.legal_basis && (
                  <p className="text-xs text-gray-400">
                    Base legal: {selectedInstance.obligation.legal_basis}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  Prazo:{" "}
                  {new Date(selectedInstance.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                  {selectedInstance.obligation?.is_business_day && " (dia útil)"}
                </p>
                <div className="flex gap-2 pt-2">
                  {(["pendente", "em_andamento", "concluida"] as const).map((s) => (
                    <Button
                      key={s}
                      variant={selectedInstance.status === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateStatus(selectedInstance.id, s)}
                    >
                      {s === "pendente" ? "Pendente" : s === "em_andamento" ? "Em andamento" : "Concluída"}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
