import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { UserPlus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth, ROLE_LABELS, type AppRole } from "@/hooks/use-auth";
import { listUsers, createUser, updateUserRole, deleteUser } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — Sistema Jurídico" }] }),
  component: UsersPage,
});

const ROLES: AppRole[] = ["master", "advogado", "assistente", "visualizador"];

function UsersPage() {
  const { isMaster, user } = useAuth();
  const qc = useQueryClient();
  const fList = useServerFn(listUsers);
  const fCreate = useServerFn(createUser);
  const fUpdate = useServerFn(updateUserRole);
  const fDelete = useServerFn(deleteUser);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("advogado");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fList(),
    enabled: isMaster,
  });

  if (!isMaster) return <Navigate to="/dashboard" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await fCreate({ data: { email, password, full_name: name, role } });
      toast.success("Usuário criado");
      setOpen(false);
      setEmail("");
      setPassword("");
      setName("");
      setRole("advogado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (uid: string, r: AppRole) => {
    try {
      await fUpdate({ data: { user_id: uid, role: r } });
      toast.success("Função atualizada");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const remove = async (uid: string) => {
    try {
      await fDelete({ data: { user_id: uid } });
      toast.success("Usuário removido");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Usuários & Permissões</h1>
          <p className="text-muted-foreground text-sm">
            Crie usuários e defina funções de acesso.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4" /> Novo usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar novo usuário</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Senha inicial</Label>
                <Input
                  type="text"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Compartilhe com o usuário; ele poderá alterá-la depois.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Criar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuários do sistema</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {isLoading && <p className="text-sm text-muted-foreground py-3">Carregando...</p>}
          {data?.map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{u.full_name ?? u.email}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <Select
                value={u.role ?? ""}
                onValueChange={(v) => changeRole(u.id, v as AppRole)}
                disabled={u.id === user?.id}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Sem função" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={u.id === user?.id}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação é permanente. O usuário perderá acesso imediatamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(u.id)}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}