import { createClient } from "@/lib/supabase/server";

export const toolDefinitions = [
  {
    name: "listar_obrigacoes",
    description:
      "Lista obrigações do calendário regulatório, com filtros opcionais por período, categoria ou status.",
    input_schema: {
      type: "object" as const,
      properties: {
        mes: {
          type: "number",
          description: "Mês (1-12) para filtrar. Se omitido, retorna próximos 30 dias.",
        },
        ano: { type: "number", description: "Ano. Default: ano atual." },
        categoria: {
          type: "string",
          enum: ["cvm", "anbima", "pldft", "interno"],
          description: "Filtrar por categoria.",
        },
        status: {
          type: "string",
          enum: ["pendente", "em_andamento", "concluida", "atrasada"],
          description: "Filtrar por status.",
        },
        proximos_dias: {
          type: "number",
          description: "Retornar obrigações com vencimento nos próximos N dias.",
        },
      },
    },
  },
  {
    name: "atualizar_status_obrigacao",
    description:
      "Atualiza o status de uma obrigação específica (ex: marcar como concluída, em andamento).",
    input_schema: {
      type: "object" as const,
      properties: {
        obligation_instance_id: {
          type: "string",
          description: "ID da instância da obrigação.",
        },
        titulo: {
          type: "string",
          description: "Título da obrigação (usado para busca se ID não fornecido).",
        },
        novo_status: {
          type: "string",
          enum: ["pendente", "em_andamento", "concluida"],
          description: "Novo status.",
        },
        notas: {
          type: "string",
          description: "Notas opcionais sobre a conclusão.",
        },
      },
      required: ["novo_status"],
    },
  },
  {
    name: "criar_obrigacao",
    description: "Cria uma nova obrigação no calendário regulatório.",
    input_schema: {
      type: "object" as const,
      properties: {
        titulo: { type: "string", description: "Título da obrigação." },
        descricao: { type: "string", description: "Descrição detalhada." },
        categoria: {
          type: "string",
          enum: ["cvm", "anbima", "pldft", "interno"],
          description: "Categoria.",
        },
        base_legal: { type: "string", description: "Base legal ou normativa." },
        frequencia: {
          type: "string",
          enum: ["anual", "semestral", "trimestral", "mensal", "continuo", "por_evento"],
        },
        mes_fixo: { type: "number", description: "Mês fixo do prazo (1-12)." },
        dia_fixo: { type: "number", description: "Dia fixo do prazo (1-31)." },
        dia_util: { type: "boolean", description: "Se o prazo é em dia útil." },
      },
      required: ["titulo", "categoria", "frequencia"],
    },
  },
  {
    name: "resumo_dashboard",
    description:
      "Retorna um resumo do status atual de compliance: total de obrigações, atrasadas, próximas a vencer, concluídas no mês.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "status_revisao_politicas",
    description:
      "Retorna o status de revisão de todas as políticas internas: quais estão em dia, próximas do vencimento ou atrasadas.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "status_treinamentos",
    description:
      "Retorna o status de treinamentos de todas as Pessoas Supervisionadas: quem está em dia, vencendo ou vencido para cada tipo de treinamento.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

export async function executeTool(
  name: string,
  input: Record<string, any>
): Promise<string> {
  const supabase = await createClient();

  switch (name) {
    case "listar_obrigacoes": {
      const now = new Date();
      const ano = input.ano || now.getFullYear();
      let query = supabase
        .from("obligation_instances")
        .select("*, obligation:obligations(*, category:categories(*))")
        .order("due_date");

      if (input.mes) {
        const start = `${ano}-${String(input.mes).padStart(2, "0")}-01`;
        const end = new Date(ano, input.mes, 0).toISOString().split("T")[0];
        query = query.gte("due_date", start).lte("due_date", end);
      } else if (input.proximos_dias) {
        const today = now.toISOString().split("T")[0];
        const future = new Date(now.getTime() + input.proximos_dias * 86400000)
          .toISOString()
          .split("T")[0];
        query = query.gte("due_date", today).lte("due_date", future);
      } else {
        const today = now.toISOString().split("T")[0];
        const in30 = new Date(now.getTime() + 30 * 86400000)
          .toISOString()
          .split("T")[0];
        query = query.gte("due_date", today).lte("due_date", in30);
      }

      if (input.status) {
        query = query.eq("status", input.status);
      }

      const { data, error } = await query;
      if (error) return JSON.stringify({ error: error.message });

      let results = data || [];
      if (input.categoria) {
        results = results.filter(
          (r: any) => r.obligation?.category?.slug === input.categoria
        );
      }

      const formatted = results.map((r: any) => ({
        id: r.id,
        titulo: r.obligation?.title,
        categoria: r.obligation?.category?.name,
        due_date: r.due_date,
        status: r.status,
        base_legal: r.obligation?.legal_basis,
      }));

      return JSON.stringify({ total: formatted.length, obrigacoes: formatted });
    }

    case "atualizar_status_obrigacao": {
      let instanceId = input.obligation_instance_id;

      if (!instanceId && input.titulo) {
        const { data } = await supabase
          .from("obligation_instances")
          .select("id, obligation:obligations(title)")
          .neq("status", "concluida")
          .order("due_date")
          .limit(50);

        const match = (data || []).find((r: any) =>
          r.obligation?.title?.toLowerCase().includes(input.titulo.toLowerCase())
        );
        if (match) instanceId = match.id;
      }

      if (!instanceId) {
        return JSON.stringify({ error: "Obrigação não encontrada." });
      }

      const updates: any = {
        status: input.novo_status,
        updated_at: new Date().toISOString(),
      };
      if (input.novo_status === "concluida") {
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_at = null;
      }
      if (input.notas) updates.notes = input.notas;

      const { error } = await supabase
        .from("obligation_instances")
        .update(updates)
        .eq("id", instanceId);

      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, id: instanceId, novo_status: input.novo_status });
    }

    case "criar_obrigacao": {
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", input.categoria)
        .single();

      if (!cat) return JSON.stringify({ error: "Categoria não encontrada." });

      const { data: obligation, error } = await supabase
        .from("obligations")
        .insert({
          category_id: cat.id,
          title: input.titulo,
          description: input.descricao || null,
          legal_basis: input.base_legal || null,
          frequency: input.frequencia,
          fixed_month: input.mes_fixo || null,
          fixed_day: input.dia_fixo || null,
          is_business_day: input.dia_util || false,
        })
        .select()
        .single();

      if (error) return JSON.stringify({ error: error.message });

      // Generate instances for current year
      const year = new Date().getFullYear();
      const instances: { obligation_id: string; due_date: string; status: string }[] = [];

      switch (input.frequencia) {
        case "anual":
          instances.push({
            obligation_id: obligation.id,
            due_date: `${year}-${String(input.mes_fixo || 12).padStart(2, "0")}-${String(input.dia_fixo || 31).padStart(2, "0")}`,
            status: "pendente",
          });
          break;
        case "semestral":
          instances.push(
            { obligation_id: obligation.id, due_date: `${year}-06-30`, status: "pendente" },
            { obligation_id: obligation.id, due_date: `${year}-12-31`, status: "pendente" }
          );
          break;
        case "trimestral":
          ["03-31", "06-30", "09-30", "12-31"].forEach((d) => {
            instances.push({ obligation_id: obligation.id, due_date: `${year}-${d}`, status: "pendente" });
          });
          break;
      }

      if (instances.length > 0) {
        await supabase.from("obligation_instances").insert(instances);
      }

      return JSON.stringify({
        success: true,
        obrigacao: { id: obligation.id, titulo: obligation.title },
        instances_criadas: instances.length,
      });
    }

    case "resumo_dashboard": {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const year = now.getFullYear();
      const month = now.getMonth();
      const startOfMonth = new Date(year, month, 1).toISOString().split("T")[0];
      const endOfMonth = new Date(year, month + 1, 0).toISOString().split("T")[0];
      const in7Days = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];

      const { data: all } = await supabase
        .from("obligation_instances")
        .select("id, due_date, status")
        .gte("due_date", startOfMonth)
        .lte("due_date", endOfMonth);

      const items = all || [];
      const totalMes = items.length;
      const atrasadas = items.filter((i) => i.status !== "concluida" && i.due_date < today).length;
      const proximos7 = items.filter((i) => i.status !== "concluida" && i.due_date >= today && i.due_date <= in7Days).length;
      const concluidas = items.filter((i) => i.status === "concluida").length;
      const pendentes = items.filter((i) => i.status === "pendente" && i.due_date >= today).length;

      return JSON.stringify({
        mes_atual: `${String(month + 1).padStart(2, "0")}/${year}`,
        total_obrigacoes_mes: totalMes,
        atrasadas,
        proximos_7_dias: proximos7,
        concluidas_mes: concluidas,
        pendentes,
      });
    }

    case "status_treinamentos": {
      const PESSOAS = ["Patrick Ledoux", "Carlos Aguiar", "Nelson Bechara", "Tereza Cidade", "Ricardo Kanitz", "Eduardo Alcalay"];
      const { data: tTypes } = await supabase.from("training_types").select("*").order("name");
      const { data: tRecords } = await supabase.from("training_records").select("*").order("completed_at", { ascending: false });

      const today = new Date().toISOString().split("T")[0];
      const result = (tTypes || []).map((tt: any) => {
        const participants = PESSOAS.map((name) => {
          const latest = (tRecords || []).find((r: any) => r.participant_name === name && r.training_type_id === tt.id);
          if (!latest) return { nome: name, status: "nunca_realizado", ultimo: null, validade: null };
          if (!latest.expires_at) return { nome: name, status: "realizado", ultimo: latest.completed_at, validade: null };
          const status = latest.expires_at < today ? "vencido" : "em_dia";
          return { nome: name, status, ultimo: latest.completed_at, validade: latest.expires_at };
        });
        const emDia = participants.filter((p: any) => p.status === "em_dia" || p.status === "realizado").length;
        return { treinamento: tt.name, categoria: tt.category, frequencia: tt.frequency, participantes_em_dia: `${emDia}/${PESSOAS.length}`, detalhes: participants };
      });

      return JSON.stringify({ treinamentos: result });
    }

    case "status_revisao_politicas": {
      const { data: docs } = await supabase
        .from("policy_documents")
        .select("name, category, last_reviewed_at")
        .order("name");

      const now = Date.now();
      const results = (docs || []).map((d: any) => {
        if (!d.last_reviewed_at) {
          return { ...d, status: "nunca_revisado", dias_desde_revisao: null };
        }
        const days = Math.floor((now - new Date(d.last_reviewed_at).getTime()) / 86400000);
        const months = Math.floor(days / 30);
        let status = "em_dia";
        if (months >= 12) status = "atrasada";
        else if (months >= 10) status = "proxima";
        return { nome: d.name, categoria: d.category, ultima_revisao: d.last_reviewed_at, status, meses_desde_revisao: months };
      });

      const atrasadas = results.filter((r: any) => r.status === "atrasada").length;
      const proximas = results.filter((r: any) => r.status === "proxima").length;
      const emDia = results.filter((r: any) => r.status === "em_dia").length;
      const nunca = results.filter((r: any) => r.status === "nunca_revisado").length;

      return JSON.stringify({ total: results.length, atrasadas, proximas_do_vencimento: proximas, em_dia: emDia, nunca_revisadas: nunca, politicas: results });
    }

    default:
      return JSON.stringify({ error: `Tool '${name}' não reconhecida.` });
  }
}
