/**
 * Peças compartilhadas dos documentos do projeto (ordem do dia, checklist,
 * roteiros): cabeçalho dos editores e a "folha" de impressão A4.
 */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo, Symbol } from "@/components/brand/logo";
import type { ProjectHeader } from "@/lib/queries/documents";
import { cn } from "@/lib/utils";

/** Cabeçalho dos editores: volta para a aba Documentos do projeto. */
export function DocHeader({
  project,
  kind,
  title,
  meta,
  actions,
}: {
  project: ProjectHeader;
  kind: string;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <Link
        href={`/painel/projetos/${project.id}?aba=documentos`}
        className="label inline-flex w-fit max-w-full items-center gap-2 text-mute hover:text-white"
      >
        <ArrowLeft className="size-3.5 shrink-0" />
        <span className="truncate">
          {project.code} · {project.title}
        </span>
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="label mb-3 text-mute">{kind}</p>
          <h1 className="text-[clamp(28px,3vw,40px)] leading-[1.05] font-semibold tracking-[-0.035em] break-words text-white">
            {title}
          </h1>
          {meta ? <div className="mt-2 text-[15px] text-ash">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
    </div>
  );
}

/**
 * Regras de impressão: só a folha sai no papel. Esconde a moldura do painel
 * (menu, topo, grão) sem depender das classes dela.
 */
export function PrintStyles() {
  return (
    <style>{`
@media print {
  @page { size: A4; margin: 12mm 12mm 14mm; }
  html, body { background: #fff !important; color: #0b0b0b !important; color-scheme: light; }
  body *:not(:has(.zro-print)):not(.zro-print):not(.zro-print *) { display: none !important; }
  body *:has(.zro-print) {
    position: static !important; inset: auto !important; transform: none !important;
    margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important;
    max-width: none !important; min-height: 0 !important; width: auto !important;
    background: transparent !important; overflow: visible !important; filter: none !important;
  }
  .zro-print {
    margin: 0 !important; padding: 0 !important; width: auto !important; max-width: none !important;
    border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #fff !important;
  }
  .zro-no-print { display: none !important; }
  .zro-print a { color: inherit !important; text-decoration: none !important; }
  .zro-print tr, .zro-print li, .zro-avoid-break { break-inside: avoid; }
  .zro-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`}</style>
  );
}

/** A folha: papel claro na tela, A4 limpo na impressão. */
export function Paper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <article
      className={cn(
        "zro-print mx-auto w-full max-w-[210mm] rounded-[6px] bg-paper px-5 py-7 text-paper-ink shadow-[0_40px_120px_-40px_rgb(0_0_0/0.9),0_0_0_1px_rgb(255_255_255/0.08)] sm:px-[14mm] sm:py-[14mm]",
        className,
      )}
    >
      {children}
    </article>
  );
}

export function PaperHeader({ kind, code }: { kind: string; code: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-paper-ink pb-4">
      <Logo className="h-5 text-paper-ink sm:h-6" title="ZRO Filmes" />
      <div className="text-right">
        <p className="font-mono text-[10px] tracking-[0.18em] text-paper-ink uppercase">{kind}</p>
        <p className="mt-1 font-mono text-[10px] tracking-[0.12em] text-paper-mute">{code}</p>
      </div>
    </div>
  );
}

export function PaperLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("font-mono text-[9.5px] tracking-[0.18em] text-paper-mute uppercase", className)}>{children}</p>;
}

export function PaperSection({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-paper-line pt-4", className)}>
      <PaperLabel className="mb-3">{label}</PaperLabel>
      {children}
    </section>
  );
}

export function PaperFooter({ brand, instagram, email }: { brand: string; instagram?: string; email?: string }) {
  return (
    <footer className="zro-avoid-break mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-paper-ink pt-4">
      <p className="flex items-center gap-2.5 text-[12px] text-paper-ink">
        <Symbol className="size-4 shrink-0" />
        Onde tudo começa e o comum termina.
      </p>
      <p className="font-mono text-[9.5px] tracking-[0.12em] text-paper-mute uppercase">
        {[brand, instagram ? `@${instagram}` : null, email].filter(Boolean).join(" · ")}
      </p>
    </footer>
  );
}

/** Tabela da folha: filetes finos, cabeçalho em mono. */
export function PaperTable({ head, rows, widths }: { head: string[]; rows: React.ReactNode[][]; widths?: string[] }) {
  return (
    <table className="w-full border-collapse text-left text-[12.5px] leading-snug">
      {widths ? (
        <colgroup>
          {widths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
      ) : null}
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} className="border-b border-paper-line pb-2 font-mono text-[9px] font-normal tracking-[0.16em] text-paper-mute uppercase">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr key={i}>
            {cells.map((c, j) => (
              <td key={j} className="border-b border-paper-line py-2 pr-3 align-top last:pr-0">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
