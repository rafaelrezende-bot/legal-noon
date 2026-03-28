import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { anthropic } from "@/lib/anthropic";

const MAX_CHARS_PER_CHUNK = 60000;
const OVERLAP_CHARS = 2000;

const EXTRACTION_SYSTEM = `Você é um especialista em compliance regulatório do mercado financeiro brasileiro,
especializado em análise de documentos normativos da CVM, ANBIMA, BCB e políticas internas
de gestoras de recursos.

Sua tarefa é analisar o documento a seguir e extrair TODAS as obrigações, deveres,
responsabilidades e compromissos de compliance que ele contém. Isso inclui:

1. **Obrigações com prazo calendário** (ex: "enviar relatório até o dia 10 de cada mês")
2. **Obrigações contínuas/permanentes** (ex: "manter políticas de gestão de risco atualizadas")
3. **Obrigações eventuais** (ex: "registrar veículos na ANBIMA quando constituídos")
4. **Deveres de conduta** (ex: "manter certificação profissional ativa")
5. **Requisitos de governança** (ex: "estabelecer procedimentos de controle de operações")

NÃO ignore obrigações só porque não têm uma data fixa. Obrigações contínuas e de
monitoramento são tão importantes quanto as com prazo calendário.

Para cada obrigação identificada, retorne um objeto JSON com:
- title: nome curto e descritivo da obrigação (máx 80 caracteres)
- description: descrição completa incluindo o que deve ser feito, por quem e quando
- category: uma de ["CVM", "ANBIMA", "PLDFT", "Interno"]
- frequency: uma de ["anual", "semestral", "trimestral", "mensal", "continuo", "por_evento"]
- deadline_day: dia do mês do prazo (número 1-31, ou null se não aplicável)
- deadline_month: mês do prazo (número 1-12, ou null se recorrente ou contínua)
- legal_basis: base legal ou referência normativa

Seja abrangente — é melhor extrair demais e o usuário desmarcar do que perder uma obrigação.`;

function splitTextForExtraction(text: string): { text: string; index: number }[] {
  if (text.length <= MAX_CHARS_PER_CHUNK) {
    return [{ text, index: 0 }];
  }

  const chunks: { text: string; index: number }[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = Math.min(start + MAX_CHARS_PER_CHUNK, text.length);

    if (end < text.length) {
      const sectionBreak = text.lastIndexOf("\n\n", end);
      if (sectionBreak > start + MAX_CHARS_PER_CHUNK * 0.7) {
        end = sectionBreak;
      } else {
        const paraBreak = text.lastIndexOf("\n", end);
        if (paraBreak > start + MAX_CHARS_PER_CHUNK * 0.7) {
          end = paraBreak;
        }
      }
    }

    const chunkText = text.slice(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push({ text: chunkText, index });
      index++;
    }

    start = end - OVERLAP_CHARS;
    if (start >= text.length || start <= 0) break;
    if (end >= text.length) break;
  }

  return chunks;
}

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(" "));
  const wordsB = new Set(normalize(b).split(" "));
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.length / union.size : 0;
}

function deduplicateObligations(obligations: any[]): any[] {
  const unique: any[] = [];
  for (const ob of obligations) {
    const isDuplicate = unique.some((existing) => jaccardSimilarity(ob.title, existing.title) > 0.8);
    if (!isDuplicate) unique.push(ob);
  }
  return unique;
}

function validateAndNormalize(obligations: any[]): any[] {
  return obligations
    .filter((o: any) => o.title && o.category && o.frequency)
    .map((o: any) => ({
      title: String(o.title).substring(0, 120),
      description: o.description || "",
      category: ["CVM", "ANBIMA", "PLDFT", "Interno"].includes(o.category) ? o.category : "Interno",
      frequency: ["anual", "semestral", "trimestral", "mensal", "continuo", "por_evento"].includes(o.frequency) ? o.frequency : "anual",
      deadline_day: typeof o.deadline_day === "number" && o.deadline_day >= 1 && o.deadline_day <= 31 ? o.deadline_day : null,
      deadline_month: typeof o.deadline_month === "number" && o.deadline_month >= 1 && o.deadline_month <= 12 ? o.deadline_month : null,
      legal_basis: o.legal_basis || null,
    }));
}

