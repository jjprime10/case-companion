import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Bell, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({ meta: [{ title: "Calendário — Sistema Jurídico" }] }),
  component: CalendarPage,
});

const TYPES = [
  { value: "compromisso", label: "Compromisso" },
  { value: "reuniao", label: "Reunião" },
  { value: "prazo", label: "Prazo" },
  { value: "audiencia", label: "Audiência" },
  { value: "tarefa", label: "Tarefa" },
];

const REMINDER_PRESETS = [
  { label: "15 min antes", minutes: 15 },
  { label: "1 hora antes", minutes: 60 },
  { label: "1 dia antes", minutes: 1440 },
  { label: "1 semana antes", minutes: 10080 },
];

type Appt = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  starts_at: string;
  location: string | null;
  client_id: string | null;
  assigned_to: string | null;
  status: string;
};

function CalendarPage() {
  const { canUpload, user } = useAuth();
  const qc = useQueryClient();

  const { data: appts, isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("starts_at");
      if (error) throw error;
      return data as Appt[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: users } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return data ?? [];
    },
  });

  // simple in-app reminder: check every minute
  useEffect(() => {
    if (!appts) return;
    const seen = new Set<string>();
    const check = async () => {
      const { data } = await supabase
        .from("appointment_reminders")
        .select("id, minutes_before, notified_at, appointment_id, appointments(title, starts_at, assigned_to, created_by)")
        .is("notified_at", null);
      const now = Date.now();
      for (const r of data ?? []) {
        const a = (r as { appointments: { title: string; starts_at: string; assigned_to: string | null; created_by: string | null } | null }).appointments;
        if (!a) continue;
        const fireAt = new Date(a.starts_at).getTime() - r.minutes_before * 60_000;
        const mine = a.assigned_to === user?.id || a.created_by === user?.id;
        if (mine && fireAt <= now && !seen.has(r.id)) {
          seen.add(r.id);
          toast.info(`Lembrete: ${a.title}`, {
            description: new Date(a.starts_at).toLocaleString("pt-BR"),
            duration: 10000,
          });
          await supabase
            .from("appointment_reminders")
            .update({ notified_at: new Date().toISOString() })
            .eq("id", r.id);
        }
      }
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [appts, user?.id]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (appts ?? []).filter((a) => new Date(a.starts_at).getTime() >= now);
  }, [appts]);
  const past = useMemo(() => {
    const now = Date.now();
    return (appts ?? []).filter((a) => new Date(a.starts_at).getTime() < now).reverse();
  }, [appts]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Compromisso removido");
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calendário</h1>
          <p className="text-muted-foreground text-sm">
            Compromissos, audiências, prazos e lembretes.
          </p>
        </div>
        {canUpload && (
          <NewAppointmentDialog
            clients={clients ?? []}
            users={users ?? []}
            onCreated={() => qc.invalidateQueries({ queryKey: ["appointments"] })}
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos ({upcoming.length})</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {isLoading && <p className="text-sm text-muted-foreground py-3">Carregando...</p>}
          {!isLoading && upcoming.length === 0 && (
            <p className="text-sm text-muted-foreground py-3">Nenhum compromisso agendado.</p>
          )}
          {upcoming.map((a) => (
            <ApptRow
              key={a.id}
              a={a}
              clients={clients ?? []}
              users={users ?? []}
              onDelete={() => remove(a.id)}
            />
          ))}
        </CardContent>
      </Card>

      {past.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">
              Passados ({past.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border opacity-70">
            {past.slice(0, 20).map((a) => (
              <ApptRow
                key={a.id}
                a={a}
                clients={clients ?? []}
                users={users ?? []}
                onDelete={() => remove(a.id)}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ApptRow({
  a,
  clients,
  users,
  onDelete,
}: {
  a: Appt;
  clients: { id: string; name: string }[];
  users: { id: string; full_name: string | null; email: string | null }[];
  onDelete: () => void;
}) {
  const client = clients.find((c) => c.id === a.client_id);
  const assigned = users.find((u) => u.id === a.assigned_to);
  const typeLabel = TYPES.find((t) => t.value === a.type)?.label ?? a.type;
  return (
    <div className="py-3 flex items-start gap-3 flex-wrap">
      <div className="text-xs text-muted-foreground w-32 shrink-0">
        {new Date(a.starts_at).toLocaleString("pt-BR")}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{typeLabel}</Badge>
          <span className="font-medium">{a.title}</span>
        </div>
        {a.description && (
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.description}</p>
        )}
        <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
          {a.location && <span>📍 {a.location}</span>}
          {client && <span>👤 {client.name}</span>}
          {assigned && <span>⚖️ {assigned.full_name ?? assigned.email}</span>}
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function NewAppointmentDialog({
  clients,
  users,
  onCreated,
}: {
  clients: { id: string; name: string }[];
  users: { id: string; full_name: string | null; email: string | null }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState("compromisso");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [clientId, setClientId] = useState<string>("none");
  const [assignedTo, setAssignedTo] = useState<string>("none");
  const [reminders, setReminders] = useState<number[]>([60]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) {
      setBusy(false);
      return;
    }
    const { data: appt, error } = await supabase
      .from("appointments")
      .insert({
        title,
        description: desc || null,
        type,
        starts_at: new Date(startsAt).toISOString(),
        location: location || null,
        client_id: clientId === "none" ? null : clientId,
        assigned_to: assignedTo === "none" ? uid : assignedTo,
        created_by: uid,
      })
      .select()
      .single();
    if (error || !appt) {
      setBusy(false);
      toast.error(error?.message ?? "Falha");
      return;
    }
    if (reminders.length > 0) {
      await supabase.from("appointment_reminders").insert(
        reminders.map((m) => ({ appointment_id: appt.id, minutes_before: m })),
      );
    }
    setBusy(false);
    toast.success("Compromisso criado");
    setOpen(false);
    setTitle("");
    setDesc("");
    setStartsAt("");
    setLocation("");
    setClientId("none");
    setAssignedTo("none");
    setReminders([60]);
    onCreated();
  };

  const toggleReminder = (m: number) => {
    setReminders((r) => (r.includes(m) ? r.filter((x) => x !== m) : [...r, m]));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Novo compromisso
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo compromisso</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data e hora</Label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Local</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Eu mesmo</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name ?? u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Bell className="h-3 w-3" /> Lembretes
            </Label>
            <div className="flex flex-wrap gap-2">
              {REMINDER_PRESETS.map((p) => (
                <Button
                  key={p.minutes}
                  type="button"
                  size="sm"
                  variant={reminders.includes(p.minutes) ? "default" : "outline"}
                  onClick={() => toggleReminder(p.minutes)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy || !title || !startsAt}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}