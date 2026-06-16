import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Scale } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLawyers } from "@/hooks/use-lawyers";
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_COLORS,
  type CaseStatus,
} from "@/lib/legal-constants";

export const Route = createFileRoute("/_authenticated/processos/")({
  head: () => ({ meta: [{ title: "Processos — Sistema Jurídico" }] }),
  component: CasesList,
});

function CasesList() {
  const { canWrite, isMaster } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [lawyerFilter, setLawyerFilter] = useState<string>("all");

  const { data: lawyers } = useLawyers(isMaster);

  const { data, isLoading } = useQuery({
    queryKey: ["cases", q, status, lawyerFilter],
    queryFn: async () => {
      let query = supabase
        .from("cases")
        .select(
          "id, case_number, court, case_type, opposing_party, status, opening_date, responsible_user_id, client_id, archived, clients(name)"
        )
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (status !== "all") query = query.eq("status", status as CaseStatus);
      if (lawyerFilter !== "all" && isMaster)
        query = query.eq("responsible_user_id", lawyerFilter);
      if (q.trim()) {
        query = query.or(
          `case_number.ilike.%${q}%,court.ilike.%${q}%,opposing_party.ilike.%${q}%,case_type.ilike.%${q}%`
        );
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
          <h1 className="text-2xl font-semibold">Processos</h1>
          <p className="text-muted-foreground text-sm">
            Acompanhamento de processos e casos jurídicos.
          </p>
        </div>
        {canWrite && (
          <Button asChild>
            <Link to="/processos/novo">
              <Plus className="h-4 w-4" /> Novo processo
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, vara, parte..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(CASE_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isMaster && (
          <Select value={lawyerFilter} onValueChange={setLawyerFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os advogados</SelectItem>
              {lawyers?.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && data?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              Nenhum processo encontrado.
            </CardContent>
          </Card>
        )}
        {data?.map((c) => (
          <Link key={c.id} to="/processos/$id" params={{ id: c.id }}>
            <Card className="hover:border-primary transition-colors">
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                    <Scale className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {c.case_number || "Processo sem número"}
                      </span>
                      <Badge
                        variant="outline"
                        className={CASE_STATUS_COLORS[c.status as CaseStatus]}
                      >
                        {CASE_STATUS_LABELS[c.status as CaseStatus]}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {c.case_type || "Sem tipo"}
                      {c.court ? ` · ${c.court}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Cliente: {c.clients?.name ?? "—"}
                      {c.opposing_party ? ` · vs ${c.opposing_party}` : ""}
                    </div>
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