"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ObligationCard } from "@/components/obligation-card";
import { StatusBadge } from "@/components/status-badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock, AlertTriangle, CalendarClock, CheckCircle2, ArrowLeft,
} from "lucide-react";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const STATUSES = ["pendente", "em_andamento", "concluida", "atrasada"] as const;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

interface MonthDot { categoryId: string; categoryName: string; color: string; count: number; }
interface MonthData { monthIndex: number; dots: MonthDot[]; total: number; }

export default function CalendarioPage() {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const today = new Date().toISOString().split("T")[0];
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const [view, setView] = useState<"annual" | "monthly">("annual");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [yearInstances, setYearInstances] = useState<any[]>([]);
  const [monthInstances, setMonthInstances] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<any | null>(null);

  // Load user name
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: invited } = await supabase.from("invited_users").select("name").eq("email", user.email).single();
      const name = invited?.name || user.user_metadata?.name || null;
      if (name) setFirstName(name.split(" ")[0]);
    }
    loadUser();
  }, []);

  // Load year data
  const fetchYearData = useCallback(async () => {
    const { data } = await supabase
      .from("obligation_instances")
      .select("id, due_date, status, obligation:obligations!inner(id, title, category_id, category:categories!inner(id, name, color))")
      .gte("due_date", `${currentYear}-01-01`)
      .lte("due_date", `${currentYear}-12-31`)
      .order("due_date");
    setYearInstances(data || []);

    const { data: cats } = await supabase.from("categories").select("*").order("name");
    setCategories(cats || []);
  }, [currentYear]);

  useEffect(() => { fetchYearData(); }, [fetchYearData]);

  // Load month data when drilling down
  const fetchMonthData = useCallback(async (month: number) => {
    const start = `${currentYear}-${String(month + 1).padStart(2, "0")}-01`;
    const end = new Date(currentYear, month + 1, 0).toISOString().split("T")[0];
    const { data } = await supabase
      .from("obligation_instances")
      .select("*, obligation:obligations(*, category:categories(*))")
      .gte("due_date", start)
      .lte("due_date", end)
      .order("due_date");
    setMonthInstances(data || []);
  }, [currentYear]);

  // Summary cards (global)
  const pendingCount = yearInstances.filter(i => i.status !== "concluida").length;
  const overdueCount = yearInstances.filter(i => i.status !== "concluida" && i.due_date < today).length;
  const next7Count = yearInstances.filter(i => i.status !== "concluida" && i.due_date >= today && i.due_date <= in7Days).length;
  const completedCount = yearInstances.filter(i => i.status === "concluida").length;

  const summaryCards = [
    { label: "Pendentes", value: pendingCount, icon: Clock, color: "#F59E0B", bg: "#FFFBEB" },
    { label: "Atrasadas", value: overdueCount, icon: AlertTriangle, color: "#DC2626", bg: "#FEF2F2" },
    { label: "Próximos 7 dias", value: next7Count, icon: CalendarClock, color: "#025382", bg: "#F2F2F2" },
    { label: "Concluídas", value: completedCount, icon: CheckCircle2, color: "#16A34A", bg: "#F0FDF4" },
  ];

  // Group year data by month + category
  const monthsData: MonthData[] = Array.from({ length: 12 }, (_, i) => ({ monthIndex: i, dots: [], total: 0 }));
  for (const inst of yearInstances) {
    const m = new Date(inst.due_date + "T12:00:00").getMonth();
    monthsData[m].total++;
    const cat = inst.obligation?.category;
    if (!cat) continue;
    const existing = monthsData[m].dots.find(d => d.categoryId === cat.id);
    if (existing) existing.count++;
    else monthsData[m].dots.push({ categoryId: cat.id, categoryName: cat.name, color: cat.color, count: 1 });
  }

  // Month click
  const handleMonthClick = (monthIndex: number) => {
    setSelectedMonth(monthIndex);
    setView("monthly");
    setSelectedCategories([]);
    setSelectedStatuses([]);
    fetchMonthData(monthIndex);
  };

  // Monthly view filters
  const filtered = monthInstances.filter(i => {
    const catSlug = i.obligation?.category?.slug;
    const effectiveStatus = i.status !== "concluida" && i.due_date < today ? "atrasada" : i.status;
    if (selectedCategories.length > 0 && !selectedCategories.includes(catSlug)) return false;
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(effectiveStatus)) return false;
    return true;
  });

  const grouped = filtered.reduce((acc: Record<string, any[]>, i) => {
    if (!acc[i.due_date]) acc[i.due_date] = [];
    acc[i.due_date].push(i);
    return acc;
  }, {});

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === "concluida") updates.completed_at = new Date().toISOString();
    else updates.completed_at = null;
    await supabase.from("obligation_instances").update(updates).eq("id", id);
    setSelectedInstance(null);
    if (selectedMonth !== null) fetchMonthData(selectedMonth);
    fetchYearData();
  };

  return (
    <div className="p-8">
      {/* Greeting */}
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#033244" }}>
        {getGreeting()}{firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="text-sm text-gray-500 mb-6">Calendário de obrigações regulatórias — {currentYear}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {summaryCards.map(c => (
          <Card key={c.label} className="p-5 bg-white rounded-xl shadow-sm border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.bg }}>
                <c.icon className="w-5 h-5" style={{ color: c.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
                <p className="text-xs text-gray-500">{c.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {view === "annual" ? (
        <>
          {/* Year grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {monthsData.map((md) => (
              <div
                key={md.monthIndex}
                onClick={() => handleMonthClick(md.monthIndex)}
                className={`relative rounded-xl border bg-white p-4 cursor-pointer transition-all hover:shadow-md ${
                  md.monthIndex === currentMonth ? "border-2" : "border-gray-200"
                }`}
                style={md.monthIndex === currentMonth ? { borderColor: "#025382" } : {}}
              >
                {md.monthIndex === currentMonth && (
                  <span className="absolute top-2 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: "#025382", backgroundColor: "rgba(2,83,130,0.1)" }}>Atual</span>
                )}
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{MONTHS[md.monthIndex]}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {md.dots.map((dot, i) =>
                    dot.count <= 5
                      ? Array.from({ length: dot.count }).map((_, j) => (
                          <span key={`${i}-${j}`} className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: dot.color }} title={`${dot.categoryName}: ${dot.count}`} />
                        ))
                      : (
                          <span key={i} className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-bold" style={{ backgroundColor: dot.color }} title={`${dot.categoryName}: ${dot.count}`}>{dot.count}</span>
                        )
                  )}
                  {md.dots.length === 0 && <span className="text-xs text-gray-400 italic">Sem obrigações</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-6 justify-center">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-xs text-gray-600">{cat.name}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Monthly drill-down */}
          <button onClick={() => { setView("annual"); setSelectedMonth(null); }}
            className="flex items-center gap-2 text-sm mb-4 transition-colors hover:text-gray-900" style={{ color: "#025382" }}>
            <ArrowLeft className="w-4 h-4" />Voltar para visão anual
          </button>

          <h2 className="text-lg font-semibold mb-4" style={{ color: "#025382" }}>
            {MONTHS[selectedMonth!]} {currentYear}
          </h2>

          {/* Filters */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {categories.map(cat => (
              <button key={cat.slug} onClick={() => setSelectedCategories(prev => prev.includes(cat.slug) ? prev.filter(s => s !== cat.slug) : [...prev, cat.slug])}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${selectedCategories.includes(cat.slug) ? "text-white" : "bg-white text-gray-600 border-gray-200"}`}
                style={selectedCategories.includes(cat.slug) ? { backgroundColor: cat.color, borderColor: cat.color } : {}}>
                {cat.name}
              </button>
            ))}
            <div className="w-px bg-gray-200 mx-1" />
            {STATUSES.map(s => (
              <button key={s} onClick={() => setSelectedStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${selectedStatuses.includes(s) ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>
                {s === "pendente" ? "Pendente" : s === "em_andamento" ? "Em andamento" : s === "concluida" ? "Concluída" : "Atrasada"}
              </button>
            ))}
          </div>

          {/* Obligations list */}
          <div className="space-y-6">
            {Object.keys(grouped).sort().map(date => (
              <div key={date}>
                <h3 className="text-sm font-semibold text-gray-500 mb-3">
                  {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                </h3>
                <div className="grid gap-3">
                  {grouped[date].map((inst: any) => (
                    <ObligationCard key={inst.id} instance={inst} onClick={() => setSelectedInstance(inst)} />
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(grouped).length === 0 && (
              <p className="text-sm text-gray-400 py-8 text-center">Nenhuma obrigação encontrada para este mês.</p>
            )}
          </div>

          {/* Detail modal */}
          <Dialog open={!!selectedInstance} onOpenChange={() => setSelectedInstance(null)}>
            <DialogContent className="max-w-lg">
              {selectedInstance && (
                <>
                  <DialogHeader><DialogTitle>{selectedInstance.obligation?.title}</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: selectedInstance.obligation?.category?.color + "15", color: selectedInstance.obligation?.category?.color }}>{selectedInstance.obligation?.category?.name}</span>
                      <StatusBadge status={selectedInstance.status !== "concluida" && selectedInstance.due_date < today ? "atrasada" : selectedInstance.status} size="sm" />
                    </div>
                    <p className="text-sm text-gray-600">{selectedInstance.obligation?.description}</p>
                    {selectedInstance.obligation?.legal_basis && <p className="text-xs text-gray-400">Base legal: {selectedInstance.obligation.legal_basis}</p>}
                    <p className="text-xs text-gray-400">Prazo: {new Date(selectedInstance.due_date + "T12:00:00").toLocaleDateString("pt-BR")}{selectedInstance.obligation?.is_business_day && " (dia útil)"}</p>
                    <div className="flex gap-2 pt-2">
                      {(["pendente", "em_andamento", "concluida"] as const).map(s => (
                        <Button key={s} variant={selectedInstance.status === s ? "default" : "outline"} size="sm" onClick={() => updateStatus(selectedInstance.id, s)}>
                          {s === "pendente" ? "Pendente" : s === "em_andamento" ? "Em andamento" : "Concluída"}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
