import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — Sistema Jurídico" }] }),
  component: AuditPage,
});

const LABELS: Record<string, string> = {
  create: "Criação",
  update: "Edição",
  delete: "Exclusão",
  assign: "Atribuição",
  role_grant: "Função concedida",
  role_revoke: "Função removida",
  password_reset: "Senha redefinida",
};

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
        <h1 className="text-2xl font-semibold">Auditoria</h1>
        <p className="text-muted-foreground text-sm">
          Registro de ações sensíveis: senhas, clientes, atribuições e permissões.
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
          {data?.map((row) => (
            <div key={row.id} className="py-3 flex items-start gap-3 flex-wrap">
              <Badge variant="secondary">{LABELS[row.action] ?? row.action}</Badge>
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <span className="font-medium">{row.actor_email ?? "sistema"}</span>{" "}
                  <span className="text-muted-foreground">
                    · {row.entity}
                    {row.entity_id ? ` #${row.entity_id.slice(0, 8)}` : ""}
                  </span>
                </div>
                {row.details && Object.keys(row.details).length > 0 && (
                  <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-all">
                    {JSON.stringify(row.details, null, 0)}
                  </pre>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(row.created_at).toLocaleString("pt-BR")}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}