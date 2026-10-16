import "server-only";
import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { origensPermitidas } from "@/lib/google/config";
import { ehPrevia } from "@/lib/google/previa";
import {
  abrirLote,
  cancelarEnvios,
  conferirEnvios,
  diagnosticoEnvio,
  fecharLote,
  iniciarArquivos,
  type Escopo,
} from "@/lib/services/drive-envios";
import {
  assinarCookieDaArea,
  buscarLinkPorToken,
  COOKIE_AREA,
  cookieDaAreaValido,
  opcoesDoCookieDaArea,
  type TipoLink,
} from "@/lib/services/drive-links";
import { ipDe, permitirIp } from "./limites";
import { ehOp, esquemas, MAX_CORPO, respErro, STATUS_DO_ERRO, type Pedido, type RespErro, type Voz } from "./protocolo";

/**
 * As três rotas de envio (endereço fixo, padrão de quadro/banco/route.ts: uma aba aberta antes de um
 * deploy continua funcionando). Ordem das checagens: prévia → Origin → Content-Type/tamanho →
 * limite por IP → sessão ou token (e cookie da área) → zod → serviço.
 */

type Resposta = { ok: boolean } & Record<string, unknown>;

function json(corpo: Resposta, status = 200, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

function erro(r: RespErro, status?: number): Response {
  return json(r, status ?? STATUS_DO_ERRO[r.erro] ?? 400);
}

/** Origin presente, do mesmo host da requisição e na lista. */
function origemValida(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return null;
  }
  const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")].filter(Boolean);
  if (!hosts.includes(u.host)) return null;
  return origensPermitidas().includes(u.origin) ? u.origin : null;
}

type Lido = { ok: true; pedido: Pedido } | { ok: false; resposta: Response };

/** Content-Type, tamanho e zod. */
async function lerPedido(request: NextRequest, voz: Voz): Promise<Lido> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return { ok: false, resposta: erro(respErro("formato", voz), 415) };
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_CORPO) {
    return { ok: false, resposta: erro(respErro("formato", voz, "Pedido grande demais."), 413) };
  }
  let texto: string;
  try {
    texto = await request.text();
  } catch {
    return { ok: false, resposta: erro(respErro("formato", voz), 400) };
  }
  if (texto.length > MAX_CORPO) return { ok: false, resposta: erro(respErro("formato", voz, "Pedido grande demais."), 413) };
  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return { ok: false, resposta: erro(respErro("formato", voz), 400) };
  }
  const op = (corpo as { op?: unknown } | null)?.op;
  if (!ehOp(op)) return { ok: false, resposta: erro(respErro("formato", voz), 400) };
  const r = esquemas[op].safeParse(corpo);
  if (!r.success) {
    const consentimento = r.error.issues.some((i) => i.path.includes("consentimento"));
    return { ok: false, resposta: erro(respErro(consentimento ? "consentimento" : "formato", voz), 400) };
  }
  return { ok: true, pedido: r.data as Pedido };
}

async function despachar(pedido: Pedido, escopo: Escopo, origem: string): Promise<Response> {
  const voz: Voz = escopo.origem === "painel" ? "painel" : "publico";
  let r: Resposta | RespErro;
  switch (pedido.op) {
    case "lote":
      r = await abrirLote(pedido, escopo, origem);
      break;
    case "iniciar":
      r = await iniciarArquivos(pedido, escopo, origem);
      break;
    case "conferir":
      r = await conferirEnvios(pedido, escopo);
      break;
    case "cancelar":
      r = await cancelarEnvios(pedido, escopo);
      break;
    case "fecharLote":
      r = await fecharLote(pedido, escopo);
      break;
    case "diagnostico":
      if (escopo.origem !== "painel") return erro(respErro("sem_acesso", voz), 403);
      r = await diagnosticoEnvio(pedido, escopo);
      break;
  }
  return r.ok ? json(r as Resposta) : erro(r as RespErro);
}

function falhaInesperada(e: unknown, voz: Voz): Response {
  console.error("[drive]", "rota", e instanceof Error ? e.name : "erro");
  return erro(respErro("google", voz), 503);
}

/** POST /painel/arquivos/api (sessão do painel). Serve Arquivos e o teste de Ajustes. */
export function rotaEnvioPainel(): (request: NextRequest) => Promise<Response> {
  return async (request) => {
    const voz: Voz = "painel";
    const origem = origemValida(request);
    if (!origem) return erro(respErro("sem_acesso", voz), 403);
    const lido = await lerPedido(request, voz);
    if (!lido.ok) return lido.resposta;
    if (!permitirIp(ipDe(request.headers), "envio")) return erro(respErro("muitas_tentativas", voz), 429);
    const user = await getSessionUser();
    if (!user) return erro(respErro("sem_acesso", voz), 401);
    try {
      return await despachar(lido.pedido, { origem: "painel", userId: user.id }, origem);
    } catch (e) {
      return falhaInesperada(e, voz);
    }
  };
}

/** POST /enviar/<token>/api (freela) e /cliente/<token>/api (cliente). */
export function rotaEnvioPublica(
  tipo: TipoLink,
): (request: NextRequest, ctx: { params: Promise<{ token: string }> }) => Promise<Response> {
  return async (request, ctx) => {
    const voz: Voz = "publico";
    if (ehPrevia()) return new Response("Not Found", { status: 404 });
    const origem = origemValida(request);
    if (!origem) return erro(respErro("sem_acesso", voz), 403);
    const lido = await lerPedido(request, voz);
    if (!lido.ok) return lido.resposta;
    if (!permitirIp(ipDe(request.headers), "envio")) return erro(respErro("muitas_tentativas", voz), 429);
    const { token } = await ctx.params;
    try {
      const link = await buscarLinkPorToken(token, tipo);
      if (!link) return erro(respErro("nao_encontrado", voz), 404);
      if (tipo === "freela-diaria") return await despachar(lido.pedido, { origem: "freela", link }, origem);

      if (!link.clientId) return erro(respErro("link_inativo", voz), 409);
      // Senha: o cookie só é exigido para abrir lote e iniciar arquivos. conferir, cancelar e
      // fecharLote seguem sem ele (o envioId é do próprio link): um envio longo nunca para no meio.
      const cookie = request.cookies.get(COOKIE_AREA)?.value;
      const cookieOk = link.senhaHash ? await cookieDaAreaValido(cookie, link) : false;
      if (link.senhaHash && !cookieOk && (lido.pedido.op === "lote" || lido.pedido.op === "iniciar")) {
        return erro(respErro("senha", voz), 403);
      }
      const resposta = await despachar(lido.pedido, { origem: "cliente", link, clientId: link.clientId }, origem);
      if (cookieOk && resposta.ok) {
        // Validade deslizante: 30 dias a partir do último uso.
        const o = opcoesDoCookieDaArea(token);
        const partes = [
          `${COOKIE_AREA}=${await assinarCookieDaArea(link)}`,
          `Path=${o.path}`,
          `Max-Age=${o.maxAge}`,
          "HttpOnly",
          "SameSite=Lax",
          ...(o.secure ? ["Secure"] : []),
        ];
        resposta.headers.append("Set-Cookie", partes.join("; "));
      }
      return resposta;
    } catch (e) {
      return falhaInesperada(e, voz);
    }
  };
}
