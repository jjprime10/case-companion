import type { Database } from "@/integrations/supabase/types";

export type CaseStatus = Database["public"]["Enums"]["case_status"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  new: "Novo",
  under_analysis: "Em análise",
  awaiting_documents: "Aguardando documentos",
  filed: "Protocolado",
  hearing_scheduled: "Audiência marcada",
  in_progress: "Em andamento",
  suspended: "Suspenso",
  closed: "Encerrado",
};

export const CASE_STATUS_COLORS: Record<CaseStatus, string> = {
  new: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  under_analysis: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  awaiting_documents: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  filed: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  hearing_scheduled: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
  in_progress: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  suspended: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  closed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  high: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};