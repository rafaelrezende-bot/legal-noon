"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ObligationCard } from "@/components/obligation-card";
import { StatusBadge } from "@/components/status-badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Clock, AlertTriangle, CalendarClock, CheckCircle2, CalendarX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

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

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [yearInstances, setYearInstances] = useState<any[]>([]);
  const [monthInstances, setMonthInstances] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<any | null>(null);
  const isFirstRender = useRef(true);

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

  const fetchMonthData = useCallback(async (month: number) => {
    const start = `${currentYear}-${String(month + 1).padStart(2, "0")}-01`;
    const end = new Date(currentYear, month + 1, 0).toISOString().split("T")[0];
    const { data } = await supabase
      .from("obligation_instances")
      .select("*, obligation:obligations(*, category:categories(*))")
      .gte("due_date", start).lte("due_date", end).order("due_date");
    setMonthInstances(data || []);
  }, [currentYear]);

  useEffect(() => { fetchYearData(); }, [fetchYearData]);
  useEffect(() => { fetchMonthData(selectedMonth); }, [selectedMonth, fetchYearData]);

  // Scroll to obligations when month changes (skip first render)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    requestAnimationFrame(() => {
      document.getElementById("month-obligations")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedMonth]);

  // KPI totals
  const pendingCount = yearInstances.filter(i => i.status !== "concluida").length;
  const overdueCount = yearInstances.filter(i => i.status !== "concluida" && i.due_date < today).length;
  const next7Count = yearInstances.filter(i => i.status !== "concluida" && i.due_date >= today && i.due_date <= in7Days).length;
  const completedCount = yearInstances.filter(i => i.status === "concluida").length;

  // Group by month + category
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

  const handleMonthClick = (idx: number) => {
    setSelectedMonth(idx);
    setSelectedCategories([]);
    setSelectedStatuses([]);
  };

  // Month filters
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
    fetchMonthData(selectedMonth);
    fetchYearData();
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#033244" }}>
        {getGreeting()}{firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="text-sm text-gray-500 mb-6">Calendário de obrigações regulatórias — {currentYear}</p>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-between rounded-xl border border-gray-200 bg-white px-4 sm:px-6 py-3 sm:py-4 gap-3 sm:gap-0 mb-6">
        {[
          { icon: <Clock className="w-4 h-4 text-amber-500" />, value: pendingCount, label: "Pendentes", color: "text-amber-600" },
          { icon: <AlertTriangle className="w-4 h-4 text-red-500" />, value: overdueCount, label: "Atrasadas", color: "text-red-600" },
          { icon: <CalendarClock className="w-4 h-4 text-blue-500" />, value: next7Count, label: "Próx. 7 dias", color: "text-blue-600" },
          { icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, value: completedCount, label: "Concluídas", color: "text-green-600" },
        ].map((kpi, idx) => (
          <React.Fragment key={kpi.label}>
            {idx > 0 && <Separator orientation="vertical" className="hidden sm:block h-8" />}
            <div className="flex items-center gap-3">
              {kpi.icon}
              <div className="flex flex-col">
                <span className={`text-xl font-bold leading-none ${kpi.color}`}>{kpi.value}</span>
                <span className="text-xs text-gray-500 mt-0.5">{kpi.label}</span>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Year Grid — 6 columns */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
        {monthsData.map(md => {
          const isSelected = selectedMonth === md.monthIndex;
          const isCurrent = md.monthIndex === currentMonth;
          return (
            <div key={md.monthIndex} onClick={() => handleMonthClick(md.monthIndex)}
              className={`relative rounded-lg border bg-white p-3 cursor-pointer transition-all hover:shadow-sm ${
                isSelected ? "shadow-sm" : ""
              } ${!isSelected && isCurrent ? "border-opacity-40" : ""}`}
              style={{
                borderColor: isSelected ? "#D2BD80" : isCurrent ? "#025382" : undefined,
                borderWidth: isSelected || isCurrent ? "2px" : undefined,
                backgroundColor: isSelected ? "rgba(210,189,128,0.05)" : undefined,
              }}>
              {isCurrent && (
                <span className="absolute top-1.5 right-1.5 text-[9px] font-medium px-1 py-0.5 rounded" style={{ color: "#025382", backgroundColor: "rgba(2,83,130,0.1)" }}>Atual</span>
              )}
              <h3 className={`text-xs font-semibold mb-2 ${isSelected ? "" : "text-gray-700"}`} style={isSelected ? { color: "#D2BD80" } : {}}>{MONTHS[md.monthIndex]}</h3>
              <div className="flex flex-wrap gap-1">
                {md.dots.map((dot, i) =>
                  dot.count <= 5
                    ? Array.from({ length: dot.count }).map((_, j) => (
                        <span key={`${i}-${j}`} className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dot.color }} title={`${dot.categoryName}: ${dot.count}`} />
                      ))
                    : <span key={i} className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[8px] font-bold" style={{ backgroundColor: dot.color }} title={`${dot.categoryName}: ${dot.count}`}>{dot.count}</span>
                )}
                {md.dots.length === 0 && <span className="text-[10px] text-gray-300 italic">—</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-8 justify-center">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
            <span className="text-xs text-gray-500">{cat.name}</span>
          </div>
        ))}
      </div>

      {/* Month content */}
      <div id="month-obligations">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold" style={{ color: "#025382" }}>{MONTHS[selectedMonth]} {currentYear}</h2>
          <span className="text-sm text-gray-400">{monthInstances.length} obrigações</span>
        </div>

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

        {/* Obligations list with fade-in on month change */}
        <div key={selectedMonth} className="animate-[fadeIn_0.2s_ease-out]">
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
              <EmptyState icon={CalendarX} title="Nenhuma obrigação neste mês" description="Este mês não possui obrigações cadastradas no calendário." />
            )}
          </div>
        </div>
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
    </div>
  );
}
