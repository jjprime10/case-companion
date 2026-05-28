import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { ClientForm } from "@/components/client-form";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/clientes/novo")({
  head: () => ({ meta: [{ title: "Novo cliente — Sistema Jurídico" }] }),
  component: NewClient,
});

function NewClient() {
  const { canWrite } = useAuth();
  const navigate = useNavigate();
  if (!canWrite) return <Navigate to="/clientes" replace />;
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Novo cliente</h1>
        <p className="text-muted-foreground text-sm">Cadastre uma pessoa física ou jurídica.</p>
      </div>
      <ClientForm onSaved={(id) => navigate({ to: "/clientes/$id", params: { id } })} />
    </div>
  );
}