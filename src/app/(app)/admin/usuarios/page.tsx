"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, RefreshCw, Plus, UserCheck, Users, Pencil } from "lucide-react";

interface InvitedUser {
  id: string;
  name: string;
  email: string;
  invited_at: string;
  accepted: boolean;
}

function getStatus(user: InvitedUser): "enviado" | "aceito" | "expirado" {
  if (user.accepted) return "aceito";
  const invitedAt = new Date(user.invited_at).getTime();
  const now = Date.now();
  if (now - invitedAt > 24 * 60 * 60 * 1000) return "expirado";
  return "enviado";
}

const statusConfig = {
  enviado: { label: "Convite enviado", className: "bg-amber-50 text-amber-600 hover:bg-amber-50" },
  aceito: { label: "Convite aceito", className: "bg-green-50 text-green-600 hover:bg-green-50" },
  expirado: { label: "Convite expirado", className: "bg-red-50 text-red-600 hover:bg-red-50" },
};

export default function UsuariosPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [reinviting, setReinviting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [users, setUsers] = useState<InvitedUser[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "persons">("users");
  // Supervised persons state
  const [persons, setPersons] = useState<any[]>([]);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showEditPerson, setShowEditPerson] = useState(false);
  const [editPerson, setEditPerson] = useState<any>(null);
  const [personName, setPersonName] = useState("");
  const [personRole, setPersonRole] = useState("");
  const [personEmail, setPersonEmail] = useState("");

  const supabase = createClient();

  const fetchUsers = useCallback(async () => {
    const { data: invitedUsers } = await supabase
      .from("invited_users")
      .select("*")
      .order("invited_at", { ascending: false });

    if (!invitedUsers) { setUsers([]); return; }

    // Check which emails have been confirmed in auth (via a simple check)
    // We'll check by trying to see if the user exists with confirmed email
    // For PoC, we check against a list endpoint or just mark based on local state
    const enriched = invitedUsers.map((u: any) => ({
      ...u,
      accepted: false, // Will be updated below
    }));

    // Try to get auth users list via API (service role needed, so we do it client-side with a workaround)
    // For now, we'll just show based on invited_users data
    setUsers(enriched);
  }, []);

  const fetchPersons = useCallback(async () => {
    const res = await fetch("/api/supervised-persons?all=true");
    const { persons: p } = await res.json();
    setPersons(p || []);
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchPersons();
  }, [fetchUsers, fetchPersons]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Erro ao enviar convite." });
      } else {
        setMessage({ type: "success", text: `Convite enviado para ${email}` });
        setName("");
        setEmail("");
        fetchUsers();
      }
    } catch {
      setMessage({ type: "error", text: "Erro de conexão." });
    } finally {
      setLoading(false);
    }
  };

  const handleReinvite = async (userEmail: string) => {
    setReinviting(userEmail);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/reinvite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Erro ao reenviar convite." });
      } else {
        setMessage({ type: "success", text: `Convite reenviado para ${userEmail}` });
        fetchUsers();
      }
    } catch {
      setMessage({ type: "error", text: "Erro de conexão." });
    } finally {
      setReinviting(null);
    }
  };

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMessage(null);
    const res = await fetch("/api/supervised-persons", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: personName, role: personRole, email: personEmail }),
    });
    if (res.ok) {
      setMessage({ type: "success", text: `${personName} adicionado(a).` });
      setShowAddPerson(false); setPersonName(""); setPersonRole(""); setPersonEmail(""); fetchPersons();
    } else { setMessage({ type: "error", text: "Erro ao adicionar." }); }
    setLoading(false);
  };

  const handleEditPerson = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editPerson) return; setLoading(true); setMessage(null);
    const res = await fetch("/api/supervised-persons", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editPerson.id, name: personName, role: personRole, email: personEmail }),
    });
    if (res.ok) {
      setMessage({ type: "success", text: "Dados atualizados." });
      setShowEditPerson(false); fetchPersons();
    } else { setMessage({ type: "error", text: "Erro ao atualizar." }); }
    setLoading(false);
  };

  const handleToggleActive = async (person: any) => {
    const newActive = !person.active;
    const action = newActive ? "reativar" : "desativar";
    if (!newActive && !confirm(`Ao desativar, ${person.name} não aparecerá em novos treinamentos ou períodos de declaração. O histórico será preservado. Continuar?`)) return;
    const res = await fetch("/api/supervised-persons", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: person.id, active: newActive }),
    });
    if (res.ok) {
      setMessage({ type: "success", text: `${person.name} ${newActive ? "reativado(a)" : "desativado(a)"}.` });
      fetchPersons();
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#111827" }}>
        Usuários e Pessoas
      </h1>
      <p className="text-sm text-gray-500 mb-4">
        Gerencie acessos ao sistema e cadastro de Pessoas Supervisionadas.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button onClick={() => setActiveTab("users")} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "users" ? "border-[#0F334D] text-[#0F334D]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <Users className="w-4 h-4" />Usuários do sistema
        </button>
        <button onClick={() => setActiveTab("persons")} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "persons" ? "border-[#0F334D] text-[#0F334D]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <UserCheck className="w-4 h-4" />Pessoas Supervisionadas
        </button>
      </div>

      {activeTab === "users" && (<>
      {/* Invite form */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-gray-200 mb-8">
        <h2 className="text-base font-semibold mb-4" style={{ color: "#0F334D" }}>
          Enviar convite
        </h2>
        <form onSubmit={handleInvite}>
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nome completo</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do usuário"
                required
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                required
              />
            </div>
          </div>
          {message && (
            <p className={`text-sm mb-3 ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="text-white"
            style={{ backgroundColor: "#0F334D" }}
          >
            {loading ? (
              "Enviando..."
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar convite
              </>
            )}
          </Button>
        </form>
      </Card>

      {/* Users table */}
      <Card className="bg-white rounded-xl shadow-sm border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold" style={{ color: "#0F334D" }}>
            Usuários convidados
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Email</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Convidado em</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const status = getStatus(user);
                const config = statusConfig[status];
                return (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{user.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className={`${config.className} text-xs font-medium rounded-full`}>
                        {config.label}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(user.invited_at).toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      {status === "aceito" ? (
                        <span className="text-xs text-green-600 font-medium">Ativo</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReinvite(user.email)}
                          disabled={reinviting === user.email}
                          className="text-xs"
                        >
                          {reinviting === user.email ? (
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Reenviar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                    Nenhum usuário convidado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      </>)}

      {activeTab === "persons" && (<>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">Sócios-diretores e profissionais supervisionados pela área de compliance.</p>
          <Button onClick={() => { setPersonName(""); setPersonRole(""); setPersonEmail(""); setShowAddPerson(true); }} className="text-white" style={{ backgroundColor: "#0F334D" }}>
            <Plus className="w-4 h-4 mr-2" />Adicionar pessoa
          </Button>
        </div>

        <Card className="bg-white rounded-xl shadow-sm border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Cargo</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Email</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {persons.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{p.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.role || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.email || "—"}</td>
                  <td className="px-6 py-4">
                    <Badge variant="secondary" className="text-xs font-medium rounded-full" style={{ backgroundColor: p.active ? "#F0FDF4" : "#F3F4F6", color: p.active ? "#16A34A" : "#6B7280" }}>
                      {p.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditPerson(p); setPersonName(p.name); setPersonRole(p.role || ""); setPersonEmail(p.email || ""); setShowEditPerson(true); }} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                        <Pencil className="w-3.5 h-3.5" />Editar
                      </button>
                      <button onClick={() => handleToggleActive(p)} className={`text-xs flex items-center gap-1 ${p.active ? "text-gray-500 hover:text-red-600" : "text-blue-500 hover:text-blue-700"}`}>
                        {p.active ? "Desativar" : "Reativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {persons.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">Nenhuma pessoa cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* Add Person Modal */}
        <Dialog open={showAddPerson} onOpenChange={setShowAddPerson}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Adicionar pessoa</DialogTitle></DialogHeader>
            <form onSubmit={handleAddPerson} className="space-y-4 mt-2">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome completo</label>
                <Input value={personName} onChange={(e) => setPersonName(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Cargo / função</label>
                <Input value={personRole} onChange={(e) => setPersonRole(e.target.value)} placeholder="Ex: Sócio-Diretor" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                <Input type="email" value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} placeholder="Opcional" />
              </div>
              <Button type="submit" disabled={loading || !personName} className="w-full text-white" style={{ backgroundColor: "#0F334D" }}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Person Modal */}
        <Dialog open={showEditPerson} onOpenChange={setShowEditPerson}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Editar pessoa</DialogTitle></DialogHeader>
            <form onSubmit={handleEditPerson} className="space-y-4 mt-2">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome completo</label>
                <Input value={personName} onChange={(e) => setPersonName(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Cargo / função</label>
                <Input value={personRole} onChange={(e) => setPersonRole(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                <Input type="email" value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading || !personName} className="w-full text-white" style={{ backgroundColor: "#0F334D" }}>
                {loading ? "Salvando..." : "Salvar alterações"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </>)}
    </div>
  );
}
