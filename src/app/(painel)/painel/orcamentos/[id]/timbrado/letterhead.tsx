/**
 * Timbrado da ZRO em HTML: o mesmo desenho do PDF (src/lib/pdf/quote-document.tsx).
 * Papel branco dentro do app escuro; com Ctrl/Cmd+P sai um A4 limpo.
 * Nunca mostra custo nem margem: os dados já chegam sem isso.
 */
import { Logo, Symbol } from "@/components/brand/logo";
import { CATALOG_UNITS, optionLabel } from "@/lib/domain";
import { brl, dateLong } from "@/lib/format";
import type { QuoteDocumentData } from "@/lib/queries/quotes";
import {
  BRAND_SIGNATURE,
  QUOTE_CLOSING,
  companyLines,
  parseConditions,
  quantityLabel,
  quoteCode,
} from "@/lib/services/quotes";

const CSS = `
.lh-stage { container-type: inline-size; }
.lh-paper {
  --lh-ink: #0b0b0b; --lh-mute: #5c5c5c; --lh-soft: #8a8a8a; --lh-rule: #d4d4d1; --lh-hair: #e6e6e3;
  display: flex; flex-direction: column;
  width: 100%; max-width: 210mm; margin-inline: auto;
  padding: 8cqw 7cqw 6cqw;
  background: #fff; color: var(--lh-ink);
  font-family: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  font-size: 9.5pt; line-height: 1.5; text-align: left;
  border-radius: 3px;
  box-shadow: 0 40px 120px -40px rgb(0 0 0 / 0.95), 0 0 0 1px rgb(255 255 255 / 0.06);
  -webkit-font-smoothing: antialiased;
  print-color-adjust: exact; -webkit-print-color-adjust: exact;
}
.lh-paper ::selection { background: #0b0b0b; color: #fff; }
.lh-paper h1, .lh-paper h2, .lh-paper p, .lh-paper dl, .lh-paper dd, .lh-paper ol { margin: 0; }
.lh-mono { font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: 6.5pt; font-weight: 400; letter-spacing: 0.17em; text-transform: uppercase; color: var(--lh-soft); line-height: 1.3; }
.lh-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.lh-logo { width: 76pt; height: auto; color: var(--lh-ink); display: block; }
.lh-top-meta { text-align: right; }
.lh-code { display: block; margin-top: 4pt; font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: 8.5pt; letter-spacing: 0.03em; color: var(--lh-ink); }
.lh-hero { margin-top: 60pt; }
.lh-kicker { display: flex; align-items: center; gap: 7pt; }
.lh-dot { width: 4pt; height: 4pt; flex: none; border-radius: 50%; background: var(--lh-ink); }
.lh-title { margin-top: 12pt !important; font-size: 23pt; font-weight: 600; letter-spacing: -0.026em; line-height: 1.15; color: var(--lh-ink); text-wrap: balance; }
.lh-period { margin-top: 8pt !important; font-size: 10pt; color: var(--lh-mute); }
.lh-meta { display: grid; grid-template-columns: 1.7fr 1fr 1fr; gap: 14pt; margin-top: 30pt !important; padding: 12pt 0; border-top: 0.75pt solid var(--lh-ink); border-bottom: 0.5pt solid var(--lh-rule); }
.lh-meta dd { margin-top: 5pt !important; font-size: 9.5pt; line-height: 1.35; }
.lh-strong { display: block; font-size: 10pt; font-weight: 600; }
.lh-sub { display: block; font-size: 8.5pt; color: var(--lh-mute); line-height: 1.45; }
.lh-section { display: grid; grid-template-columns: 96pt minmax(0, 1fr); margin-top: 24pt; }
.lh-section > h2 { padding: 2.5pt 12pt 0 0; }
.lh-body { font-size: 9.5pt; line-height: 1.55; white-space: pre-line; }
.lh-items { margin-top: 30pt; }
.lh-items > h2 { margin-bottom: 10pt; }
.lh-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.lh-table th { padding: 0 0 6pt; text-align: left; border-bottom: 0.75pt solid var(--lh-ink); }
.lh-table td { padding: 8pt 0; border-bottom: 0.5pt solid var(--lh-hair); vertical-align: top; line-height: 1.4; }
.lh-table .lh-c-qty { width: 34pt; text-align: right; }
.lh-table .lh-c-unit { width: 62pt; padding-left: 12pt; }
.lh-table .lh-c-price { width: 80pt; text-align: right; }
.lh-table .lh-c-total { width: 84pt; text-align: right; }
.lh-table td.lh-c-unit { color: var(--lh-mute); font-size: 9pt; line-height: 1.5; }
.lh-num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.lh-desc { padding-right: 12pt !important; }
.lh-desc strong { font-weight: 500; }
.lh-detail { display: block; margin-top: 2pt; font-size: 8pt; color: var(--lh-mute); line-height: 1.45; }
.lh-calc { display: none; margin-top: 3pt; font-size: 8pt; color: var(--lh-mute); }
.lh-empty { padding: 10pt 0; font-size: 9pt; color: var(--lh-mute); }
.lh-totals { width: 230pt; max-width: 100%; margin: 14pt 0 0 auto !important; }
.lh-totals > div { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; padding: 2.5pt 0; font-size: 9pt; }
.lh-totals dt { color: var(--lh-mute); }
.lh-totals dd { margin: 0; font-variant-numeric: tabular-nums; }
.lh-totals .lh-grand { align-items: flex-end; margin-top: 6pt; padding-top: 10pt; border-top: 0.75pt solid var(--lh-ink); }
.lh-grand dt { color: var(--lh-ink); }
.lh-grand dd { font-size: 20pt; font-weight: 600; letter-spacing: -0.025em; line-height: 1; white-space: nowrap; }
.lh-conds { list-style: none; padding: 0; }
.lh-conds li { display: grid; grid-template-columns: 20pt minmax(0, 1fr); margin-bottom: 4pt; font-size: 9pt; line-height: 1.5; }
.lh-conds .lh-n { font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: 7pt; color: var(--lh-soft); padding-top: 1.7pt; }
.lh-spacer { flex: 1 1 auto; min-height: 40pt; }
.lh-foot { display: flex; justify-content: space-between; align-items: flex-start; gap: 18pt; padding-top: 10pt; border-top: 0.5pt solid var(--lh-rule); }
.lh-foot p { font-size: 6.8pt; color: var(--lh-mute); line-height: 1.55; }
.lh-sign { display: flex; align-items: center; gap: 5pt; font-size: 7.5pt; font-weight: 500; color: var(--lh-ink); white-space: nowrap; }
.lh-sign svg { width: 7pt; height: 7pt; color: var(--lh-ink); }

@container (min-width: 700px) {
  .lh-paper { min-height: 297mm; padding: 17mm 19.75mm 10.5mm; }
}
@container (max-width: 560px) {
  .lh-hero { margin-top: 40pt; }
  .lh-title { font-size: 18pt; }
  .lh-meta { grid-template-columns: 1fr 1fr; }
  .lh-meta > div:first-child { grid-column: 1 / -1; }
  .lh-section { grid-template-columns: minmax(0, 1fr); gap: 6pt; }
  .lh-table .lh-c-qty, .lh-table .lh-c-unit, .lh-table .lh-c-price { display: none; }
  .lh-calc { display: block; }
  .lh-foot { flex-direction: column; gap: 10pt; }
}

@media print {
  @page { size: A4; margin: 14mm 0 16mm; }
  html, body { background: #fff !important; }
  body *:not(:has(#zro-letterhead)):not(#zro-letterhead):not(#zro-letterhead *) { display: none !important; }
  body *:has(#zro-letterhead) {
    display: block !important; position: static !important; margin: 0 !important; padding: 0 !important;
    max-width: none !important; min-height: 0 !important; border: 0 !important; background: none !important;
    box-shadow: none !important; transform: none !important;
  }
  #zro-letterhead { max-width: none; min-height: 0; margin: 0; padding: 3mm 19.75mm 0; border-radius: 0; box-shadow: none; }
  .lh-table tr, .lh-conds li, .lh-totals, .lh-meta, .lh-foot { break-inside: avoid; }
  .lh-section > h2, .lh-items > h2, .lh-table thead { break-after: avoid; }
  .lh-spacer { min-height: 28pt; }
}
`;

