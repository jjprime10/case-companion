import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Scale } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sistema Jurídico Interno" },
      { name: "description", content: "Acesso restrito ao departamento jurídico." },
    ],
  }),
  component: Index,
});

function Index() {
  const { loading, user } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Scale className="h-10 w-10 animate-pulse text-primary" />
      </div>
    );
  }
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}
