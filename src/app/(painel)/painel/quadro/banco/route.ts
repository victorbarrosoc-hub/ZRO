import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { quadroCarregar, quadroCriar, quadroDesde, quadroMudar, type Res } from "../servidor";

/**
 * O Armazem do Quadro fala com o banco por aqui (e não por ação do servidor):
 * o endereço não muda quando o site é publicado de novo, então uma aba aberta
 * antes da atualização continua gravando.
 */
export const dynamic = "force-dynamic";

const MAX_CORPO = 1_000_000;

const json = (r: Res, status = 200) =>
  new Response(JSON.stringify(r), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** Só o próprio site chama (o cookie já é SameSite=Lax; isto fecha o resto). */
function mesmaOrigem(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    return [request.headers.get("x-forwarded-host"), request.headers.get("host")].includes(host);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!mesmaOrigem(request)) return json({ ok: false, erro: "sem_acesso" }, 403);
  const user = await getSessionUser();
  if (!user) return json({ ok: false, erro: "sem_acesso" }, 401);
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) return json({ ok: false, erro: "formato" }, 415);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_CORPO) return json({ ok: false, erro: "card_grande_demais" }, 413);

  let corpo: Record<string, unknown>;
  try {
    const texto = await request.text();
    if (texto.length > MAX_CORPO) return json({ ok: false, erro: "card_grande_demais" }, 413);
    corpo = JSON.parse(texto);
  } catch {
    return json({ ok: false, erro: "formato" }, 400);
  }
  const org = typeof corpo?.org === "string" ? corpo.org : "";

  switch (corpo?.op) {
    case "carregar":
      return json(await quadroCarregar(org));
    case "desde":
      return json(await quadroDesde(org, corpo.cursor));
    case "criar":
      return json(await quadroCriar(user.id, org, corpo.id, corpo.dados));
    case "mudar":
      return json(await quadroMudar(user.id, org, corpo.id, corpo.campos, corpo.base));
    default:
      return json({ ok: false, erro: "formato" }, 400);
  }
}