async function extractFromChunk(
  text: string,
  documentLabel: string,
  existingList: string
): Promise<any[]> {
  const systemPrompt = `${EXTRACTION_SYSTEM}

IMPORTANTE: Estas obrigações JÁ EXISTEM no sistema. NÃO as inclua novamente:
${existingList || "(nenhuma obrigação existente)"}

Retorne APENAS um JSON array com as obrigações NOVAS encontradas.
Se não houver obrigações novas, retorne um array vazio [].
Responda APENAS com o JSON, sem texto adicional.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Analise o seguinte trecho de documento e extraia as obrigações regulatórias.
Este pode ser um trecho de um documento maior — extraia apenas as obrigações explícitas neste trecho.

---
Documento: ${documentLabel}

${text}
---`,
      },
    ],
  });

  const rawText = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return [];
  } catch {
    console.error(`Failed to parse chunk response for "${documentLabel}"`);
    return [];
  }
}

export async function POST(request: NextRequest) {
  let documentId: string | undefined;
  try {
    const supabase = createAdminClient();
    ({ documentId } = await request.json());

    if (!documentId) {
      return NextResponse.json({ error: "documentId é obrigatório." }, { status: 400 });
    }

    await supabase.from("policy_documents").update({ extraction_status: "processing" }).eq("id", documentId);

    const { data: doc } = await supabase
      .from("policy_documents")
      .select("name, content")
      .eq("id", documentId)
      .single();

    if (!doc?.content) {
      return NextResponse.json({ error: "Documento não encontrado ou sem texto." }, { status: 400 });
    }

    const { data: existingObs } = await supabase
      .from("obligations")
      .select("title")
      .order("title");

    const existingList = (existingObs || []).map((o) => `- ${o.title}`).join("\n");

    // Split into chunks
    const chunks = splitTextForExtraction(doc.content);
    console.log(`Extracting "${doc.name}": ${doc.content.length} chars, ${chunks.length} chunk(s)`);

    // Process chunks with concurrency limit
    const CONCURRENCY = 3;
    const allExtracted: any[] = [];

    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const batch = chunks.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((chunk) =>
          extractFromChunk(
            chunk.text,
            chunks.length > 1
              ? `${doc.name} (Parte ${chunk.index + 1} de ${chunks.length})`
              : doc.name,
            existingList
          )
        )
      );
      allExtracted.push(...results.flat());
    }

    // Validate, normalize, deduplicate
    let obligations = validateAndNormalize(allExtracted);
    obligations = deduplicateObligations(obligations);

    console.log(`Extracted ${obligations.length} unique obligations from "${doc.name}"`);

    // Save to extracted_obligations
    if (obligations.length > 0) {
      const rows = obligations.map((o: any) => ({
        document_id: documentId,
        title: o.title,
        description: o.description,
        suggested_category: o.category,
        frequency: o.frequency,
        deadline_day: o.deadline_day,
        deadline_month: o.deadline_month,
        legal_basis: o.legal_basis,
        obligation_type: o.frequency === "continuo" || o.frequency === "por_evento" ? "continua" : "prazo_fixo",
        status: "pending",
      }));

      await supabase.from("extracted_obligations").insert(rows);
      await supabase.from("policy_documents").update({ extraction_status: "done" }).eq("id", documentId);
    } else {
      await supabase.from("policy_documents").update({ extraction_status: "no_obligations" }).eq("id", documentId);
    }

    return NextResponse.json({ document_name: doc.name, obligations });
  } catch (error: any) {
    console.error("Extract obligations error:", error?.message || error);
    if (documentId) {
      try { await createAdminClient().from("policy_documents").update({ extraction_status: "error" }).eq("id", documentId); } catch {}
    }
    return NextResponse.json({ error: error.message || "Erro na extração." }, { status: 500 });
  }
}
