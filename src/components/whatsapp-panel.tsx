import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function normalizePhone(p: string) {
  const digits = p.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

export function WhatsAppPanel({
  clientId,
  defaultPhone,
}: {
  clientId: string;
  defaultPhone: string | null;
}) {
  const { canUpload, user } = useAuth();
  const qc = useQueryClient();
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [message, setMessage] = useState("");

  const { data: messages } = useQuery({
    queryKey: ["wa", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const send = async () => {
    const num = normalizePhone(phone);
    if (!num || !message.trim()) return;
    if (!user?.id) return;
    const { error } = await supabase.from("whatsapp_messages").insert({
      client_id: clientId,
      phone: num,
      message: message.trim(),
      direction: "outbound",
      sent_by: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const url = `https://wa.me/${num}?text=${encodeURIComponent(message.trim())}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setMessage("");
    qc.invalidateQueries({ queryKey: ["wa", clientId] });
    toast.success("WhatsApp aberto e registrado");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("whatsapp_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["wa", clientId] });
  };

  return (
    <div className="space-y-4">
      {canUpload && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="space-y-2">
              <Label>Número (com DDD)</Label>
              <Input
                placeholder="11999998888"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                rows={3}
                placeholder="Ex.: Confirmando audiência amanhã às 10h..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <Button onClick={send} disabled={!phone || !message.trim()}>
              <Send className="h-4 w-4" /> Abrir WhatsApp e registrar
            </Button>
            <p className="text-xs text-muted-foreground">
              Abre o WhatsApp Web/app com a mensagem pronta e salva no histórico.
            </p>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-2">
        {messages?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma mensagem registrada.</p>
        )}
        {messages?.map((m) => (
          <Card key={m.id}>
            <CardContent className="py-3 flex gap-3 items-start">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 shrink-0">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {m.phone} · {new Date(m.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              {canUpload && (
                <Button variant="ghost" size="icon" onClick={() => remove(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}