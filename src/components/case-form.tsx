import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
import { useAuth } from "@/hooks/use-auth";
import { useLawyers } from "@/hooks/use-lawyers";
import {
  CASE_STATUS_LABELS,
  type CaseStatus,
} from "@/lib/legal-constants";

export interface CaseFormValues {
  id?: string;
  case_number?: string | null;
  court?: string | null;
  jurisdiction?: string | null;
  case_type?: string | null;
  opposing_party?: string | null;
  claim_value?: number | string | null;
  opening_date?: string | null;
  responsible_user_id?: string | null;
  status: CaseStatus;
  notes?: string | null;
  client_id?: string | null;
}

export function CaseForm({
  initial,
  presetClientId,
}: {
  initial?: CaseFormValues;
  presetClientId?: string;
}) {
  const { user, isMaster } = useAuth();
  const navigate = useNavigate();
  const isEditing = !!initial?.id;
  const [v, setV] = useState<CaseFormValues>(
    initial ?? {
      status: "new",
      responsible_user_id: user?.id ?? null,
      client_id: presetClientId ?? null,
      opening_date: new Date().toISOString().slice(0, 10),
    },
  );
  const [busy, setBusy] = useState(false);

  const { data: lawyers } = useLawyers(isMaster);
  const { data: clients } = useQuery({
    queryKey: ["clients-for-case"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name")
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        case_number: v.case_number || null,
        court: v.court || null,
        jurisdiction: v.jurisdiction || null,
        case_type: v.case_type || null,
        opposing_party: v.opposing_party || null,
        claim_value:
          v.claim_value === "" || v.claim_value === null || v.claim_value === undefined
            ? null
            : Number(v.claim_value),
        opening_date: v.opening_date || null,
        responsible_user_id: v.responsible_user_id || null,
        status: v.status,
        notes: v.notes || null,
        client_id: v.client_id || null,
      };
      if (isEditing && initial?.id) {
        const { error } = await supabase.from("cases").update(payload).eq("id", initial.id);
        if (error) throw error;
        toast.success("Processo atualizado");
        navigate({ to: "/processos/$id", params: { id: initial.id } });
      } else {
        const { data, error } = await supabase
          .from("cases")
          .insert({ ...payload, created_by: user?.id })
          .select("id")
          .single();
        if (error) throw error;
        toast.success("Processo criado");
        navigate({ to: "/processos/$id", params: { id: data.id } });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do processo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Número do processo">
            <Input
              value={v.case_number ?? ""}
              onChange={(e) => setV({ ...v, case_number: e.target.value })}
              placeholder="0000000-00.0000.0.00.0000"
            />
          </Field>
          <Field label="Tipo de ação">
            <Input
              value={v.case_type ?? ""}
              onChange={(e) => setV({ ...v, case_type: e.target.value })}
              placeholder="Trabalhista, cível, tributária..."
            />
          </Field>
          <Field label="Vara / Tribunal">
            <Input
              value={v.court ?? ""}
              onChange={(e) => setV({ ...v, court: e.target.value })}
            />
          </Field>
          <Field label="Jurisdição">
            <Input
              value={v.jurisdiction ?? ""}
              onChange={(e) => setV({ ...v, jurisdiction: e.target.value })}
              placeholder="Comarca, estado..."
            />
          </Field>
          <Field label="Parte contrária">
            <Input
              value={v.opposing_party ?? ""}
              onChange={(e) => setV({ ...v, opposing_party: e.target.value })}
            />
          </Field>
          <Field label="Valor da causa (R$)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={v.claim_value ?? ""}
              onChange={(e) => setV({ ...v, claim_value: e.target.value })}
            />
          </Field>
          <Field label="Data de abertura">
            <Input
              type="date"
              value={v.opening_date ?? ""}
              onChange={(e) => setV({ ...v, opening_date: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <Select
              value={v.status}
              onValueChange={(s) => setV({ ...v, status: s as CaseStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CASE_STATUS_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cliente">
            <Select
              value={v.client_id ?? "none"}
              onValueChange={(s) => setV({ ...v, client_id: s === "none" ? null : s })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem cliente</SelectItem>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {isMaster && (
            <Field label="Advogado responsável">
              <Select
                value={v.responsible_user_id ?? "none"}
                onValueChange={(s) =>
                  setV({ ...v, responsible_user_id: s === "none" ? null : s })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {lawyers?.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <div className="sm:col-span-2">
            <Field label="Observações">
              <Textarea
                rows={4}
                value={v.notes ?? ""}
                onChange={(e) => setV({ ...v, notes: e.target.value })}
              />
            </Field>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/processos" })}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? "Salvar alterações" : "Criar processo"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}