"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GraduationCap, Plus, AlertTriangle, Clock, CheckCircle2, Loader2, ChevronRight } from "lucide-react";

const PESSOAS_SUPERVISIONADAS = [
  { name: "Patrick Ledoux", role: "Sócio-Diretor" },
  { name: "Carlos Aguiar", role: "Sócio-Diretor" },
  { name: "Nelson Bechara", role: "Sócio-Diretor" },
  { name: "Tereza Cidade", role: "Diretora de Compliance" },
  { name: "Ricardo Kanitz", role: "Sócio-Diretor" },
  { name: "Eduardo Alcalay", role: "Sócio-Diretor" },
];

const categoryColors: Record<string, string> = {
  PLDFT: "#F59E0B", Compliance: "#1E7FA8", Interno: "#6B7280", "Código de Ética": "#6366F1",
};

interface TrainingType { id: string; name: string; description: string | null; category: string; frequency: string; required: boolean; }
interface TrainingRecord { id: string; training_type_id: string; participant_name: string; completed_at: string; expires_at: string | null; notes: string | null; }

function getParticipantStatus(records: TrainingRecord[], participantName: string, typeId: string) {
  const latest = records
    .filter((r) => r.participant_name === participantName && r.training_type_id === typeId)
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0];

  if (!latest) return { status: "nunca", label: "Nunca realizado", color: "#DC2626", bg: "#FEF2F2", record: null };

  if (!latest.expires_at) return { status: "ok", label: "Realizado", color: "#16A34A", bg: "#F0FDF4", record: latest };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expires = new Date(latest.expires_at + "T00:00:00");
  const daysUntil = Math.floor((expires.getTime() - today.getTime()) / 86400000);

  if (daysUntil < 0) return { status: "vencido", label: `Vencido há ${Math.abs(daysUntil)} dias`, color: "#DC2626", bg: "#FEF2F2", record: latest };
  if (daysUntil <= 30) return { status: "vencendo", label: `Vence em ${daysUntil} dias`, color: "#F59E0B", bg: "#FFFBEB", record: latest };
  return { status: "ok", label: "Em dia", color: "#16A34A", bg: "#F0FDF4", record: latest };
}

function getTypeStatus(records: TrainingRecord[], typeId: string) {
  const statuses = PESSOAS_SUPERVISIONADAS.map((p) => getParticipantStatus(records, p.name, typeId));
  const okCount = statuses.filter((s) => s.status === "ok").length;
  const hasVencido = statuses.some((s) => s.status === "vencido" || s.status === "nunca");
  const hasVencendo = statuses.some((s) => s.status === "vencendo");

  if (hasVencido) return { label: "Vencido", color: "#DC2626", bg: "#FEF2F2", okCount };
  if (hasVencendo) return { label: "Atenção", color: "#F59E0B", bg: "#FFFBEB", okCount };
  return { label: "Em dia", color: "#16A34A", bg: "#F0FDF4", okCount };
}

