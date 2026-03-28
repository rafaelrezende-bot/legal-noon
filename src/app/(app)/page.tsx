import { createClient } from "@/lib/supabase/server";
import { DashboardSummary } from "@/components/dashboard-summary";
import { ObligationCard } from "@/components/obligation-card";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startOfMonth = new Date(year, month, 1).toISOString().split("T")[0];
  const endOfMonth = new Date(year, month + 1, 0).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];
  const in7Days = new Date(now.getTime() + 7 * 86400000)
    .toISOString()
    .split("T")[0];

  const { data: monthInstances } = await supabase
    .from("obligation_instances")
    .select("*, obligation:obligations(*, category:categories(*))")
    .gte("due_date", startOfMonth)
    .lte("due_date", endOfMonth)
    .order("due_date");

  const instances = monthInstances || [];
  const totalMonth = instances.length;
  const overdue = instances.filter(
    (i: any) => i.status !== "concluida" && i.due_date < today
  ).length;
  const next7Days = instances.filter(
    (i: any) =>
      i.status !== "concluida" && i.due_date >= today && i.due_date <= in7Days
  ).length;
  const completedMonth = instances.filter(
    (i: any) => i.status === "concluida"
  ).length;

  const { data: upcoming } = await supabase
    .from("obligation_instances")
    .select("*, obligation:obligations(*, category:categories(*))")
    .gte("due_date", today)
    .neq("status", "concluida")
    .order("due_date")
    .limit(5);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {getGreeting()}, Tereza
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Aqui está o resumo das suas obrigações regulatórias.
      </p>

      <DashboardSummary
        totalMonth={totalMonth}
        overdue={overdue}
        next7Days={next7Days}
        completedMonth={completedMonth}
      />

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Próximas obrigações
        </h2>
        <div className="grid gap-3">
          {(upcoming || []).map((instance: any) => (
            <ObligationCard key={instance.id} instance={instance} />
          ))}
          {(!upcoming || upcoming.length === 0) && (
            <p className="text-sm text-gray-400">
              Nenhuma obrigação pendente nos próximos dias.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
