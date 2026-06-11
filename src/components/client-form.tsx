import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCPF, formatCNPJ, formatPhone, onlyDigits } from "@/lib/format-br";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

type PersonType = "PF" | "PJ";

export interface ClientFormValues {
  id?: string;
  person_type: PersonType;
  document: string;
  name: string;
  trade_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  case_number?: string | null;
  case_status?: string | null;
  court?: string | null;
  responsible_user_id?: string | null;
  notes_summary?: string | null;
}

export function ClientForm({
  initial,
  onSaved,
}: {
  initial?: ClientFormValues;
  onSaved: (id: string) => void;
}) {
  const { user, isMaster } = useAuth();
  const isEditing = !!initial?.id;
  const [v, setV] = useState<ClientFormValues>(
    initial ?? {
      person_type: "PF",
      document: "",
      name: "",
      responsible_user_id: user?.id ?? null,
    },
  );
  const [busy, setBusy] = useState(false);

  const { data: lawyers } = useQuery({
    queryKey: ["lawyers"],
    queryFn: async () => {
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

  const set = <K extends keyof ClientFormValues>(k: K, val: ClientFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const onDocChange = (raw: string) => {
    const f = v.person_type === "PF" ? formatCPF(raw) : formatCNPJ(raw);
    set("document", f);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const doc = onlyDigits(v.document);
    if (v.person_type === "PF" && doc.length !== 11) {
      toast.error("CPF deve ter 11 dígitos");
      return;
    }
    if (v.person_type === "PJ" && doc.length !== 14) {
      toast.error("CNPJ deve ter 14 dígitos");
      return;
    }
    if (!v.name.trim()) {
      toast.error("Informe o nome");
      return;
    }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const currentUid = u.user?.id ?? null;
    const payload = {
      person_type: v.person_type,
      document: doc,
      name: v.name.trim(),
      trade_name: v.trade_name?.trim() || null,
      email: v.email?.trim() || null,
      phone: v.phone ? onlyDigits(v.phone) : null,
      address: v.address?.trim() || null,
      city: v.city?.trim() || null,
      state: v.state?.trim() || null,
      zip_code: v.zip_code ? onlyDigits(v.zip_code) : null,
      case_number: v.case_number?.trim() || null,
      case_status: v.case_status?.trim() || null,
      court: v.court?.trim() || null,
      responsible_user_id: isMaster
        ? v.responsible_user_id || null
        : isEditing
          ? (initial?.responsible_user_id ?? null)
          : currentUid,
      notes_summary: v.notes_summary?.trim() || null,
    };
    let saved;
    if (v.id) {
      const { data, error } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", v.id)
        .select("id")
        .single();
      saved = { data, error };
    } else {
      const { data, error } = await supabase
        .from("clients")
        .insert({ ...payload, created_by: currentUid })
        .select("id")
        .single();
      saved = { data, error };
    }
    setBusy(false);
    if (saved.error) {
      toast.error("Erro ao salvar", { description: saved.error.message });
      return;
    }
    toast.success(v.id ? "Cliente atualizado" : "Cliente cadastrado");
    if (saved.data) onSaved(saved.data.id);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={v.person_type}
            onValueChange={(val) => {
              set("person_type", val as PersonType);
              set("document", "");
            }}
          >
            <TabsList>
              <TabsTrigger value="PF">Pessoa Física (CPF)</TabsTrigger>
              <TabsTrigger value="PJ">Pessoa Jurídica (CNPJ)</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{v.person_type === "PF" ? "CPF" : "CNPJ"} *</Label>
              <Input
                value={v.document}
                onChange={(e) => onDocChange(e.target.value)}
                placeholder={v.person_type === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{v.person_type === "PF" ? "Nome completo" : "Razão social"} *</Label>
              <Input value={v.name} onChange={(e) => set("name", e.target.value)} required />
            </div>
            {v.person_type === "PJ" && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Nome fantasia</Label>
                <Input
                  value={v.trade_name ?? ""}
                  onChange={(e) => set("trade_name", e.target.value)}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contato</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={v.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={v.phone ? formatPhone(v.phone) : ""}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Endereço</Label>
            <Input value={v.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={v.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>UF</Label>
              <Input
                maxLength={2}
                value={v.state ?? ""}
                onChange={(e) => set("state", e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input
                value={v.zip_code ?? ""}
                onChange={(e) => set("zip_code", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Processo jurídico</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Número do processo</Label>
            <Input
              value={v.case_number ?? ""}
              onChange={(e) => set("case_number", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Input
              value={v.case_status ?? ""}
              onChange={(e) => set("case_status", e.target.value)}
              placeholder="Em andamento, Arquivado..."
            />
          </div>
          <div className="space-y-2">
            <Label>Vara / Tribunal</Label>
            <Input value={v.court ?? ""} onChange={(e) => set("court", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Advogado responsável</Label>
            {isMaster ? (
              <Select
                value={v.responsible_user_id ?? "none"}
                onValueChange={(val) =>
                  set("responsible_user_id", val === "none" ? null : val)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {lawyers?.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted/40">
                {isEditing
                  ? lawyers?.find((l) => l.id === v.responsible_user_id)?.name ??
                    "— Não atribuído —"
                  : "Será atribuído automaticamente a você"}
              </div>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Resumo / observações iniciais</Label>
            <Textarea
              rows={3}
              value={v.notes_summary ?? ""}
              onChange={(e) => set("notes_summary", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {v.id ? "Salvar alterações" : "Cadastrar cliente"}
        </Button>
      </div>
    </form>
  );
}