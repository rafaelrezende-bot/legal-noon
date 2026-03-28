"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Briefcase, Plus, CheckCircle2, AlertTriangle, MinusCircle, Loader2, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface Period {
  id: string; type: string; reference_label: string; due_date: string; year: number; quarter: number | null;
  declarations: Declaration[];
}
interface Declaration {
  id: string; participant_name: string; status: string; submitted_at: string | null; notes: string | null;
}
interface Item {
  item_type: string; security_name: string; security_type?: string; ticker?: string;
  quantity?: number; principal_value?: number; broker_name?: string;
  operation_type?: string; operation_date?: string; operation_price?: number;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pendente: { label: "Pendente", color: "#DC2626", bg: "#FEF2F2" },
  entregue: { label: "Entregue", color: "#16A34A", bg: "#F0FDF4" },
  nada_a_declarar: { label: "Nada a declarar", color: "#6B7280", bg: "#F3F4F6" },
};

export default function InvestimentosPessoaisPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [showNewPeriod, setShowNewPeriod] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [selectedDeclaration, setSelectedDeclaration] = useState<Declaration | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [declarationType, setDeclarationType] = useState<"entregue" | "nada_a_declarar">("entregue");
  const [items, setItems] = useState<Item[]>([]);
  const [registerNotes, setRegisterNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // New period form
  const [npType, setNpType] = useState("anual");
  const [npLabel, setNpLabel] = useState("");
  const [npDate, setNpDate] = useState("");
  const [npYear, setNpYear] = useState(new Date().getFullYear());
  const [npQuarter, setNpQuarter] = useState(1);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/declarations/periods");
    const { periods: p } = await res.json();
    setPeriods(p || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const currentPeriod = periods[0];

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const res = await fetch("/api/declarations/periods", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: npType, reference_label: npLabel, due_date: npDate, year: npYear, quarter: npType === "trimestral" ? npQuarter : null }),
    });
    if (res.ok) {
      setMessage({ type: "success", text: "Período criado." }); setShowNewPeriod(false); fetchData();
    } else { setMessage({ type: "error", text: "Erro ao criar período." }); }
    setLoading(false);
  };

  const openRegister = (decl: Declaration, period: Period) => {
    setSelectedDeclaration(decl); setSelectedPeriod(period);
    setDeclarationType("entregue"); setItems([]); setRegisterNotes(""); setShowRegister(true);
  };

  const addItem = () => {
    const itemType = selectedPeriod?.type === "trimestral" ? "operacao" : "posicao";
    setItems([...items, { item_type: itemType, security_name: "", security_type: "", ticker: "", quantity: undefined, principal_value: undefined, broker_name: "", operation_type: "", operation_date: "", operation_price: undefined }]);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!selectedDeclaration) return; setLoading(true);
    const validItems = declarationType === "entregue" ? items.filter((i) => i.security_name) : [];
    const res = await fetch("/api/declarations/submit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ declaration_id: selectedDeclaration.id, status: declarationType, items: validItems, notes: registerNotes }),
    });
    if (res.ok) {
      setMessage({ type: "success", text: `Declaração registrada para ${selectedDeclaration.participant_name}.` });
      setShowRegister(false); fetchData();
    } else { setMessage({ type: "error", text: "Erro ao registrar." }); }
    setLoading(false);
  };

  // Summary
  const currentDecls = currentPeriod?.declarations || [];
  const entregues = currentDecls.filter((d) => d.status === "entregue").length;
  const pendentes = currentDecls.filter((d) => d.status === "pendente").length;
  const nadaDeclarar = currentDecls.filter((d) => d.status === "nada_a_declarar").length;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#033244" }}>Investimentos Pessoais</h1>
          <p className="text-sm text-gray-500">Declarações de valores mobiliários das Pessoas Supervisionadas</p>
        </div>
        <Button onClick={() => setShowNewPeriod(true)} className="text-white" style={{ backgroundColor: "#025382" }}>
          <Plus className="w-4 h-4 mr-2" />Novo período
        </Button>
      </div>

      {message && (
        <div className={`text-sm mb-4 p-3 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{message.text}</div>
      )}

      {/* Summary cards */}
      {currentPeriod && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-5 bg-white rounded-xl shadow-sm border-gray-200 col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#F2F2F2" }}>
                <Briefcase className="w-5 h-5" style={{ color: "#025382" }} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Período atual</p>
                <p className="text-sm font-bold" style={{ color: "#025382" }}>{currentPeriod.reference_label}</p>
                <p className="text-xs text-gray-400">Prazo: {new Date(currentPeriod.due_date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
              </div>
            </div>
          </Card>
          {[
            { label: "Entregues", value: entregues, icon: CheckCircle2, color: "#16A34A", bg: "#F0FDF4" },
            { label: "Pendentes", value: pendentes, icon: AlertTriangle, color: "#DC2626", bg: "#FEF2F2" },
            { label: "Nada a declarar", value: nadaDeclarar, icon: MinusCircle, color: "#6B7280", bg: "#F3F4F6" },
          ].map((c) => (
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
      )}

      {!currentPeriod && (
        <EmptyState icon={Briefcase} title="Nenhum período de declaração" description="Crie um período de declaração para começar a receber os relatórios de investimentos pessoais." actionLabel="Criar Período" onAction={() => setShowNewPeriod(true)} />
      )}

      {/* Current period table */}
      {currentPeriod && (
        <Card className="bg-white rounded-xl shadow-sm border-gray-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold" style={{ color: "#025382" }}>{currentPeriod.reference_label}</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Participante</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Entregue em</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {currentDecls.map((d) => {
                const sc = statusConfig[d.status];
                return (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{d.participant_name}</td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="text-xs font-medium rounded-full" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {d.submitted_at ? new Date(d.submitted_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-6 py-4">
                      {d.status === "pendente" ? (
                        <Button variant="outline" size="sm" className="text-xs" onClick={() => openRegister(d, currentPeriod)}>Registrar</Button>
                      ) : (
                        <span className="text-xs text-gray-400">{d.notes || ""}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* History */}
      {periods.length > 1 && (
        <Card className="bg-white rounded-xl shadow-sm border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold" style={{ color: "#025382" }}>Histórico de períodos</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Período</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Tipo</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Prazo</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Entregues</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {periods.slice(1).map((p) => {
                const totalDecls = p.declarations.length;
                const delivered = p.declarations.filter((d) => d.status !== "pendente").length;
                const complete = delivered === totalDecls;
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-800">{p.reference_label}</td>
                    <td className="px-6 py-3 text-sm text-gray-500 capitalize">{p.type}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{new Date(p.due_date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-800">{delivered}/{totalDecls}</td>
                    <td className="px-6 py-3">
                      <Badge variant="secondary" className="text-xs font-medium rounded-full" style={{ backgroundColor: complete ? "#F0FDF4" : "#FEF2F2", color: complete ? "#16A34A" : "#DC2626" }}>
                        {complete ? "Completo" : "Incompleto"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* New Period Modal */}
      <Dialog open={showNewPeriod} onOpenChange={setShowNewPeriod}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo período de declaração</DialogTitle></DialogHeader>
          <form onSubmit={handleCreatePeriod} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Tipo</label>
              <select value={npType} onChange={(e) => setNpType(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm">
                <option value="anual">Anual</option><option value="trimestral">Trimestral</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Referência</label>
              <Input value={npLabel} onChange={(e) => setNpLabel(e.target.value)} placeholder="Ex: Relatório Anual 2026" required />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Ano</label>
                <Input type="number" value={npYear} onChange={(e) => setNpYear(Number(e.target.value))} required />
              </div>
              {npType === "trimestral" && (
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Trimestre</label>
                  <select value={npQuarter} onChange={(e) => setNpQuarter(Number(e.target.value))} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm">
                    <option value={1}>Q1</option><option value={2}>Q2</option><option value={3}>Q3</option><option value={4}>Q4</option>
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Prazo de entrega</label>
              <Input type="date" value={npDate} onChange={(e) => setNpDate(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading} className="w-full text-white" style={{ backgroundColor: "#025382" }}>
              {loading ? "Criando..." : "Criar período"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Register Declaration Modal */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {selectedDeclaration && (
            <>
              <DialogHeader>
                <DialogTitle>Declaração — {selectedDeclaration.participant_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex gap-3">
                  <label className={`flex-1 p-3 rounded-lg border cursor-pointer text-center text-sm ${declarationType === "entregue" ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}>
                    <input type="radio" name="dtype" className="sr-only" checked={declarationType === "entregue"} onChange={() => setDeclarationType("entregue")} />
                    Tenho itens a declarar
                  </label>
                  <label className={`flex-1 p-3 rounded-lg border cursor-pointer text-center text-sm ${declarationType === "nada_a_declarar" ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}>
                    <input type="radio" name="dtype" className="sr-only" checked={declarationType === "nada_a_declarar"} onChange={() => setDeclarationType("nada_a_declarar")} />
                    Nada a declarar
                  </label>
                </div>

                {declarationType === "entregue" && (
                  <div className="space-y-3">
                    {items.map((item, idx) => (
                      <div key={idx} className="p-3 border border-gray-200 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500">Item {idx + 1}</span>
                          <button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Nome do ativo" value={item.security_name} onChange={(e) => updateItem(idx, "security_name", e.target.value)} className="text-sm" />
                          <select value={item.security_type || ""} onChange={(e) => updateItem(idx, "security_type", e.target.value)} className="rounded-md border border-gray-200 px-2 py-1.5 text-sm">
                            <option value="">Tipo</option><option>Ação</option><option>Fundo</option><option>Debênture</option><option>CRI/CRA</option><option>Investimento Privado</option><option>Outro</option>
                          </select>
                          <Input placeholder="Ticker" value={item.ticker || ""} onChange={(e) => updateItem(idx, "ticker", e.target.value)} className="text-sm" />
                          <Input type="number" placeholder="Quantidade" value={item.quantity || ""} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} className="text-sm" />
                          <Input type="number" placeholder="Valor (R$)" value={item.principal_value || ""} onChange={(e) => updateItem(idx, "principal_value", Number(e.target.value))} className="text-sm" />
                          <Input placeholder="Corretora / Banco" value={item.broker_name || ""} onChange={(e) => updateItem(idx, "broker_name", e.target.value)} className="text-sm" />
                        </div>
                        {selectedPeriod?.type === "trimestral" && (
                          <div className="grid grid-cols-2 gap-2">
                            <select value={item.operation_type || ""} onChange={(e) => updateItem(idx, "operation_type", e.target.value)} className="rounded-md border border-gray-200 px-2 py-1.5 text-sm">
                              <option value="">Tipo operação</option><option>Compra</option><option>Venda</option><option>Subscrição</option><option>Doação</option><option>Outro</option>
                            </select>
                            <Input type="date" value={item.operation_date || ""} onChange={(e) => updateItem(idx, "operation_date", e.target.value)} className="text-sm" />
                          </div>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={addItem}>
                      <Plus className="w-3.5 h-3.5 mr-1" />{selectedPeriod?.type === "trimestral" ? "Adicionar operação" : "Adicionar posição"}
                    </Button>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Notas</label>
                  <textarea value={registerNotes} onChange={(e) => setRegisterNotes(e.target.value)} placeholder="Observações (opcional)" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm min-h-[50px] resize-none" />
                </div>

                <Button onClick={handleSubmit} disabled={loading} className="w-full text-white" style={{ backgroundColor: "#025382" }}>
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Salvar declaração"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
