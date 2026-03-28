"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface AuditLog {
  id: string; user_name: string; action: string; entity_type: string;
  entity_name: string | null; details: Record<string, any>; created_at: string;
}

const actionConfig: Record<string, { label: string; cls: string }> = {
  created: { label: "Criou", cls: "bg-green-100 text-green-700" },
  updated: { label: "Atualizou", cls: "bg-blue-100 text-blue-700" },
  deleted: { label: "Excluiu", cls: "bg-red-100 text-red-700" },
  included: { label: "Incluiu", cls: "bg-emerald-100 text-emerald-700" },
  discarded: { label: "Descartou", cls: "bg-amber-100 text-amber-700" },
  restored: { label: "Restaurou", cls: "bg-purple-100 text-purple-700" },
};

const entityLabels: Record<string, string> = {
  obligation: "Obrigação", obligation_instance: "Obrigação", document: "Documento",
  training: "Treinamento", declaration: "Declaração", person: "Pessoa",
  category: "Categoria", user: "Usuário", extracted_obligation: "Obrigação extraída",
};

function formatDetails(d: Record<string, any>): string {
  if (!d || Object.keys(d).length === 0) return "—";
  if (d.field && d.from !== undefined && d.to !== undefined) return `${d.field}: ${d.from} → ${d.to}`;
  return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(", ");
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("30");

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), days: periodFilter });
    if (entityFilter !== "all") params.set("entity_type", entityFilter);
    const res = await fetch(`/api/audit?${params}`);
    const data = await res.json();
    setLogs(data.logs || []);
    setTotal(data.total || 0);
  }, [page, entityFilter, periodFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#033244" }}>Log de Auditoria</h1>
      <p className="text-sm text-gray-500 mb-6">Registro de todas as ações realizadas no sistema.</p>

      <div className="flex flex-wrap gap-3 mb-6">
        <select value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1); }} className="text-sm rounded-md border border-gray-200 px-3 py-2">
          <option value="all">Todas as entidades</option>
          <option value="obligation_instance">Obrigações</option>
          <option value="document">Documentos</option>
          <option value="extracted_obligation">Obr. extraídas</option>
          <option value="training">Treinamentos</option>
          <option value="declaration">Declarações</option>
          <option value="person">Pessoas</option>
          <option value="user">Usuários</option>
          <option value="category">Categorias</option>
        </select>
        <select value={periodFilter} onChange={e => { setPeriodFilter(e.target.value); setPage(1); }} className="text-sm rounded-md border border-gray-200 px-3 py-2">
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="all">Todo o histórico</option>
        </select>
        <span className="text-sm text-gray-400 self-center">{total} registro{total !== 1 ? "s" : ""}</span>
      </div>

      <Card className="bg-white rounded-xl shadow-sm border-gray-200 overflow-hidden">
        {logs.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-[10px] font-medium text-gray-500 uppercase px-6 py-3 w-[150px]">Data/Hora</th>
                <th className="text-left text-[10px] font-medium text-gray-500 uppercase px-4 py-3 w-[130px]">Usuário</th>
                <th className="text-left text-[10px] font-medium text-gray-500 uppercase px-4 py-3 w-[90px]">Ação</th>
                <th className="text-left text-[10px] font-medium text-gray-500 uppercase px-4 py-3">Entidade</th>
                <th className="text-left text-[10px] font-medium text-gray-500 uppercase px-4 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const ac = actionConfig[log.action] || { label: log.action, cls: "bg-gray-100 text-gray-700" };
                return (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-6 py-3 text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}{" "}
                      {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">{log.user_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ac.cls}`}>{ac.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-sm text-gray-800">{log.entity_name || "—"}</span>
                        <span className="text-[10px] text-gray-400 block">{entityLabels[log.entity_type] || log.entity_type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDetails(log.details)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={ScrollText} title="Nenhum registro encontrado" description="Não há atividades registradas para os filtros selecionados." />
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
