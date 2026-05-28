import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, FolderOpen, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Sistema Jurídico" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { fullName, canWrite } = useAuth();
  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [clients, notes, files, recent] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("client_notes").select("id", { count: "exact", head: true }),
        supabase.from("client_files").select("id", { count: "exact", head: true }),
        supabase
          .from("clients")
          .select("id, name, document, person_type, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      return {
        clients: clients.count ?? 0,
        notes: notes.count ?? 0,
        files: files.count ?? 0,
        recent: recent.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Olá{fullName ? `, ${fullName.split(" ")[0]}` : ""}</h1>
          <p className="text-muted-foreground text-sm">Visão geral do departamento jurídico.</p>
        </div>
        {canWrite && (
          <Button asChild>
            <Link to="/clientes/novo">
              <UserPlus className="h-4 w-4" /> Novo cliente
            </Link>
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Users} label="Clientes cadastrados" value={data?.clients ?? "—"} />
        <StatCard icon={FileText} label="Notas registradas" value={data?.notes ?? "—"} />
        <StatCard icon={FolderOpen} label="Arquivos anexados" value={data?.files ?? "—"} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clientes recentes</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {(data?.recent ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground py-4">Nenhum cliente cadastrado ainda.</p>
          )}
          {data?.recent.map((c) => (
            <Link
              key={c.id}
              to="/clientes/$id"
              params={{ id: c.id }}
              className="flex items-center justify-between py-3 hover:text-primary transition-colors"
            >
              <div>
                <div className="font-medium">{c.name}</div>
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
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-semibold mt-1">{value}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}