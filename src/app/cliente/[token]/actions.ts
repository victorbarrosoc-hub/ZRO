"use server";

import { decodeJwt } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ehPrevia } from "@/lib/google/previa";
import {
  assinarCookieDaArea,
  buscarLinkPorToken,
  COOKIE_AREA,
  cookieDaAreaValido,
  entrarNaArea,
  estadoDoLink,
  opcoesDoCookieDaArea,
} from "@/lib/services/drive-links";

/**
 * Senha da área do cliente (Server Actions públicas, docs/dev/drive.md §8.3). As tentativas, o tempo
 * constante e o cookie ficam em `entrarNaArea` (BASE).
 * - "pagina": a tela "Digite a senha." → volta para a própria área.
 * - "modal": a senha caiu no meio de um envio → sem redirecionar (a fila continua na tela).
 */

export type EstadoSenha = { ok: boolean; erro: string | null } | undefined;

const ERROS = {
  senha: "A senha não confere. Confira com quem te mandou o link.",
  muitas_tentativas: "Muitas tentativas. Espere 15 minutos e tente de novo.",
  inativo: "Esta área não está mais ativa.",
} as const;

const Pedido = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  senha: z.string().min(1).max(200),
});

export async function entrarAction(token: string, modo: "pagina" | "modal", _prev: EstadoSenha, fd: FormData): Promise<EstadoSenha> {
  const senha = fd.get("senha");
  if (typeof senha !== "string" || !senha) return { ok: false, erro: "Digite a senha." };
  const r = Pedido.safeParse({ token, senha });
  if (!r.success || ehPrevia()) return { ok: false, erro: ERROS.inativo };
  const res = await entrarNaArea(r.data.token, r.data.senha);
  if (!res.ok) return { ok: false, erro: ERROS[res.erro] };
  if (modo === "pagina") redirect(`/cliente/${r.data.token}`);
  return { ok: true, erro: null };
}

const UM_DIA_S = 24 * 60 * 60;

/**
 * Validade deslizante do acesso também para quem só abre a área para baixar: com o cookie certo,
 * assina outro de 30 dias (no máximo uma vez por dia). Sem cookie válido, não faz nada.
 */
export async function renovarAcessoAction(token: string): Promise<void> {
  if (ehPrevia() || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  const link = await buscarLinkPorToken(token, "cliente-area");
  if (!link?.senhaHash || estadoDoLink(link) !== "ativo") return;
  const jar = await cookies();
  const valor = jar.get(COOKIE_AREA)?.value;
  if (!valor || !(await cookieDaAreaValido(valor, link))) return;
  let emitidoEm = 0;
  try {
    emitidoEm = Number(decodeJwt(valor).iat ?? 0);
  } catch {
    emitidoEm = 0;
  }
  if (emitidoEm && Date.now() / 1000 - emitidoEm < UM_DIA_S) return;
  jar.set(COOKIE_AREA, await assinarCookieDaArea(link), opcoesDoCookieDaArea(token));
}
