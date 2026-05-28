export function onlyDigits(v: string): string {
  return (v || "").replace(/\D/g, "");
}

export function formatCPF(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatCNPJ(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function formatDocument(personType: "PF" | "PJ", v: string): string {
  return personType === "PF" ? formatCPF(v) : formatCNPJ(v);
}

export function formatPhone(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3").replace(/-$/, "");
  }
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3").replace(/-$/, "");
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

export function fileCategory(mime: string | null | undefined): string {
  if (!mime) return "outro";
  if (mime.startsWith("image/")) return "foto";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return "planilha";
  if (
    mime.includes("pdf") ||
    mime.includes("word") ||
    mime.includes("document") ||
    mime.startsWith("text/")
  )
    return "documento";
  return "outro";
}