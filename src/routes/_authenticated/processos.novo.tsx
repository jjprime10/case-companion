import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { CaseForm } from "@/components/case-form";

export const Route = createFileRoute("/_authenticated/processos/novo")({
  head: () => ({ meta: [{ title: "Novo processo — Sistema Jurídico" }] }),
  component: NewCase,
  validateSearch: (s: Record<string, unknown>) => ({
    client_id: typeof s.client_id === "string" ? s.client_id : undefined,
  }),
});

function NewCase() {
  const { client_id } = Route.useSearch();
  return (
    <div className="space-y-5 max-w-4xl">
      <Link
        to="/processos"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar para processos
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Novo processo</h1>
        <p className="text-muted-foreground text-sm">
          Cadastre um novo processo jurídico.
        </p>
      </div>
      <CaseForm presetClientId={client_id} />
    </div>
  );
}