import "server-only";
import { Document, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
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
import { FALLBACK_FONTS, registerPdfFonts, type PdfFonts } from "./fonts";
import { LOGO_PATHS, LOGO_VIEWBOX, SYMBOL_PATH } from "./logo-paths";

/* Papel: preto sobre branco, filetes finos, rótulos em mono. */
const INK = "#0B0B0B";
const MUTE = "#5C5C5C";
const SOFT = "#8A8A8A";
const RULE = "#D4D4D1";
const HAIR = "#E6E6E3";

const MARGIN_X = 56;

function makeStyles(f: PdfFonts) {
  return StyleSheet.create({
    // Sem lineHeight na página: no react-pdf 4.9, texto dinâmico (número da página)
    // herdando lineHeight num rodapé ancorado embaixo sai fora da folha.
    page: {
      paddingTop: 48,
      paddingBottom: 100,
      paddingHorizontal: MARGIN_X,
      fontFamily: f.sans,
      fontSize: 9.5,
      color: INK,
      backgroundColor: "#FFFFFF",
    },
    mono: { fontFamily: f.mono, fontSize: 6.5, letterSpacing: 1.1, textTransform: "uppercase", color: SOFT, lineHeight: 1.3 },
    top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    topMeta: { alignItems: "flex-end" },
    code: { fontFamily: f.mono, fontSize: 8.5, letterSpacing: 0.3, color: INK, marginTop: 4 },
    hero: { marginTop: 46 },
    kicker: { flexDirection: "row", alignItems: "center" },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: INK, marginRight: 7 },
    title: { fontSize: 23, fontWeight: 600, letterSpacing: -0.6, lineHeight: 1.15, marginTop: 12, color: INK },
    period: { fontSize: 10, color: MUTE, marginTop: 8, lineHeight: 1.4 },
    meta: {
      flexDirection: "row",
      marginTop: 26,
      paddingVertical: 12,
      borderTopWidth: 0.75,
      borderTopColor: INK,
      borderBottomWidth: 0.5,
      borderBottomColor: RULE,
    },
    metaWide: { flexGrow: 1.7, flexBasis: 0, paddingRight: 14 },
    metaCol: { flexGrow: 1, flexBasis: 0, paddingRight: 14 },
    metaStrong: { marginTop: 5, fontSize: 10, fontWeight: 600, color: INK, lineHeight: 1.35 },
    metaValue: { marginTop: 5, fontSize: 9.5, color: INK, lineHeight: 1.35 },
    metaSub: { fontSize: 8.5, color: MUTE, lineHeight: 1.45 },
    section: { flexDirection: "row", marginTop: 20 },
    sectionLabel: { width: 96, paddingTop: 2.5, paddingRight: 12 },
    sectionBody: { flex: 1 },
    body: { fontSize: 9.5, lineHeight: 1.55, color: INK },
    items: { marginTop: 26 },
    itemsLabel: { marginBottom: 10 },
    thead: { flexDirection: "row", paddingBottom: 6, borderBottomWidth: 0.75, borderBottomColor: INK },
    tr: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: HAIR },
    cDesc: { flex: 1, paddingRight: 12 },
    cQty: { width: 34, textAlign: "right" },
    cUnit: { width: 62, paddingLeft: 12 },
    cPrice: { width: 80, textAlign: "right" },
    cTotal: { width: 84, textAlign: "right" },
    desc: { fontSize: 9.5, fontWeight: 500, color: INK, lineHeight: 1.4 },
    detail: { fontSize: 8, color: MUTE, marginTop: 2, lineHeight: 1.45 },
    num: { fontSize: 9.5, color: INK, fontFeatureSettings: ["tnum"], lineHeight: 1.4 },
    unit: { fontSize: 9, color: MUTE, lineHeight: 1.5 },
    empty: { fontSize: 9, color: MUTE, paddingVertical: 10 },
    totals: { marginTop: 14, marginLeft: "auto", width: 230 },
    totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
    totLabel: { fontSize: 9, color: MUTE, lineHeight: 1.4 },
    totValue: { fontSize: 9, color: INK, fontFeatureSettings: ["tnum"], lineHeight: 1.4 },
    grand: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: 6,
      paddingTop: 10,
      borderTopWidth: 0.75,
      borderTopColor: INK,
    },
    grandValue: { fontSize: 20, fontWeight: 600, letterSpacing: -0.5, color: INK, lineHeight: 1 },
    condRow: { flexDirection: "row", marginBottom: 4 },
    condN: { fontFamily: f.mono, fontSize: 7, color: SOFT, width: 20, paddingTop: 1.7 },
    condText: { flex: 1, fontSize: 9, lineHeight: 1.5, color: INK },
    footer: {
      position: "absolute",
      left: MARGIN_X,
      right: MARGIN_X,
      bottom: 30,
      paddingTop: 10,
      borderTopWidth: 0.5,
      borderTopColor: RULE,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    footLeft: { flex: 1, paddingRight: 18 },
    footLine: { fontSize: 6.8, color: MUTE, lineHeight: 1.55 },
    footRight: { alignItems: "flex-end" },
    signRow: { flexDirection: "row", alignItems: "center" },
    sign: { fontSize: 7.5, fontWeight: 500, color: INK, marginLeft: 5 },
    // Nada de lineHeight aqui (ver a nota em "page").
    pageNum: { fontFamily: f.mono, fontSize: 6.5, color: SOFT, letterSpacing: 0.8, marginTop: 7 },
    continued: {
      position: "absolute",
      top: 26,
      left: MARGIN_X,
      right: MARGIN_X,
      fontFamily: f.mono,
      fontSize: 6.5,
      letterSpacing: 1.1,
      textTransform: "uppercase",
      color: SOFT,
    },
  });
}

