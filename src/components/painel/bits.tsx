/**
 * Pequenas peças compartilhadas da área interna: selos de status, tabela,
 * abas em link, campo de busca e bloco de "chave: valor".
 */
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/surface";
import {
  DELIVERABLE_STATUS,
  LEAD_STAGES,
  PROJECT_STATUS,
  QUOTE_STATUS,
  STAGES,
  type EntryStatus,
} from "@/lib/domain";
import { ENTRY_STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------------- Selos ---------------- */

export function StageBadge({ stage }: { stage: string }) {
  const s = STAGES.find((x) => x.key === stage);
  return (
    <Badge>
      <span className="font-mono text-[10px] text-mute">{s?.n}</span> {s?.label ?? stage}
    </Badge>
  );
}

export function LeadStageBadge({ stage }: { stage: string }) {
  const label = LEAD_STAGES.find((s) => s.key === stage)?.label ?? stage;
  const tone = stage === "novo" ? "light" : stage === "ganho" ? "ok" : stage === "perdido" ? "danger" : "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const label = PROJECT_STATUS.find((s) => s.key === status)?.label ?? status;
  const tone = status === "concluido" ? "ok" : status === "cancelado" ? "danger" : status === "pausado" ? "warn" : "neutral";
  return (
    <Badge tone={tone} dot={status === "ativo"}>
      {label}
    </Badge>
  );
}

export function QuoteStatusBadge({ status }: { status: string }) {
  const label = QUOTE_STATUS.find((s) => s.key === status)?.label ?? status;
  const tone =
    status === "aprovado" ? "ok" : status === "recusado" ? "danger" : status === "expirado" ? "warn" : status === "enviado" ? "light" : "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}

export function EntryStatusBadge({ status }: { status: EntryStatus }) {
  const tone = status === "pago" ? "ok" : status === "atrasado" ? "danger" : status === "parcial" ? "warn" : "neutral";
  return (
    <Badge tone={tone} dot>
      {ENTRY_STATUS_LABEL[status]}
    </Badge>
  );
}

export function DeliverableStatusBadge({ status }: { status: string }) {
  const label = DELIVERABLE_STATUS.find((s) => s.key === status)?.label ?? status;
  const tone = status === "entregue" ? "ok" : status === "aprovado" ? "light" : status === "revisao" ? "warn" : "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}

/* ---------------- Tabela ---------------- */

export function Table({ children, className, minWidth = 640 }: { children: React.ReactNode; className?: string; minWidth?: number }) {
  return (
    // relative: o texto só para leitor de tela (sr-only) é absoluto e, sem isso, alarga a página no celular.
    <div className={cn("relative overflow-x-auto", className)}>
      <table className="w-full border-collapse text-[14px]" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, align = "left" }: { children?: React.ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "border-b border-line px-4 py-3 text-[12px] font-normal text-mute first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, align = "left" }: { children?: React.ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "border-b border-line px-4 py-3.5 align-middle text-light first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6",
        align === "right" && "text-right tabular-nums",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

/* ---------------- Abas em link ---------------- */

export function TabLinks({
  tabs,
  active,
  className,
}: {
  tabs: { key: string; label: string; href: string; count?: number }[];
  active: string;
  className?: string;
}) {
  return (
    // Abas de plataforma: linha de base de ponta a ponta e o traço branco na aba ativa.
    <nav
      className={cn(
        "-mx-4 min-w-0 overflow-x-auto px-4 shadow-[inset_0_-1px_0_var(--color-line)] [scrollbar-width:none] sm:mx-0 sm:px-0",
        className,
      )}
      aria-label="Seções"
    >
      <ul className="flex w-max gap-1 sm:gap-2 [&>li:first-child>a]:pl-0 [&>li:first-child>a]:after:left-0">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex h-12 items-center gap-2 px-3 text-[14px] whitespace-nowrap transition-colors sm:px-3.5",
                  "after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-full after:transition-colors sm:after:inset-x-3.5",
                  on ? "font-medium text-white after:bg-white" : "text-mute after:bg-transparent hover:text-light",
                )}
              >
                {t.label}
                {t.count != null ? (
                  <span
                    className={cn(
                      "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] tabular-nums",
                      on ? "bg-white text-void" : "bg-white/[0.07] text-ash",
                    )}
                  >
                    {t.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ---------------- Chave: valor ---------------- */

export function InfoList({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid", className)}>
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline justify-between gap-6 border-b border-line py-3 last:border-b-0">
          <dt className="text-[13px] text-mute">{it.label}</dt>
          <dd className="text-right text-[14px] text-light">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Botão de WhatsApp do perfil. Sem número cadastrado ele aparece apagado,
 * para ficar claro onde está e o que falta.
 */
export function WhatsAppButton({ href }: { href: string | null }) {
  const base = "inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium sm:h-8";
  if (!href) {
    return (
      <span className={`${base} cursor-not-allowed border border-dashed border-line-strong text-mute`} title="Cadastre o WhatsApp em Editar">
        <MessageCircle className="size-4" /> Sem WhatsApp
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`${base} bg-white text-void hover:bg-light`}>
      <MessageCircle className="size-4" /> WhatsApp
    </a>
  );
}

/** Link de WhatsApp para um telefone, com mensagem opcional. */
export function whatsappHref(phone: string | null | undefined, text?: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
