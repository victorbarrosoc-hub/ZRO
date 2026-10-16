import "server-only";
import type { NextRequest } from "next/server";
import { usuarioDaRequisicao } from "@/lib/auth/requisicao";
import { linkArquivo } from "@/lib/google/drive";
import { GoogleError } from "@/lib/google/erros";
import { ehPrevia } from "@/lib/google/previa";
import { buscarLinkPorToken, COOKIE_AREA, cookieDaAreaValido, estadoDoLink } from "@/lib/services/drive-links";
import { acessoParaStream, acharProxy, entregaDaArea, miniatura } from "@/lib/services/drive-previa";
import { ipDe, permitirIp } from "./limites";
import { idDriveValido } from "./nomes";

/**
 * Rotas da prévia (docs/dev/drive.md §16). Endereço fixo, como as de envio. Todas respondem sem cache
 * compartilhado: miniatura com `private` (curto), o resto com `no-store`.
 *
 *   GET /painel/arquivos/miniatura/<id>?s=640   login; arquivo que a conta conectada enxerga
 *   GET /painel/arquivos/token                  login + X-ZRO-Stream: 1; só o token de acesso (curto)
 *   GET /painel/arquivos/proxy/<id>             login; o proxy de câmera do arquivo, ou null
 *   GET /painel/stream/arquivo/<id>             reserva sem service worker: redireciona para o Google
 *   GET /cliente/<token>/miniatura/<id>?s=640   link ativo, senha (cookie), arquivo em 06 Entregas liberado
 */

type Ctx = { params: Promise<{ id: string }> };
type CtxCliente = { params: Promise<{ token: string; id: string }> };

function json(corpo: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

function nada(status: number): Response {
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

function imagem(m: { bytes: Uint8Array; tipo: string }, maxAge: number): Response {
  return new Response(m.bytes as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": m.tipo,
      "Content-Length": String(m.bytes.length),
      "Cache-Control": `private, max-age=${maxAge}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

function tamanhoPedido(request: NextRequest): number {
  const s = Number(request.nextUrl.searchParams.get("s"));
  return Number.isFinite(s) && s > 0 ? Math.min(2000, s) : 320;
}

/** Miniatura no painel: só logado, só id válido, só o que a conta conectada enxerga. */
export function rotaMiniaturaPainel() {
  return async (request: NextRequest, ctx: Ctx): Promise<Response> => {
    if (!(await usuarioDaRequisicao(request))) return nada(401);
    const { id } = await ctx.params;
    if (!idDriveValido(id) || id === "root") return nada(404);
    try {
      const m = await miniatura(id, tamanhoPedido(request));
      return m ? imagem(m, 300) : nada(404);
    } catch {
      return nada(502);
    }
  };
}

/**
 * Token de acesso para o service worker do painel (que lê o vídeo direto do Google com Range).
 * Só logado, só com o cabeçalho X-ZRO-Stream (outro site não consegue mandar sem CORS) e só do mesmo site.
 * Devolve o token de acesso (curto), nunca o refresh token. no-store.
 */
export function rotaTokenStream() {
  return async (request: NextRequest): Promise<Response> => {
    if (request.headers.get("x-zro-stream") !== "1") return json({ ok: false, motivo: "formato" }, 400);
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin") return json({ ok: false, motivo: "origem" }, 403);
    if (!(await usuarioDaRequisicao(request))) return json({ ok: false, motivo: "sessao" }, 401);
    try {
      const a = await acessoParaStream();
      return json({ ok: true, token: a.token, expiraEm: a.expiraEm, api: a.api });
    } catch (e) {
      if (e instanceof GoogleError && (e.motivo === "reconectar" || e.motivo === "sem_google" || e.motivo === "sem_config")) {
        return json({ ok: false, motivo: "reconectar" }, 409);
      }
      return json({ ok: false, motivo: "google" }, 503);
    }
  };
}

/** Proxy de câmera de um bruto (painel). */
export function rotaProxyPainel() {
  return async (request: NextRequest, ctx: Ctx): Promise<Response> => {
    if (!(await usuarioDaRequisicao(request))) return json({ ok: false, motivo: "sessao" }, 401);
    const { id } = await ctx.params;
    if (!idDriveValido(id) || id === "root") return json({ ok: false, motivo: "formato" }, 400);
    try {
      return json({ ok: true, proxy: await acharProxy(id) });
    } catch {
      return json({ ok: false, motivo: "google" }, 503);
    }
  };
}

/**
 * /painel/stream/arquivo/<id> sem o service worker (primeira visita, navegador sem SW): manda para o próprio
 * Google (baixar ou ver). Nenhum byte passa pela Vercel.
 */
export function rotaStreamReserva() {
  return async (request: NextRequest, ctx: Ctx): Promise<Response> => {
    if (!(await usuarioDaRequisicao(request))) return nada(401);
    const { id } = await ctx.params;
    if (!idDriveValido(id) || id === "root") return nada(404);
    const destino =
      request.nextUrl.searchParams.get("baixar") === "1"
        ? `https://drive.google.com/uc?id=${encodeURIComponent(id)}&export=download`
        : linkArquivo(id);
    return new Response(null, { status: 302, headers: { Location: destino, "Cache-Control": "no-store" } });
  };
}

/**
 * Miniatura na área do cliente. Ordem: prévia → limite por IP → link (formato, tipo, ativo) → senha (cookie)
 * → o arquivo está em 06 Entregas de um projeto deste cliente com entregas liberadas → miniatura.
 * Qualquer recusa é 404 (não diz se o arquivo existe).
 */
export function rotaMiniaturaCliente() {
  return async (request: NextRequest, ctx: CtxCliente): Promise<Response> => {
    if (ehPrevia()) return nada(404);
    if (!permitirIp(ipDe(request.headers), "envio")) return nada(429);
    const { token, id } = await ctx.params;
    try {
      const link = await buscarLinkPorToken(token, "cliente-area");
      if (!link || estadoDoLink(link) !== "ativo" || !link.clientId) return nada(404);
      if (link.senhaHash && !(await cookieDaAreaValido(request.cookies.get(COOKIE_AREA)?.value, link))) return nada(404);
      const e = await entregaDaArea(link, id);
      if (!e) return nada(404);
      const m = await miniatura(e.id, tamanhoPedido(request));
      return m ? imagem(m, 120) : nada(404);
    } catch {
      return nada(502);
    }
  };
}
