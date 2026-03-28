"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText, Upload, Download, Trash2, Sparkles, X, Loader2,
  ClipboardCheck, AlertTriangle, Clock, CheckCircle2,
  ChevronRight, Check, XCircle, RotateCcw, Settings, Plus,
} from "lucide-react";

interface Category { id: string; name: string; slug: string; color: string; }
interface ExtractedObligation {
  id: string; title: string; description: string | null; suggested_category: string | null;
  frequency: string | null; deadline_day: number | null; deadline_month: number | null;
  legal_basis: string | null; obligation_type: string; status: string;
}
interface PolicyDocument {
  id: string; name: string; filename: string; category_id: string | null; pages: number;
  storage_path: string | null; last_reviewed_at: string | null; rag_status: string | null;
  extraction_status: string | null; created_at: string;
  category: Category | null;
  obligations_pending: number; obligations_included: number; obligations_discarded: number;
}

function getReviewStatus(d: string | null) {
  if (!d) return { label: "Nunca revisado", color: "#3B82F6", bg: "#EFF6FF" };
  const months = Math.floor((Date.now() - new Date(d).getTime()) / (30 * 86400000));
  if (months >= 12) return { label: `Atrasada ${Math.floor(months/12)}+ anos`, color: "#DC2626", bg: "#FEF2F2" };
  if (months >= 10) return { label: "Revisão próxima", color: "#F59E0B", bg: "#FFFBEB" };
  return { label: "Em dia", color: "#16A34A", bg: "#F0FDF4" };
}

type SortOption = "name_asc" | "name_desc" | "upload_desc" | "upload_asc" | "review_oldest";

