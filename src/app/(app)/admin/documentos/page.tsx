"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Upload, Download, Trash2, Sparkles, X, Loader2 } from "lucide-react";

interface PolicyDocument {
  id: string;
  name: string;
  filename: string;
  category: string;
  pages: number;
  storage_path: string | null;
  created_at: string;
}

interface Suggestion {
  name: string;
  description: string;
  deadline_description?: string;
  frequency: string;
  category: string;
  regulatory_basis?: string;
  responsible?: string;
  selected: boolean;
}

const categoryColors: Record<string, string> = {
  CVM: "#1E7FA8",
  ANBIMA: "#6366F1",
  PLDFT: "#F59E0B",
  Interno: "#6B7280",
};

export default function DocumentosPage() {
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Interno");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [analysisDocName, setAnalysisDocName] = useState("");
  const [addingObligations, setAddingObligations] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchDocuments = useCallback(async () => {
    const res = await fetch("/api/documents");
    const { documents: docs } = await res.json();
    setDocuments(docs || []);
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadName) return;
    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("name", uploadName);
    formData.append("category", uploadCategory);

    try {
      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Erro no upload." });
      } else {
        setMessage({ type: "success", text: `Documento "${uploadName}" enviado com sucesso.` });
        setShowUpload(false);
        setUploadName("");
        setUploadFile(null);
        setUploadCategory("Interno");
        fetchDocuments();
      }
    } catch {
      setMessage({ type: "error", text: "Erro de conexão." });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"?`)) return;

    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMessage({ type: "success", text: `"${name}" excluído.` });
      fetchDocuments();
    } else {
      setMessage({ type: "error", text: "Erro ao excluir." });
    }
  };

  const handleAnalyze = async (id: string, name: string) => {
    setAnalyzing(id);
    setMessage(null);

    try {
      const res = await fetch(`/api/documents/${id}/analyze`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Erro na análise." });
      } else {
        setSuggestions((data.suggestions || []).map((s: any) => ({ ...s, selected: true })));
        setAnalysisDocName(name);
        setShowAnalysis(true);
      }
    } catch {
      setMessage({ type: "error", text: "Erro de conexão." });
    } finally {
      setAnalyzing(null);
    }
  };

  const handleAddObligations = async () => {
    setAddingObligations(true);
    const selected = suggestions.filter((s) => s.selected);

    try {
      for (const s of selected) {
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Crie a seguinte obrigação no calendário: título "${s.name}", descrição "${s.description}", categoria "${s.category.toLowerCase()}", frequência "${s.frequency}", base legal "${s.regulatory_basis || ""}"`,
            history: [],
          }),
        });
      }
      setMessage({ type: "success", text: `${selected.length} obrigação(ões) adicionada(s) ao calendário.` });
      setShowAnalysis(false);
      setSuggestions([]);
    } catch {
      setMessage({ type: "error", text: "Erro ao adicionar obrigações." });
    } finally {
      setAddingObligations(false);
    }
  };

  const toggleSuggestion = (index: number) => {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s))
    );
  };

  const freqLabels: Record<string, string> = {
    anual: "Anual", semestral: "Semestral", trimestral: "Trimestral", mensal: "Mensal", pontual: "Pontual",
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#111827" }}>Documentos</h1>
          <p className="text-sm text-gray-500">Políticas e regulamentos da Noon Capital</p>
        </div>
        <Button onClick={() => setShowUpload(true)} className="text-white" style={{ backgroundColor: "#0F334D" }}>
          <Upload className="w-4 h-4 mr-2" />
          Novo documento
        </Button>
      </div>

      {message && (
        <div className={`text-sm mb-4 p-3 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      )}

      <Card className="bg-white rounded-xl shadow-sm border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Categoria</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Páginas</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Enviado em</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-800">{doc.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant="secondary"
                      className="text-xs font-medium rounded-full"
                      style={{
                        backgroundColor: (categoryColors[doc.category] || "#6B7280") + "15",
                        color: categoryColors[doc.category] || "#6B7280",
                      }}
                    >
                      {doc.category}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{doc.pages}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString("pt-BR", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {doc.storage_path && (
                        <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleAnalyze(doc.id, doc.name)}
                        disabled={analyzing === doc.id}
                        className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-400 hover:text-purple-600 disabled:opacity-50"
                      >
                        {analyzing === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id, doc.name)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">
                    Nenhum documento cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Upload Modal */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo documento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nome do documento</label>
              <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Ex: Manual de Compliance" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Categoria</label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="Interno">Interno</option>
                <option value="CVM">CVM</option>
                <option value="ANBIMA">ANBIMA</option>
                <option value="PLDFT">PLDFT</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Arquivo PDF</label>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                {uploadFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText className="w-4 h-4" />
                      <span>{uploadFile.name}</span>
                      <span className="text-gray-400">({(uploadFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                    </div>
                    <button type="button" onClick={() => setUploadFile(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Clique para selecionar ou arraste um PDF</p>
                    <p className="text-xs text-gray-400 mt-1">Máximo 10MB</p>
                    <input type="file" accept=".pdf" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
                  </label>
                )}
              </div>
            </div>
            <Button type="submit" disabled={uploading || !uploadFile || !uploadName} className="w-full text-white" style={{ backgroundColor: "#0F334D" }}>
              {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</> : "Enviar documento"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Analysis Results Modal */}
      <Dialog open={showAnalysis} onOpenChange={setShowAnalysis}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Obrigações encontradas em "{analysisDocName}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {suggestions.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">Nenhuma obrigação identificada.</p>
            )}
            {suggestions.map((s, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  s.selected ? "border-blue-200 bg-blue-50/50" : "border-gray-100 bg-white opacity-60"
                }`}
                onClick={() => toggleSuggestion(i)}
              >
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={s.selected} readOnly className="mt-1 rounded" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-800">{s.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{s.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] rounded-full" style={{
                        backgroundColor: (categoryColors[s.category] || "#6B7280") + "15",
                        color: categoryColors[s.category] || "#6B7280",
                      }}>
                        {s.category}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] rounded-full bg-gray-100 text-gray-600">
                        {freqLabels[s.frequency] || s.frequency}
                      </Badge>
                      {s.regulatory_basis && (
                        <span className="text-[10px] text-gray-400">{s.regulatory_basis}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {suggestions.length > 0 && (
            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
              <Button
                onClick={handleAddObligations}
                disabled={addingObligations || suggestions.filter((s) => s.selected).length === 0}
                className="text-white"
                style={{ backgroundColor: "#0F334D" }}
              >
                {addingObligations ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adicionando...</> : `Adicionar ${suggestions.filter((s) => s.selected).length} ao calendário`}
              </Button>
              <Button variant="outline" onClick={() => setShowAnalysis(false)}>Descartar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