export function Letterhead({ doc }: { doc: QuoteDocumentData }) {
  const code = quoteCode(doc.number, doc.version).replace(" v", " · v");
  const conditions = parseConditions(doc.conditions);

  return (
    <div className="lh-stage">
      <style>{CSS}</style>
      <article id="zro-letterhead" className="lh-paper" aria-label={`Proposta ${code}`}>
        <header className="lh-top">
          <Logo className="lh-logo" title={doc.company.brand} />
          <div className="lh-top-meta">
            <span className="lh-mono">Proposta</span>
            <span className="lh-code">{code}</span>
          </div>
        </header>

        <section className="lh-hero">
          <p className="lh-kicker">
            <span className="lh-dot" aria-hidden />
            <span className="lh-mono">Proposta de produção audiovisual</span>
          </p>
          <h1 className="lh-title">{doc.title}</h1>
          {doc.period ? <p className="lh-period">{doc.period}</p> : null}
        </section>

        <dl className="lh-meta">
          <div>
            <dt className="lh-mono">Para</dt>
            <dd>
              {doc.recipient ? (
                <>
                  <span className="lh-strong">{doc.recipient.name}</span>
                  {doc.recipient.contact ? <span className="lh-sub">A/C {doc.recipient.contact}</span> : null}
                  {doc.recipient.city ? <span className="lh-sub">{doc.recipient.city}</span> : null}
                  {doc.recipient.document ? <span className="lh-sub">{doc.recipient.document}</span> : null}
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="lh-mono">Emissão</dt>
            <dd>{dateLong(doc.issueDate)}</dd>
          </div>
          <div>
            <dt className="lh-mono">Validade</dt>
            <dd>{doc.validUntil ? dateLong(doc.validUntil) : "—"}</dd>
          </div>
        </dl>

        {doc.scope ? (
          <section className="lh-section">
            <h2 className="lh-mono">Escopo</h2>
            <p className="lh-body">{doc.scope}</p>
          </section>
        ) : null}

        <section className="lh-items">
          <h2 className="lh-mono">Investimento</h2>
          {doc.items.length ? (
            <table className="lh-table">
              <thead>
                <tr>
                  <th className="lh-mono">Descrição</th>
                  <th className="lh-mono lh-c-qty">Qtd</th>
                  <th className="lh-mono lh-c-unit">Unidade</th>
                  <th className="lh-mono lh-c-price">Valor unit.</th>
                  <th className="lh-mono lh-c-total">Total</th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((it, i) => {
                  const unit = it.unit ? optionLabel(CATALOG_UNITS, it.unit) : null;
                  return (
                    <tr key={i}>
                      <td className="lh-desc">
                        <strong>{it.description}</strong>
                        {it.detail ? <span className="lh-detail">{it.detail}</span> : null}
                        <span className="lh-calc">
                          {quantityLabel(it.quantity)}
                          {unit ? ` ${unit}` : ""} × {brl(it.unitPrice)}
                        </span>
                      </td>
                      <td className="lh-c-qty lh-num">{quantityLabel(it.quantity)}</td>
                      <td className="lh-c-unit">{unit ?? "—"}</td>
                      <td className="lh-c-price lh-num">{brl(it.unitPrice)}</td>
                      <td className="lh-c-total lh-num">{brl(it.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="lh-empty">Itens a definir.</p>
          )}

          <dl className="lh-totals">
            {doc.discount > 0 ? (
              <>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{brl(doc.subtotal)}</dd>
                </div>
                <div>
                  <dt>Desconto</dt>
                  <dd>− {brl(doc.discount)}</dd>
                </div>
              </>
            ) : null}
            <div className="lh-grand">
              <dt className="lh-mono">Total</dt>
              <dd>{brl(doc.total)}</dd>
            </div>
          </dl>
        </section>

        {doc.paymentTerms ? (
          <section className="lh-section">
            <h2 className="lh-mono">Pagamento</h2>
            <p className="lh-body">{doc.paymentTerms}</p>
          </section>
        ) : null}

        {conditions.length ? (
          <section className="lh-section">
            <h2 className="lh-mono">Condições</h2>
            <ol className="lh-conds">
              {conditions.map((c, i) => (
                <li key={i}>
                  <span className="lh-n">{String(i + 1).padStart(2, "0")}</span>
                  <span>{c}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="lh-section">
          <h2 className="lh-mono">Próximo passo</h2>
          <p className="lh-body">{QUOTE_CLOSING}</p>
        </section>

        <div className="lh-spacer" aria-hidden />

        <footer className="lh-foot">
          <div>
            {companyLines(doc.company).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <p className="lh-sign">
            <Symbol />
            {BRAND_SIGNATURE}
          </p>
        </footer>
      </article>
    </div>
  );
}
