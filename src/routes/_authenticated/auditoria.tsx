import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({ meta: [{ title: "Relatório de Atividades — Sistema Jurídico" }] }),
  component: AuditPage,
});

const ACTION_LABELS: Record<string, string> = {
  create: "Criou",
  update: "Editou",
  delete: "Excluiu",
  assign: "Atribuiu",
  role_grant: "Concedeu função",
  role_revoke: "Removeu função",
  password_reset: "Redefiniu senha",
};

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
  assign: "outline",
  role_grant: "default",
  role_revoke: "destructive",
  password_reset: "outline",
};

const ENTITY_LABELS: Record<string, string> = {
  client: "Cliente",
  file: "Arquivo",
  note: "Nota",
  appointment: "Compromisso",
  user_role: "Permissão de usuário",
  user: "Usuário",
};

function describeDetails(entity: string, action: string, details: Record<string, unknown> | null) {
  if (!details) return null;
  const parts: string[] = [];
  if (typeof details.name === "string") parts.push(details.name);
  if (typeof details.file_name === "string") parts.push(details.file_name);
  if (typeof details.title === "string") parts.push(details.title);
  if (typeof details.preview === "string") parts.push(`"${details.preview}"`);
  if (typeof details.document === "string") parts.push(`Doc: ${details.document}`);
  if (typeof details.role === "string") parts.push(`Função: ${details.role}`);
  if (typeof details.status === "string") parts.push(`Status: ${details.status}`);
  if (typeof details.type === "string") parts.push(`Tipo: ${details.type}`);
  if (typeof details.starts_at === "string")
    parts.push(`Em: ${new Date(details.starts_at).toLocaleString("pt-BR")}`);
  return parts.join(" · ") || null;
}

function AuditPage() {
  const { isMaster } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: isMaster,
  });

  if (!isMaster) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Relatório de Atividades</h1>
        <p className="text-muted-foreground text-sm">
          Histórico detalhado de criações, edições e exclusões: quem fez, o que mudou e quando.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas 500 ações</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {isLoading && <p className="text-sm text-muted-foreground py-3">Carregando...</p>}
          {data?.length === 0 && (
            <p className="text-sm text-muted-foreground py-3">Nenhuma ação registrada.</p>
          )}
          {data?.map((row) => {
            const details = (row.details as Record<string, unknown> | null) ?? null;
            const summary = describeDetails(row.entity, row.action, details);
            return (
              <div key={row.id} className="py-3 flex items-start gap-3 flex-wrap">
                <Badge variant={ACTION_VARIANT[row.action] ?? "secondary"}>
                  {ACTION_LABELS[row.action] ?? row.action}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">{row.actor_email ?? "sistema"}</span>{" "}
                    <span className="text-muted-foreground">
                      · {ENTITY_LABELS[row.entity] ?? row.entity}
                      {row.entity_id ? ` #${row.entity_id.slice(0, 8)}` : ""}
                    </span>
                  </div>
                  {summary && <p className="text-sm mt-1">{summary}</p>}
                  {details && Object.keys(details).length > 0 && !summary && (
                    <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-all">
                      {JSON.stringify(details, null, 0)}
                    </pre>
                  )}
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(row.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}