type Styles = ReturnType<typeof makeStyles>;

function Section({ s, label, children }: { s: Styles; label: string; children: React.ReactNode }) {
  return (
    <View style={s.section} minPresenceAhead={36}>
      <View style={s.sectionLabel}>
        <Text style={s.mono}>{label}</Text>
      </View>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

export function QuoteDocument({ doc, fonts }: { doc: QuoteDocumentData; fonts: PdfFonts }) {
  const s = makeStyles(fonts);
  const code = quoteCode(doc.number, doc.version).replace(" v", " · v");
  const conditions = parseConditions(doc.conditions);
  const logoWidth = 76;
  const logoHeight = (logoWidth * LOGO_VIEWBOX.height) / LOGO_VIEWBOX.width;

  return (
    <Document
      title={`Proposta ${quoteCode(doc.number, doc.version)}${doc.recipient ? ` · ${doc.recipient.name}` : ""}`}
      author={doc.company.brand}
      subject={doc.title}
      creator={doc.company.brand}
      producer={doc.company.brand}
      language="pt-BR"
    >
      <Page size="A4" style={s.page}>
        {/* Topo */}
        <View style={s.top}>
          <Svg viewBox={`0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`} style={{ width: logoWidth, height: logoHeight }}>
            {LOGO_PATHS.map((d) => (
              <Path key={d} d={d} fill={INK} fillRule="evenodd" />
            ))}
          </Svg>
          <View style={s.topMeta}>
            <Text style={s.mono}>Proposta</Text>
            <Text style={s.code}>{code}</Text>
          </View>
        </View>

        {/* Título */}
        <View style={s.hero}>
          <View style={s.kicker}>
            <View style={s.dot} />
            <Text style={s.mono}>Proposta de produção audiovisual</Text>
          </View>
          <Text style={s.title}>{doc.title}</Text>
          {doc.period ? <Text style={s.period}>{doc.period}</Text> : null}
        </View>

        {/* Para, emissão, validade */}
        <View style={s.meta} wrap={false}>
          <View style={s.metaWide}>
            <Text style={s.mono}>Para</Text>
            {doc.recipient ? (
              <>
                <Text style={s.metaStrong}>{doc.recipient.name}</Text>
                {doc.recipient.contact ? <Text style={s.metaSub}>A/C {doc.recipient.contact}</Text> : null}
                {doc.recipient.city ? <Text style={s.metaSub}>{doc.recipient.city}</Text> : null}
                {doc.recipient.document ? <Text style={s.metaSub}>{doc.recipient.document}</Text> : null}
              </>
            ) : (
              <Text style={s.metaValue}>—</Text>
            )}
          </View>
          <View style={s.metaCol}>
            <Text style={s.mono}>Emissão</Text>
            <Text style={s.metaValue}>{dateLong(doc.issueDate)}</Text>
          </View>
          <View style={s.metaCol}>
            <Text style={s.mono}>Validade</Text>
            <Text style={s.metaValue}>{doc.validUntil ? dateLong(doc.validUntil) : "—"}</Text>
          </View>
        </View>

        {doc.scope ? (
          <Section s={s} label="Escopo">
            <Text style={s.body}>{doc.scope}</Text>
          </Section>
        ) : null}

        {/* Itens e valores (nunca custo nem margem) */}
        <View style={s.items}>
          <Text style={[s.mono, s.itemsLabel]} minPresenceAhead={80}>
            Investimento
          </Text>
          <View style={s.thead} wrap={false}>
            <Text style={[s.mono, s.cDesc]}>Descrição</Text>
            <Text style={[s.mono, s.cQty]}>Qtd</Text>
            <Text style={[s.mono, s.cUnit]}>Unidade</Text>
            <Text style={[s.mono, s.cPrice]}>Valor unit.</Text>
            <Text style={[s.mono, s.cTotal]}>Total</Text>
          </View>
          {doc.items.length ? (
            doc.items.map((it, i) => (
              // A última linha vai junto com os totais se não couberem na mesma página.
              <View key={i} style={s.tr} wrap={false} minPresenceAhead={i === doc.items.length - 1 ? (doc.discount > 0 ? 100 : 60) : undefined}>
                <View style={s.cDesc}>
                  <Text style={s.desc}>{it.description}</Text>
                  {it.detail ? <Text style={s.detail}>{it.detail}</Text> : null}
                </View>
                <Text style={[s.num, s.cQty]}>{quantityLabel(it.quantity)}</Text>
                <Text style={[s.unit, s.cUnit]}>{it.unit ? optionLabel(CATALOG_UNITS, it.unit) : "—"}</Text>
                <Text style={[s.num, s.cPrice]}>{brl(it.unitPrice)}</Text>
                <Text style={[s.num, s.cTotal]}>{brl(it.total)}</Text>
              </View>
            ))
          ) : (
            <Text style={s.empty}>Itens a definir.</Text>
          )}

          <View style={s.totals} wrap={false}>
            {doc.discount > 0 ? (
              <>
                <View style={s.totRow}>
                  <Text style={s.totLabel}>Subtotal</Text>
                  <Text style={s.totValue}>{brl(doc.subtotal)}</Text>
                </View>
                <View style={s.totRow}>
                  <Text style={s.totLabel}>Desconto</Text>
                  <Text style={s.totValue}>− {brl(doc.discount)}</Text>
                </View>
              </>
            ) : null}
            <View style={s.grand}>
              <Text style={[s.mono, { color: INK }]}>Total</Text>
              <Text style={s.grandValue}>{brl(doc.total)}</Text>
            </View>
          </View>
        </View>

        {doc.paymentTerms ? (
          <Section s={s} label="Pagamento">
            <Text style={s.body}>{doc.paymentTerms}</Text>
          </Section>
        ) : null}

        {conditions.length ? (
          <Section s={s} label="Condições">
            {conditions.map((c, i) => (
              <View key={i} style={s.condRow} wrap={false}>
                <Text style={s.condN}>{String(i + 1).padStart(2, "0")}</Text>
                <Text style={s.condText}>{c}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        <Section s={s} label="Próximo passo">
          <Text style={s.body}>{QUOTE_CLOSING}</Text>
        </Section>

        {/* Da segunda página em diante: de qual proposta é esta folha */}
        <Text
          fixed
          style={s.continued}
          render={({ pageNumber }) => (pageNumber > 1 ? `ZRO · Proposta ${code} · ${doc.title}` : "")}
        />

        {/* Rodapé em todas as páginas */}
        <View style={s.footer} fixed>
          <View style={s.footLeft}>
            {companyLines(doc.company).map((line) => (
              <Text key={line} style={s.footLine}>
                {line}
              </Text>
            ))}
          </View>
          <View style={s.footRight}>
            <View style={s.signRow}>
              <Svg viewBox="0 0 327 327" style={{ width: 7, height: 7 }}>
                <Path d={SYMBOL_PATH} fill={INK} fillRule="evenodd" />
              </Svg>
              <Text style={s.sign}>{BRAND_SIGNATURE}</Text>
            </View>
            <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
          </View>
        </View>
      </Page>
    </Document>
  );
}

/** Gera o PDF do orçamento. Se as fontes da marca falharem, sai em Helvetica. */
export async function renderQuotePdf(doc: QuoteDocumentData): Promise<Buffer> {
  const fonts = registerPdfFonts();
  try {
    return await renderToBuffer(<QuoteDocument doc={doc} fonts={fonts} />);
  } catch (e) {
    if (fonts.sans === FALLBACK_FONTS.sans) throw e;
    console.error("[pdf] Falhou com as fontes da marca; tentando com Helvetica.", e);
    return renderToBuffer(<QuoteDocument doc={doc} fonts={FALLBACK_FONTS} />);
  }
}
