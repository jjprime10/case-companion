import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CaseForm } from "@/components/case-form";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/processos/$id")({
  head: () => ({ meta: [{ title: "Processo — Sistema Jurídico" }] }),
  component: CaseDetail,
});

function CaseDetail() {
  const { id } = Route.useParams();
  const { isMaster, canWrite } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["case", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const archive = async () => {
    if (!confirm("Arquivar este processo?")) return;
    const { error } = await supabase
      .from("cases")
      .update({ archived: !data?.archived })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(data?.archived ? "Processo desarquivado" : "Processo arquivado");
    qc.invalidateQueries({ queryKey: ["case", id] });
    qc.invalidateQueries({ queryKey: ["cases"] });
  };

  const remove = async () => {
    if (!confirm("Excluir definitivamente este processo?")) return;
    const { error } = await supabase.from("cases").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Processo excluído");
    navigate({ to: "/processos" });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!data)
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Processo não encontrado.</p>
        <Button asChild variant="outline">
          <Link to="/processos">Voltar</Link>
        </Button>
      </div>
    );

  return (
    <div className="space-y-5 max-w-4xl">
      <Link
        to="/processos"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar para processos
      </Link>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {data.case_number || "Processo sem número"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {data.case_type || "Sem tipo"} · {data.court || "Sem vara"}
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={archive}>
              <Archive className="h-4 w-4" />
              {data.archived ? "Desarquivar" : "Arquivar"}
            </Button>
            {isMaster && (
              <Button variant="outline" size="sm" onClick={remove}>
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            )}
          </div>
        )}
      </div>
      <CaseForm
        initial={{
          id: data.id,
          case_number: data.case_number,
          court: data.court,
          jurisdiction: data.jurisdiction,
          case_type: data.case_type,
          opposing_party: data.opposing_party,
          claim_value: data.claim_value as unknown as number | null,
          opening_date: data.opening_date,
          responsible_user_id: data.responsible_user_id,
          status: data.status,
          notes: data.notes,
          client_id: data.client_id,
        }}
      />
    </div>
  );
}