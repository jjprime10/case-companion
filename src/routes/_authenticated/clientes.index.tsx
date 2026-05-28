import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Building2, User } from "lucide-react";
import { formatDocument } from "@/lib/format-br";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/clientes/")({
  head: () => ({ meta: [{ title: "Clientes — Sistema Jurídico" }] }),
  component: ClientsList,
});

function ClientsList() {
  const { canWrite } = useAuth();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["clients", q],
    queryFn: async () => {
      let query = supabase
        .from("clients")
        .select("id, name, document, person_type, email, case_status, trade_name")
        .order("name");
      if (q.trim()) {
        const digits = q.replace(/\D/g, "");
        const filters = [`name.ilike.%${q}%`, `trade_name.ilike.%${q}%`];
        if (digits.length >= 3) filters.push(`document.ilike.%${digits}%`);
        query = query.or(filters.join(","));
      }
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-muted-foreground text-sm">Todos os clientes cadastrados.</p>
        </div>
        {canWrite && (
          <Button asChild>
            <Link to="/clientes/novo">
              <UserPlus className="h-4 w-4" /> Novo cliente
            </Link>
          </Button>
        )}
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CPF/CNPJ..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && data?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
        )}
        {data?.map((c) => (
          <Link key={c.id} to="/clientes/$id" params={{ id: c.id }}>
            <Card className="hover:border-primary transition-colors h-full">
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                    {c.person_type === "PJ" ? (
                      <Building2 className="h-5 w-5" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.name}</div>
                    {c.trade_name && (
                      <div className="text-xs text-muted-foreground truncate">{c.trade_name}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDocument(c.person_type as "PF" | "PJ", c.document)}
                    </div>
                    {c.case_status && (
                      <Badge variant="secondary" className="mt-2">
                        {c.case_status}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}