export default function DocumentosPage() {
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("name_asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [extractedObs, setExtractedObs] = useState<Record<string, ExtractedObligation[]>>({});

  // Upload
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategoryId, setUploadCategoryId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Review
  const [showReview, setShowReview] = useState(false);
  const [reviewDoc, setReviewDoc] = useState<PolicyDocument | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewUpdated, setReviewUpdated] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewHistory, setReviewHistory] = useState<any[]>([]);

  // Categories modal
  const [showCategories, setShowCategories] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#025382");

  // Include obligation
  const [includingId, setIncludingId] = useState<string | null>(null);
  const [includeDueDate, setIncludeDueDate] = useState("");
  const [includeCategoryId, setIncludeCategoryId] = useState("");

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    const res = await fetch("/api/documents");
    const { documents: docs } = await res.json();
    setDocuments(docs || []);
  }, []);

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    const { categories: cats } = await res.json();
    setCategories(cats || []);
    if (cats?.length > 0 && !uploadCategoryId) setUploadCategoryId(cats[0].id);
  }, []);

  const fetchExtractedObs = useCallback(async (docId: string) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const res = await fetch(`${supabaseUrl}/rest/v1/extracted_obligations?document_id=eq.${docId}&order=created_at.asc`, {
      headers: { apikey: supabaseKey!, Authorization: `Bearer ${supabaseKey!}` },
    });
    const data = await res.json();
    setExtractedObs(prev => ({ ...prev, [docId]: data || [] }));
  }, []);

  useEffect(() => { fetchDocuments(); fetchCategories(); }, [fetchDocuments, fetchCategories]);

  // Filtered and sorted
  const filtered = documents.filter(d => {
    if (selectedCategories.length === 0) return true;
    return d.category?.id && selectedCategories.includes(d.category.id);
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "name_asc": return a.name.localeCompare(b.name);
      case "name_desc": return b.name.localeCompare(a.name);
      case "upload_desc": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "upload_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "review_oldest": {
        const aDate = a.last_reviewed_at ? new Date(a.last_reviewed_at).getTime() : 0;
        const bDate = b.last_reviewed_at ? new Date(b.last_reviewed_at).getTime() : 0;
        return aDate - bDate;
      }
      default: return 0;
    }
  });

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadName) return;
    setUploading(true); setMessage(null);
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("name", uploadName);
    formData.append("category", categories.find(c => c.id === uploadCategoryId)?.name || "Interno");
    try {
      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      if (!res.ok) { const d = await res.json(); setMessage({ type: "error", text: d.error }); setUploading(false); return; }
      const { document: doc } = await res.json();
      // Update category_id
      if (uploadCategoryId) {
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/policy_documents?id=eq.${doc.id}`, {
          method: "PATCH",
          headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ category_id: uploadCategoryId }),
        });
      }
      setShowUpload(false); setUploadName(""); setUploadFile(null);
      setMessage({ type: "success", text: `"${uploadName}" enviado. Analisando obrigações...` });
      fetchDocuments();
      // Auto-extract obligations
      setExtractingId(doc.id);
      const extRes = await fetch("/api/documents/extract-obligations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });
      setExtractingId(null);
      fetchDocuments();
      if (extRes.ok) {
        const { obligations } = await extRes.json();
        if (obligations?.length > 0) {
          setExpandedId(doc.id);
          fetchExtractedObs(doc.id);
        }
      }
    } catch { setMessage({ type: "error", text: "Erro no upload." }); }
    finally { setUploading(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"?`)) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) { setMessage({ type: "success", text: `"${name}" excluído.` }); fetchDocuments(); }
  };

  const handleReanalyze = async (docId: string) => {
    setExtractingId(docId); setMessage(null);
    await fetch("/api/documents/reanalyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: docId }) });
    const res = await fetch("/api/documents/extract-obligations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: docId }) });
    setExtractingId(null);
    fetchDocuments();
    if (res.ok) { fetchExtractedObs(docId); setExpandedId(docId); }
  };

  const handleInclude = async (eoId: string) => {
    if (!includeDueDate) { setMessage({ type: "error", text: "Data de entrega é obrigatória." }); return; }
    setLoading(true);
    const res = await fetch("/api/documents/include-obligation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extracted_obligation_id: eoId, due_date: includeDueDate, category_id: includeCategoryId || null }),
    });
    if (res.ok) {
      setIncludingId(null); setIncludeDueDate("");
      if (expandedId) fetchExtractedObs(expandedId);
      fetchDocuments();
      setMessage({ type: "success", text: "Obrigação incluída no calendário." });
    } else { setMessage({ type: "error", text: "Erro ao incluir." }); }
    setLoading(false);
  };

  const handleDiscard = async (eoId: string) => {
    await fetch("/api/documents/discard-obligation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extracted_obligation_id: eoId }),
    });
    if (expandedId) fetchExtractedObs(expandedId);
    fetchDocuments();
  };

  const openReviewModal = async (doc: PolicyDocument) => {
    setReviewDoc(doc); setReviewNotes(""); setReviewUpdated(false); setShowReview(true);
    const res = await fetch(`/api/documents/${doc.id}/review`);
    const { reviews } = await res.json();
    setReviewHistory(reviews || []);
  };

  const handleReview = async () => {
    if (!reviewDoc) return; setSubmittingReview(true);
    const res = await fetch(`/api/documents/${reviewDoc.id}/review`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: reviewNotes, document_updated: reviewUpdated }),
    });
    if (res.ok) { setMessage({ type: "success", text: "Revisão registrada." }); setShowReview(false); fetchDocuments(); }
    setSubmittingReview(false);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const res = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCatName, color: newCatColor }) });
    if (res.ok) { setNewCatName(""); fetchCategories(); setMessage({ type: "success", text: "Categoria criada." }); }
    setLoading(false);
  };

  const handleExpandDoc = (docId: string) => {
    if (expandedId === docId) { setExpandedId(null); return; }
    setExpandedId(docId);
    if (!extractedObs[docId]) fetchExtractedObs(docId);
  };

  // Summary
  const reviewStatuses = documents.map(d => getReviewStatus(d.last_reviewed_at));
  const summaryCards = [
    { label: "Total de políticas", value: documents.length, icon: FileText, color: "#025382", bg: "#F2F2F2" },
    { label: "Revisão atrasada", value: reviewStatuses.filter(s => s.color === "#DC2626").length, icon: AlertTriangle, color: "#DC2626", bg: "#FEF2F2" },
    { label: "Revisão próxima", value: reviewStatuses.filter(s => s.color === "#F59E0B").length, icon: Clock, color: "#F59E0B", bg: "#FFFBEB" },
    { label: "Em dia", value: reviewStatuses.filter(s => s.color === "#16A34A").length, icon: CheckCircle2, color: "#16A34A", bg: "#F0FDF4" },
  ];

  const COLORS_PALETTE = ["#025382", "#6366F1", "#F59E0B", "#6B7280", "#DC2626", "#16A34A", "#D2BD80", "#007289", "#008FD0"];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#033244" }}>Documentos ({sorted.length})</h1>
          <p className="text-sm text-gray-500">Políticas e regulamentos da Noon Capital</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCategories(true)}><Settings className="w-4 h-4" /></Button>
          <Button onClick={() => setShowUpload(true)} className="text-white" style={{ backgroundColor: "#025382" }}>
            <Upload className="w-4 h-4 mr-2" />Novo documento
          </Button>
        </div>
      </div>

      {message && (
        <div className={`text-sm mb-4 p-3 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{message.text}</div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {summaryCards.map(c => (
          <Card key={c.label} className="p-5 bg-white rounded-xl shadow-sm border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.bg }}><c.icon className="w-5 h-5" style={{ color: c.color }} /></div>
              <div><p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p><p className="text-xs text-gray-500">{c.label}</p></div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters + Sort */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => toggleCategory(cat.id)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${selectedCategories.includes(cat.id) ? "text-white" : "bg-white text-gray-600 border-gray-200"}`}
              style={selectedCategories.includes(cat.id) ? { backgroundColor: cat.color, borderColor: cat.color } : {}}>
              {cat.name}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)} className="text-xs rounded-md border border-gray-200 px-2 py-1.5">
          <option value="name_asc">Nome (A-Z)</option>
          <option value="name_desc">Nome (Z-A)</option>
          <option value="upload_desc">Upload (recente)</option>
          <option value="upload_asc">Upload (antigo)</option>
          <option value="review_oldest">Revisão mais antiga</option>
        </select>
      </div>

      {/* Document list */}
      <Card className="bg-white rounded-xl shadow-sm border-gray-200 overflow-hidden">
        {sorted.map(doc => {
          const isExpanded = expandedId === doc.id;
          const isExtracting = extractingId === doc.id;
          const rs = getReviewStatus(doc.last_reviewed_at);
          const obs = extractedObs[doc.id] || [];
          const pendingObs = obs.filter(o => o.status === "pending");
          const hasPending = doc.obligations_pending > 0;

          return (
            <React.Fragment key={doc.id}>
              <div className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${isExpanded ? "bg-gray-50/30" : ""}`}>
                <div className="px-6 py-4 cursor-pointer flex items-center gap-4" onClick={() => handleExpandDoc(doc.id)}>
                  <ChevronRight className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {doc.category && (
                        <Badge variant="secondary" className="text-[10px] font-medium rounded-full" style={{ backgroundColor: doc.category.color + "15", color: doc.category.color }}>{doc.category.name}</Badge>
                      )}
                      <span className="text-sm font-medium text-gray-800 truncate">{doc.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{doc.pages} páginas</span>
                      <span>·</span>
                      <span>Enviado {new Date(doc.created_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}</span>
                      {doc.last_reviewed_at && (<><span>·</span><span>Revisão: {new Date(doc.last_reviewed_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</span></>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[10px] rounded-full" style={{ backgroundColor: rs.bg, color: rs.color }}>{rs.label}</Badge>
                    {isExtracting && <Badge variant="secondary" className="text-[10px] rounded-full bg-blue-50 text-blue-600"><Loader2 className="w-3 h-3 mr-1 animate-spin inline" />Analisando...</Badge>}
                    {!isExtracting && hasPending && <Badge variant="secondary" className="text-[10px] rounded-full bg-amber-50 text-amber-600">{doc.obligations_pending} pendente{doc.obligations_pending > 1 ? "s" : ""}</Badge>}
                    {!isExtracting && doc.obligations_included > 0 && !hasPending && <Badge variant="secondary" className="text-[10px] rounded-full bg-green-50 text-green-600">{doc.obligations_included} incluída{doc.obligations_included > 1 ? "s" : ""}</Badge>}
                    {doc.extraction_status === "no_obligations" && <Badge variant="secondary" className="text-[10px] rounded-full bg-gray-100 text-gray-500">Sem obrigações</Badge>}
                    {doc.extraction_status === "error" && <Badge variant="secondary" className="text-[10px] rounded-full bg-red-50 text-red-600">Erro na análise</Badge>}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-6 pb-4">
                    {/* Actions bar */}
                    <div className="flex gap-2 mb-3 ml-8">
                      {doc.storage_path && (
                        <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm" className="text-xs"><Download className="w-3.5 h-3.5 mr-1" />Baixar PDF</Button>
                        </a>
                      )}
                      <Button variant="outline" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); handleReanalyze(doc.id); }} disabled={isExtracting}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />Re-analisar IA
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); openReviewModal(doc); }}>
                        <ClipboardCheck className="w-3.5 h-3.5 mr-1" />Registrar revisão
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); handleDelete(doc.id, doc.name); }}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" />Excluir
                      </Button>
                    </div>

                    {/* Extracted obligations */}
                    {obs.length > 0 && (
                      <div className="ml-8 space-y-2">
                        <p className="text-xs font-medium text-gray-500 uppercase mb-2">Obrigações extraídas</p>
                        {obs.map(eo => (
                          <div key={eo.id} className={`p-3 rounded-lg border ${eo.status === "included" ? "bg-green-50/50 border-green-200" : eo.status === "discarded" ? "bg-gray-50 border-gray-200 opacity-50" : "bg-white border-gray-200"}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  {eo.status === "included" && <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                                  {eo.status === "discarded" && <XCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                                  <span className={`text-sm font-medium ${eo.status === "discarded" ? "line-through text-gray-400" : "text-gray-800"}`}>{eo.title}</span>
                                </div>
                                {eo.description && <p className="text-xs text-gray-500 line-clamp-2 ml-5">{eo.description}</p>}
                                <div className="flex items-center gap-2 mt-1 ml-5">
                                  {eo.legal_basis && <span className="text-[10px] text-gray-400">{eo.legal_basis}</span>}
                                  {eo.frequency && <Badge variant="secondary" className="text-[10px] rounded-full bg-gray-100 text-gray-500">{eo.frequency}</Badge>}
                                  {eo.suggested_category && <Badge variant="secondary" className="text-[10px] rounded-full bg-gray-100 text-gray-500">{eo.suggested_category}</Badge>}
                                </div>
                              </div>
                              {eo.status === "pending" && (
                                <div className="flex gap-1 shrink-0">
                                  <Button size="sm" className="text-xs text-white h-7" style={{ backgroundColor: "#025382" }}
                                    onClick={() => { setIncludingId(eo.id); setIncludeDueDate(""); setIncludeCategoryId(""); }}>
                                    Incluir
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-xs text-gray-400 h-7" onClick={() => handleDiscard(eo.id)}>Descartar</Button>
                                </div>
                              )}
                              {eo.status === "included" && <span className="text-[10px] text-green-600 font-medium shrink-0">INCLUÍDA</span>}
                              {eo.status === "discarded" && <span className="text-[10px] text-gray-400 font-medium shrink-0">DESCARTADA</span>}
                            </div>

                            {/* Include form */}
                            {includingId === eo.id && (
                              <div className="mt-3 ml-5 p-3 bg-gray-50 rounded-lg space-y-2">
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <label className="text-[10px] font-medium text-gray-500 block mb-1">Data de entrega *</label>
                                    <Input type="date" value={includeDueDate} onChange={e => setIncludeDueDate(e.target.value)} className="text-xs h-8" />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-[10px] font-medium text-gray-500 block mb-1">Categoria</label>
                                    <select value={includeCategoryId} onChange={e => setIncludeCategoryId(e.target.value)} className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs h-8">
                                      <option value="">Auto (sugestão da IA)</option>
                                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" className="text-xs text-white h-7" style={{ backgroundColor: "#025382" }} disabled={!includeDueDate || loading} onClick={() => handleInclude(eo.id)}>
                                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirmar inclusão"}
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setIncludingId(null)}>Cancelar</Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {obs.length === 0 && doc.extraction_status === "done" && (
                      <p className="text-xs text-gray-400 ml-8">Nenhuma obrigação identificada neste documento.</p>
                    )}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
        {sorted.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-gray-400">Nenhum documento encontrado.</div>
        )}
      </Card>

      {/* Upload Modal */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo documento</DialogTitle></DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nome</label>
              <Input value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="Ex: Manual de Compliance" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Categoria</label>
              <select value={uploadCategoryId} onChange={e => setUploadCategoryId(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm">
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Arquivo PDF</label>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                {uploadFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600"><FileText className="w-4 h-4" /><span>{uploadFile.name}</span><span className="text-gray-400">({(uploadFile.size / 1024 / 1024).toFixed(1)} MB)</span></div>
                    <button type="button" onClick={() => setUploadFile(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <label className="cursor-pointer"><Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-500">Clique para selecionar</p><p className="text-xs text-gray-400 mt-1">Máximo 10MB</p><input type="file" accept=".pdf" className="hidden" onChange={e => setUploadFile(e.target.files?.[0] || null)} /></label>
                )}
              </div>
            </div>
            <Button type="submit" disabled={uploading || !uploadFile || !uploadName} className="w-full text-white" style={{ backgroundColor: "#025382" }}>
              {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</> : "Enviar documento"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {reviewDoc && (<>
            <DialogHeader><DialogTitle>Registrar revisão</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <p className="text-sm font-medium text-gray-800">{reviewDoc.name}</p>
                <p className="text-xs text-gray-500 mt-1">Última revisão: {reviewDoc.last_reviewed_at ? new Date(reviewDoc.last_reviewed_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "Nunca"}</p>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Notas</label><textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Ex: Revisada sem alterações" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm min-h-[80px] resize-none" /></div>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={reviewUpdated} onChange={e => setReviewUpdated(e.target.checked)} className="rounded" /><span className="text-sm text-gray-700">Documento foi atualizado?</span></label>
              <Button onClick={handleReview} disabled={submittingReview} className="w-full text-white" style={{ backgroundColor: "#025382" }}>
                {submittingReview ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Registrando...</> : "Confirmar revisão"}
              </Button>
              {reviewHistory.length > 0 && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Histórico</p>
                  {reviewHistory.map((r: any) => (
                    <div key={r.id} className="text-xs text-gray-500 flex items-start gap-2 mb-1">
                      <span className="font-medium text-gray-700 shrink-0">{new Date(r.reviewed_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span>— {r.notes || "Sem notas"}{r.document_updated ? " (atualizado)" : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>)}
        </DialogContent>
      </Dialog>

      {/* Categories Modal */}
      <Dialog open={showCategories} onOpenChange={setShowCategories}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Gerenciar categorias</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            {categories.map(c => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="text-sm text-gray-800 flex-1">{c.name}</span>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-100">
              <form onSubmit={handleCreateCategory} className="flex gap-2">
                <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nova categoria" className="text-sm flex-1" />
                <select value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="rounded-md border border-gray-200 px-2 text-xs">
                  {COLORS_PALETTE.map(c => <option key={c} value={c} style={{ color: c }}>{c}</option>)}
                </select>
                <Button type="submit" size="sm" disabled={!newCatName || loading} style={{ backgroundColor: "#025382" }} className="text-white"><Plus className="w-4 h-4" /></Button>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
