import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FileText,
  FolderOpen,
  UserPlus,
  Scale,
  Calendar as CalendarIcon,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_COLORS,
  type CaseStatus,
} from "@/lib/legal-constants";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Sistema Jurídico" }] }),
  component: Dashboard,
});

const PIE_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#f97316",
  "#a855f7",
  "#ec4899",
  "#06b6d4",
  "#71717a",
  "#10b981",
];

function Dashboard() {
  const { fullName, canWrite } = useAuth();

  const { data } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => {
      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * 86400_000).toISOString();
      const monthAgo = new Date(now.getTime() - 365 * 86400_000).toISOString();

      const [
        clientsTotal,
        casesAll,
        appointmentsUp,
        deadlinesPending,
        filesTotal,
        tasksOpen,
        casesClosed,
        recentClients,
        upcomingAppts,
        upcomingTasks,
        recentFiles,
        clientsByMonth,
      ] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("cases").select("status, created_at"),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .gte("starts_at", now.toISOString())
          .lte("starts_at", in7),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .in("status", ["scheduled"])
          .gte("starts_at", now.toISOString()),
        supabase.from("client_files").select("id", { count: "exact", head: true }),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "in_progress"]),
        supabase
          .from("cases")
          .select("id", { count: "exact", head: true })
          .eq("status", "closed"),
        supabase
          .from("clients")
          .select("id, name, document, person_type, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("appointments")
          .select("id, title, starts_at, type, client_id")
          .gte("starts_at", now.toISOString())
          .order("starts_at", { ascending: true })
          .limit(5),
        supabase
          .from("tasks")
          .select("id, title, due_date, status, priority")
          .in("status", ["pending", "in_progress"])
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(5),
        supabase
          .from("client_files")
          .select("id, file_name, created_at, category")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("clients")
          .select("created_at")
          .gte("created_at", monthAgo),
      ]);

      const cases = casesAll.data ?? [];
      const activeCases = cases.filter((c) => c.status !== "closed").length;
      const hearings = cases.filter((c) => c.status === "hearing_scheduled").length;

      const casesByStatusMap = new Map<string, number>();
      cases.forEach((c) => {
        casesByStatusMap.set(c.status, (casesByStatusMap.get(c.status) ?? 0) + 1);
      });
      const casesByStatus = Array.from(casesByStatusMap.entries()).map(([k, v]) => ({
        name: CASE_STATUS_LABELS[k as CaseStatus] ?? k,
        value: v,
      }));

      const monthsMap = new Map<string, number>();
      const monthLabels: string[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthsMap.set(key, 0);
        monthLabels.push(
          d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        );
      }
      (clientsByMonth.data ?? []).forEach((c) => {
        const d = new Date(c.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (monthsMap.has(key)) monthsMap.set(key, (monthsMap.get(key) ?? 0) + 1);
      });
      const clientsChart = Array.from(monthsMap.values()).map((v, i) => ({
        month: monthLabels[i],
        clientes: v,
      }));

      return {
        stats: {
          clients: clientsTotal.count ?? 0,
          activeCases,
          hearings,
          upcoming: appointmentsUp.count ?? 0,
          deadlines: deadlinesPending.count ?? 0,
          files: filesTotal.count ?? 0,
          tasks: tasksOpen.count ?? 0,
          closed: casesClosed.count ?? 0,
        },
        recentClients: recentClients.data ?? [],
        upcomingAppts: upcomingAppts.data ?? [],
        upcomingTasks: upcomingTasks.data ?? [],
        recentFiles: recentFiles.data ?? [],
        casesByStatus,
        clientsChart,
      };
    },
  });

  const s = data?.stats;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Olá{fullName ? `, ${fullName.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm">
            Visão executiva do departamento jurídico.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/processos/novo">
                <Scale className="h-4 w-4" /> Novo processo
              </Link>
            </Button>
            <Button asChild>
              <Link to="/clientes/novo">
                <UserPlus className="h-4 w-4" /> Novo cliente
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Clientes totais" value={s?.clients ?? "—"} tone="blue" />
        <StatCard icon={Scale} label="Processos ativos" value={s?.activeCases ?? "—"} tone="cyan" />
        <StatCard icon={CalendarIcon} label="Próximas audiências" value={s?.hearings ?? "—"} tone="pink" />
        <StatCard icon={Clock} label="Prazos próximos (7d)" value={s?.upcoming ?? "—"} tone="amber" />
        <StatCard icon={FolderOpen} label="Documentos" value={s?.files ?? "—"} tone="purple" />
        <StatCard icon={ClipboardList} label="Tarefas abertas" value={s?.tasks ?? "—"} tone="orange" />
        <StatCard icon={CheckCircle2} label="Processos encerrados" value={s?.closed ?? "—"} tone="emerald" />
        <StatCard icon={AlertCircle} label="Compromissos pendentes" value={s?.deadlines ?? "—"} tone="red" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clientes registrados (12 meses)</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.clientsChart ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="clientes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Processos por status</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {(data?.casesByStatus.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Sem processos cadastrados.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.casesByStatus}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {data?.casesByStatus.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clientes recentes</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {(data?.recentClients ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-4">
                Nenhum cliente cadastrado ainda.
              </p>
            )}
            {data?.recentClients.map((c) => (
              <Link
                key={c.id}
                to="/clientes/$id"
                params={{ id: c.id }}
                className="flex items-center justify-between py-3 hover:text-primary transition-colors"
              >
                <div>
                  <div className="font-medium text-sm">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.person_type} · {c.document}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximos compromissos</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {(data?.upcomingAppts ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-4">
                Nenhum compromisso agendado.
              </p>
            )}
            {data?.upcomingAppts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground capitalize">{a.type}</div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {new Date(a.starts_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tarefas em aberto</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {(data?.upcomingTasks ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-4">Nenhuma tarefa pendente.</p>
            )}
            {data?.upcomingTasks.map((t) => (
              <Link
                key={t.id}
                to="/tarefas"
                className="flex items-center justify-between py-3 hover:text-primary transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    Prioridade: {t.priority}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {t.due_date
                    ? new Date(t.due_date).toLocaleDateString("pt-BR")
                    : "Sem prazo"}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos recentes</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {(data?.recentFiles ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-4">
                Nenhum documento anexado.
              </p>
            )}
            {data?.recentFiles.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{f.file_name}</div>
                    {f.category && (
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        {f.category}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {new Date(f.created_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const TONE_STYLES: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  pink: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
};

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tone: keyof typeof TONE_STYLES;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-3xl font-semibold mt-1">{value}</p>
          </div>
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg shrink-0 ${TONE_STYLES[tone]}`}
          >
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}