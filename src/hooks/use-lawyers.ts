import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LawyerOption {
  id: string;
  name: string;
}

export function useLawyers(enabled = true) {
  return useQuery({
    queryKey: ["lawyers-list"],
    enabled,
    queryFn: async (): Promise<LawyerOption[]> => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["master", "advogado"]);
      if (error) throw error;
      const ids = roles?.map((r) => r.user_id) ?? [];
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      return ids.map((id) => {
        const p = profs?.find((x) => x.id === id);
        return { id, name: p?.full_name ?? p?.email ?? "Usuário" };
      });
    },
  });
}

export function useAssignableUsers(enabled = true) {
  return useQuery({
    queryKey: ["assignable-users"],
    enabled,
    queryFn: async (): Promise<LawyerOption[]> => {
      const { data: profs, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return (profs ?? []).map((p) => ({
        id: p.id,
        name: p.full_name ?? p.email ?? "Usuário",
      }));
    },
  });
}