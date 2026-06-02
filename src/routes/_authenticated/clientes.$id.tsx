import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  ArrowLeft,
  Upload,
  Trash2,
  Pencil,
  Save,
  X,
  Download,
  FileText,
  Image as ImageIcon,
  Video,
  Sheet,
  File as FileIcon,
  MessageCircle,
} from "lucide-react";
import { formatBytes, formatDocument, formatPhone, fileCategory } from "@/lib/format-br";
import { useAuth } from "@/hooks/use-auth";
import { ClientForm, type ClientFormValues } from "@/components/client-form";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  head: () => ({ meta: [{ title: "Cliente — Sistema Jurídico" }] }),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { canWrite, canUpload } = useAuth();
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: notes } = useQuery({
    queryKey: ["notes", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_notes")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: files } = useQuery({
    queryKey: ["files", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_files")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!client) return <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>;

  const addNote = async () => {
    if (!noteText.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("client_notes")
      .insert({ client_id: id, content: noteText.trim(), created_by: u.user?.id });
    if (error) toast.error(error.message);
    else {
      setNoteText("");
      qc.invalidateQueries({ queryKey: ["notes", id] });
      toast.success("Nota adicionada");
    }
  };

  const deleteNote = async (noteId: string) => {
    const { error } = await supabase.from("client_notes").delete().eq("id", noteId);
    if (error) toast.error(error.message);
    else {
      qc.invalidateQueries({ queryKey: ["notes", id] });
      toast.success("Nota removida");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files;
    if (!fl || fl.length === 0) return;
    setUploading(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) {
      setUploading(false);
      return;
    }
    for (const file of Array.from(fl)) {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${id}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from("client-files").upload(path, file);
      if (upErr) {
        toast.error(`Falha em ${file.name}`, { description: upErr.message });
        continue;
      }
      const { error: insErr } = await supabase.from("client_files").insert({
        client_id: id,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        category: fileCategory(file.type),
        uploaded_by: uid,
      });
      if (insErr) toast.error(insErr.message);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    qc.invalidateQueries({ queryKey: ["files", id] });
    toast.success("Arquivos enviados");
  };

  const downloadFile = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("client-files").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Falha ao gerar link");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.click();
  };

  const deleteFile = async (fileId: string, path: string) => {
    await supabase.storage.from("client-files").remove([path]);
    const { error } = await supabase.from("client_files").delete().eq("id", fileId);
    if (error) toast.error(error.message);
    else {
      qc.invalidateQueries({ queryKey: ["files", id] });
      toast.success("Arquivo removido");
    }
  };

  const deleteClient = async () => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Cliente excluído");
      navigate({ to: "/clientes" });
    }
  };

  const iconFor = (cat: string | null) => {
    if (cat === "foto") return ImageIcon;
    if (cat === "video") return Video;
    if (cat === "planilha") return Sheet;
    if (cat === "documento") return FileText;
    return FileIcon;
  };

  if (editing) {
    const initial: ClientFormValues = {
      id: client.id,
      person_type: client.person_type as "PF" | "PJ",
      document: client.document,
      name: client.name,
      trade_name: client.trade_name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      state: client.state,
      zip_code: client.zip_code,
      case_number: client.case_number,
      case_status: client.case_status,
      court: client.court,
      responsible_user_id: client.responsible_user_id,
      notes_summary: client.notes_summary,
    };
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Editar cliente</h1>
          <Button variant="outline" onClick={() => setEditing(false)}>
            <X className="h-4 w-4" /> Cancelar
          </Button>
        </div>
        <ClientForm
          initial={initial}
          onSaved={() => {
            setEditing(false);
            qc.invalidateQueries({ queryKey: ["client", id] });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/clientes">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
        <div className="flex-1" />
        {client.phone && (
          <Button
            variant="outline"
            onClick={() => {
              const phone = client.phone!.startsWith("55")
                ? client.phone!.replace(/\D/g, "")
                : "55" + client.phone!.replace(/\D/g, "");
              window.open(
                `https://web.whatsapp.com/send?phone=${phone}`,
                "whatsapp-web",
                "width=1000,height=700,resizable=yes,scrollbars=yes,status=yes"
              );
            }}
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp Web
          </Button>
        )}
        {canWrite && (
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação remove o cliente, suas notas e arquivos. Não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteClient}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <Badge variant="secondary" className="mb-2">
                {client.person_type === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
              </Badge>
              <CardTitle className="text-2xl">{client.name}</CardTitle>
              {client.trade_name && (
                <p className="text-sm text-muted-foreground mt-1">{client.trade_name}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                {formatDocument(client.person_type as "PF" | "PJ", client.document)}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
          <Info label="E-mail" value={client.email} />
          <Info label="Telefone" value={client.phone ? formatPhone(client.phone) : null} />
          <Info
            label="Endereço"
            value={
              [client.address, client.city, client.state].filter(Boolean).join(", ") || null
            }
          />
          <Info label="CEP" value={client.zip_code} />
          <Info label="Processo nº" value={client.case_number} />
          <Info label="Status" value={client.case_status} />
          <Info label="Vara / Tribunal" value={client.court} />
          {client.notes_summary && (
            <div className="sm:col-span-2">
              <p className="text-xs uppercase text-muted-foreground mb-1">Resumo</p>
              <p className="whitespace-pre-wrap">{client.notes_summary}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">Arquivos ({files?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="notes">Notas ({notes?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-4">
          {canUpload && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleUpload}
                  />
                  <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
                    <Upload className="h-4 w-4" />
                    {uploading ? "Enviando..." : "Anexar arquivos"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Fotos, vídeos, PDFs, planilhas, documentos.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-2">
            {files?.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum arquivo anexado.</p>
            )}
            {files?.map((f) => {
              const Icon = iconFor(f.category);
              return (
                <Card key={f.id}>
                  <CardContent className="py-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{f.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.category} · {formatBytes(f.size_bytes ?? 0)} ·{" "}
                        {new Date(f.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => downloadFile(f.storage_path, f.file_name)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {canUpload && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteFile(f.id, f.storage_path)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          {canUpload && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <Textarea
                  placeholder="Escreva uma observação..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                />
                <Button onClick={addNote} disabled={!noteText.trim()}>
                  <Save className="h-4 w-4" /> Salvar nota
                </Button>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-2">
            {notes?.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma nota registrada.</p>
            )}
            {notes?.map((n) => (
              <Card key={n.id}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="whitespace-pre-wrap text-sm flex-1">{n.content}</p>
                    {canUpload && (
                      <Button variant="ghost" size="icon" onClick={() => deleteNote(n.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(n.created_at).toLocaleString("pt-BR")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p>{value}</p>
    </div>
  );
}