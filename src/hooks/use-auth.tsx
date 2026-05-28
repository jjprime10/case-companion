import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "master" | "advogado" | "assistente" | "visualizador";

interface AuthState {
  loading: boolean;
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  fullName: string | null;
  isMaster: boolean;
  canWrite: boolean; // master | advogado
  canUpload: boolean; // master | advogado | assistente
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRole = async (uid: string) => {
    const [{ data: roleRow }, { data: prof }] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .order("role", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
    ]);
    setRole((roleRow?.role as AppRole) ?? null);
    setFullName(prof?.full_name ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadRole(s.user.id), 0);
      } else {
        setRole(null);
        setFullName(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadRole(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    loading,
    user: session?.user ?? null,
    session,
    role,
    fullName,
    isMaster: role === "master",
    canWrite: role === "master" || role === "advogado",
    canUpload: role === "master" || role === "advogado" || role === "assistente",
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshRole: async () => {
      if (session?.user) await loadRole(session.user.id);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth deve estar dentro de AuthProvider");
  return v;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  master: "Master Admin",
  advogado: "Advogado",
  assistente: "Assistente",
  visualizador: "Visualizador",
};