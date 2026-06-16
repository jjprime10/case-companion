import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useAssignableUsers } from "@/hooks/use-lawyers";
import {
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/legal-constants";

export const Route = createFileRoute("/_authenticated/tarefas")({
  head: () => ({ meta: [{ title: "Tarefas — Sistema Jurídico" }] }),
  component: TasksPage,
});

function TasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("active");
  const [open, setOpen] = useState(false);

  const { data: users } = useAssignableUsers();

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", filter],
    queryFn: async () => {
      let q = supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (filter === "active") q = q.in("status", ["pending", "in_progress"]);
      else if (filter !== "all") q = q.eq("status", filter as TaskStatus);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data;
    },
  });

  const setStatus = async (id: string, status: TaskStatus) => {
    const payload: { status: TaskStatus; completed_at: string | null } = {
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("tasks").update(payload).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta tarefa?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const userName = (id: string | null) =>
    id ? users?.find((u) => u.id === id)?.name ?? "—" : "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tarefas</h1>
          <p className="text-muted-foreground text-sm">
            Gerenciamento interno de tarefas e prazos.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Nova tarefa
            </Button>
          </DialogTrigger>
          <NewTaskDialog
            users={users ?? []}
            currentUserId={user?.id ?? ""}
            onClose={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["tasks"] });
            }}
          />
        </Dialog>
      </div>

      <div className="flex gap-2">
        {[
          { k: "active", l: "Ativas" },
          { k: "pending", l: "Pendentes" },
          { k: "in_progress", l: "Em andamento" },
          { k: "completed", l: "Concluídas" },
          { k: "all", l: "Todas" },
        ].map((f) => (
          <Button
            key={f.k}
            size="sm"
            variant={filter === f.k ? "default" : "outline"}
            onClick={() => setFilter(f.k)}
          >
            {f.l}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && data?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              Nenhuma tarefa.
            </CardContent>
          </Card>
        )}
        {data?.map((t) => {
          const done = t.status === "completed";
          const overdue =
            !done && t.due_date && new Date(t.due_date) < new Date();
          return (
            <Card key={t.id} className={overdue ? "border-red-500/40" : ""}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={done}
                    onCheckedChange={(c) =>
                      setStatus(t.id, c ? "completed" : "pending")
                    }
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-medium ${done ? "line-through text-muted-foreground" : ""}`}
                      >
                        {t.title}
                      </span>
                      <Badge
                        variant="outline"
                        className={TASK_PRIORITY_COLORS[t.priority]}
                      >
                        {TASK_PRIORITY_LABELS[t.priority]}
                      </Badge>
                      {overdue && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                          Atrasada
                        </Badge>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {t.description}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-3 flex-wrap">
                      {t.due_date && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {new Date(t.due_date).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      )}
                      <span>Atribuída: {userName(t.assigned_to)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={t.status}
                      onValueChange={(s) => setStatus(t.id, s as TaskStatus)}
                    >
                      <SelectTrigger className="h-8 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TASK_STATUS_LABELS).map(([k, l]) => (
                          <SelectItem key={k} value={k}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function NewTaskDialog({
  users,
  currentUserId,
  onClose,
}: {
  users: { id: string; name: string }[];
  currentUserId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigned, setAssigned] = useState<string>(currentUserId);
  const [due, setDue] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return toast.error("Informe um título");
    setBusy(true);
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assigned_to: assigned || null,
      due_date: due ? new Date(due).toISOString() : null,
      created_by: currentUserId,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Tarefa criada");
    onClose();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nova tarefa</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={(s) => setPriority(s as TaskPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TASK_PRIORITY_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Prazo</Label>
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Atribuir a</Label>
          <Select value={assigned} onValueChange={setAssigned}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Criar tarefa
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}