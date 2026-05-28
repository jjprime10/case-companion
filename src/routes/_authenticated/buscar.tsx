import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, User, Building2, FileText } from "lucide-react";
import { formatDocument, formatBytes } from "@/lib/format-br";

export const Route = createFileRoute("/_authenticated/buscar")({
  head: () => ({ meta: [{ title: "Buscar — Sistema Jurídico" }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const term = q.trim();

  const { data, isFetching } = useQuery({
    queryKey: ["search", term],
    enabled: term.length >= 2,
    queryFn: async () => {
      const digits = term.replace(/\D/g, "");
      const clientFilters = [`name.ilike.%${term}%`, `trade_name.ilike.%${term}%`];
      if (digits.length >= 3) clientFilters.push(`document.ilike.%${digits}%`);
      const [clientsRes, filesRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, document, person_type, trade_name")
          .or(clientFilters.join(","))
          .limit(50),
        supabase
          .from("client_files")
          .select("id, file_name, category, size_bytes, client_id, clients!inner(name, document, person_type)")
          .ilike("file_name", `%${term}%`)
          .limit(50),
      ]);
      return {
        clients: clientsRes.data ?? [],
        files: filesRes.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Buscar</h1>
        <p className="text-muted-foreground text-sm">
          Pesquise por nome, CPF/CNPJ ou nome de arquivo.
        </p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Digite ao menos 2 caracteres..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 h-12"
        />
      </div>
      {term.length < 2 && (
        <p className="text-sm text-muted-foreground">Comece a digitar para buscar.</p>
      )}
      {term.length >= 2 && isFetching && (
        <p className="text-sm text-muted-foreground">Buscando...</p>
      )}
      {data && (
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              Clientes ({data.clients.length})
            </h2>
            <div className="grid gap-2">
              {data.clients.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
              )}
              {data.clients.map((c) => (
                <Link key={c.id} to="/clientes/$id" params={{ id: c.id }}>
                  <Card className="hover:border-primary transition-colors">
                    <CardContent className="py-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                        {c.person_type === "PJ" ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDocument(c.person_type as "PF" | "PJ", c.document)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              Arquivos ({data.files.length})
            </h2>
            <div className="grid gap-2">
              {data.files.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum arquivo encontrado.</p>
              )}
              {data.files.map((f) => {
                const c = f.clients as unknown as { name: string; document: string; person_type: string };
                return (
                  <Link key={f.id} to="/clientes/$id" params={{ id: f.client_id }}>
                    <Card className="hover:border-primary transition-colors">
                      <CardContent className="py-3 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{f.file_name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {c.name} · {formatBytes(f.size_bytes ?? 0)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}