export default function TreinamentosPage() {
  const [types, setTypes] = useState<TrainingType[]>([]);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<TrainingType | null>(null);
  const [showNewType, setShowNewType] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [registerParticipant, setRegisterParticipant] = useState("");
  const [registerDate, setRegisterDate] = useState(new Date().toISOString().split("T")[0]);
  const [registerNotes, setRegisterNotes] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDesc, setNewTypeDesc] = useState("");
  const [newTypeCat, setNewTypeCat] = useState("Interno");
  const [newTypeFreq, setNewTypeFreq] = useState("anual");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    const [typesRes, recordsRes] = await Promise.all([
      fetch("/api/training/types"), fetch("/api/training/records"),
    ]);
    const { types: t } = await typesRes.json();
    const { records: r } = await recordsRes.json();
    setTypes(t || []); setRecords(r || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMessage(null);
    const res = await fetch("/api/training/types", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTypeName, description: newTypeDesc, category: newTypeCat, frequency: newTypeFreq }),
    });
    if (res.ok) {
      setMessage({ type: "success", text: `Treinamento "${newTypeName}" criado.` });
      setShowNewType(false); setNewTypeName(""); setNewTypeDesc(""); fetchData();
    } else { setMessage({ type: "error", text: "Erro ao criar treinamento." }); }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedType) return; setLoading(true); setMessage(null);
    const res = await fetch("/api/training/records", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ training_type_id: selectedType.id, participant_name: registerParticipant, completed_at: registerDate, notes: registerNotes }),
    });
    if (res.ok) {
      setMessage({ type: "success", text: `Treinamento registrado para ${registerParticipant}.` });
      setShowRegister(false); setRegisterNotes(""); fetchData();
    } else { setMessage({ type: "error", text: "Erro ao registrar." }); }
    setLoading(false);
  };

  // Summary
  const summaryData = types.map((t) => getTypeStatus(records, t.id));
  const emDia = summaryData.filter((s) => s.label === "Em dia").length;
  const vencendo = summaryData.filter((s) => s.label === "Atenção").length;
  const vencidos = summaryData.filter((s) => s.label === "Vencido").length;

  const summaryCards = [
    { label: "Treinamentos obrigatórios", value: types.length, icon: GraduationCap, color: "#0F334D", bg: "#EBF5FA" },
    { label: "Em dia", value: emDia, icon: CheckCircle2, color: "#16A34A", bg: "#F0FDF4" },
    { label: "Vencendo em 30 dias", value: vencendo, icon: Clock, color: "#F59E0B", bg: "#FFFBEB" },
    { label: "Vencidos", value: vencidos, icon: AlertTriangle, color: "#DC2626", bg: "#FEF2F2" },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#111827" }}>Treinamentos</h1>
          <p className="text-sm text-gray-500">Controle de treinamentos das Pessoas Supervisionadas</p>
        </div>
        <Button onClick={() => setShowNewType(true)} className="text-white" style={{ backgroundColor: "#0F334D" }}>
          <Plus className="w-4 h-4 mr-2" />Novo treinamento
        </Button>
      </div>

      {message && (
        <div className={`text-sm mb-4 p-3 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{message.text}</div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-6">
        {summaryCards.map((c) => (
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

      <Card className="bg-white rounded-xl shadow-sm border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3 w-8"></th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-3">Treinamento</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Categoria</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Frequência</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Pendências</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => {
              const ts = getTypeStatus(records, t.id);
              const pendingCount = PESSOAS_SUPERVISIONADAS.length - ts.okCount;
              const isExpanded = expandedId === t.id;
              return (
                <React.Fragment key={t.id}>
                  <tr
                    className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors"
                    onClick={() => { setExpandedId(isExpanded ? null : t.id); setSelectedType(t); }}
                  >
                    <td className="pl-6 py-4">
                      <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                    </td>
                    <td className="px-3 py-4">
                      <p className="text-sm font-medium text-gray-800">{t.name}</p>
                      {t.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{t.description}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="text-xs font-medium rounded-full" style={{ backgroundColor: (categoryColors[t.category] || "#6B7280") + "15", color: categoryColors[t.category] || "#6B7280" }}>{t.category}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 capitalize">{t.frequency}</td>
                    <td className="px-6 py-4">
                      {pendingCount === 0 ? (
                        <Badge variant="secondary" className="text-xs font-medium rounded-full" style={{ backgroundColor: "#F0FDF4", color: "#16A34A" }}>Todos em dia</Badge>
                      ) : pendingCount === PESSOAS_SUPERVISIONADAS.length ? (
                        <Badge variant="secondary" className="text-xs font-medium rounded-full" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>{pendingCount}/{PESSOAS_SUPERVISIONADAS.length} pendentes</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs font-medium rounded-full" style={{ backgroundColor: "#FFFBEB", color: "#F59E0B" }}>{pendingCount}/{PESSOAS_SUPERVISIONADAS.length} pendentes</Badge>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <div className="px-6 py-4" style={{ backgroundColor: "#F9FAFB" }}>
                          <table className="w-full">
                            <thead>
                              <tr>
                                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">Participante</th>
                                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">Último</th>
                                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">Validade</th>
                                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">Status</th>
                                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {PESSOAS_SUPERVISIONADAS.map((p) => {
                                const ps = getParticipantStatus(records, p.name, t.id);
                                const isOk = ps.status === "ok";
                                return (
                                  <tr key={p.name} className="border-t border-gray-100">
                                    <td className="py-3">
                                      <p className="text-sm font-medium text-gray-800">{p.name}</p>
                                      <p className="text-xs text-gray-400">{p.role}</p>
                                    </td>
                                    <td className="py-3 text-sm text-gray-500">
                                      {ps.record ? new Date(ps.record.completed_at + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                                    </td>
                                    <td className="py-3 text-sm text-gray-500">
                                      {ps.record?.expires_at ? new Date(ps.record.expires_at + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                                    </td>
                                    <td className="py-3">
                                      <Badge variant="secondary" className="text-xs font-medium rounded-full" style={{ backgroundColor: ps.bg, color: ps.color }}>{ps.label}</Badge>
                                    </td>
                                    <td className="py-3">
                                      <Button
                                        variant={isOk ? "ghost" : "outline"}
                                        size="sm"
                                        className={`text-xs ${!isOk ? "border-gray-300" : "text-gray-400"}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedType(t); setRegisterParticipant(p.name);
                                          setRegisterDate(new Date().toISOString().split("T")[0]);
                                          setRegisterNotes(""); setShowRegister(true);
                                        }}
                                      >
                                        Registrar
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {types.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">Nenhum treinamento cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Register Training Modal */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar treinamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRegister} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Participante</label>
              <Input value={registerParticipant} disabled />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Data de realização</label>
              <Input type="date" value={registerDate} onChange={(e) => setRegisterDate(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Notas</label>
              <textarea value={registerNotes} onChange={(e) => setRegisterNotes(e.target.value)} placeholder="Ex: Treinamento presencial sobre PLDFT" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm min-h-[60px] resize-none" />
            </div>
            <Button type="submit" disabled={loading} className="w-full text-white" style={{ backgroundColor: "#0F334D" }}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Training Type Modal */}
      <Dialog open={showNewType} onOpenChange={setShowNewType}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo tipo de treinamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateType} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nome</label>
              <Input value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="Nome do treinamento" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Descrição</label>
              <textarea value={newTypeDesc} onChange={(e) => setNewTypeDesc(e.target.value)} placeholder="Descrição (opcional)" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm min-h-[60px] resize-none" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Categoria</label>
                <select value={newTypeCat} onChange={(e) => setNewTypeCat(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm">
                  <option>PLDFT</option><option>Compliance</option><option>Interno</option><option>Código de Ética</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Frequência</label>
                <select value={newTypeFreq} onChange={(e) => setNewTypeFreq(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm">
                  <option value="anual">Anual</option><option value="semestral">Semestral</option><option value="trimestral">Trimestral</option><option value="pontual">Pontual</option>
                </select>
              </div>
            </div>
            <Button type="submit" disabled={loading || !newTypeName} className="w-full text-white" style={{ backgroundColor: "#0F334D" }}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando...</> : "Criar treinamento"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
