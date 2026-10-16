import { timingSafeEqual } from "node:crypto";
import { jwtDecrypt } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { dadosDaConexao, salvarConexao } from "@/lib/google/conexao";
import { chaveDerivada } from "@/lib/google/cripto";
import { sobre } from "@/lib/google/drive";
import { GoogleError } from "@/lib/google/erros";
import { COOKIE_OAUTH, escopoTemDrive, revogar, trocarCodigo } from "@/lib/google/oauth";
import { paraOficial } from "@/lib/google/previa";
import { contaTemPastas, garantirRaiz } from "@/lib/services/drive-pastas";

/**
 * Volta do consentimento do Google. Confere a sessão do painel, o state (tempo constante), o
 * refresh token e o escopo exato. Outra conta com pastas já criadas: não grava e pede confirmação.
 */
export const dynamic = "force-dynamic";

type DadosCookie = { s: string; v: string; u: string; t: boolean };

function igual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(request: NextRequest) {
  const previa = paraOficial(request);
  if (previa) return previa;
  const url = new URL(request.url);
  const voltar = (q: string) => {
    const res = NextResponse.redirect(new URL(`/painel/ajustes/google${q}`, url.origin), 303);
    res.headers.set("Cache-Control", "no-store");
    res.cookies.set(COOKIE_OAUTH, "", { path: "/api/google", maxAge: 0, httpOnly: true, sameSite: "lax" });
    return res;
  };

  const user = await getSessionUser();
  let dados: DadosCookie | null = null;
  try {
    const bruto = request.cookies.get(COOKIE_OAUTH)?.value;
    if (bruto) {
      const { payload } = await jwtDecrypt(bruto, chaveDerivada("zro:google-oauth"));
      if (typeof payload.s === "string" && typeof payload.v === "string" && typeof payload.u === "string") {
        dados = { s: payload.s, v: payload.v, u: payload.u, t: payload.t === true };
      }
    }
  } catch {
    dados = null;
  }
  if (!user || !dados || dados.u !== user.id) return voltar("?erro=sessao");
  if (!igual(url.searchParams.get("state") ?? "", dados.s)) return voltar("?erro=estado");
  if (url.searchParams.get("error")) return voltar("?erro=negado");
  const code = url.searchParams.get("code");
  if (!code) return voltar("?erro=negado");

  let troca: Awaited<ReturnType<typeof trocarCodigo>>;
  try {
    troca = await trocarCodigo(code, dados.v);
  } catch {
    return voltar("?erro=troca");
  }
  if (!troca.refresh) return voltar("?erro=sem_refresh");
  if (!escopoTemDrive(troca.escopo)) {
    await revogar(troca.refresh);
    return voltar("?erro=permissao");
  }

  let conta: { email: string; nome: string | null };
  try {
    conta = await sobre(troca.acesso);
  } catch (err) {
    // 403 logo depois de um consentimento válido: quase sempre a Google Drive API desligada no projeto.
    if (err instanceof GoogleError && err.motivo === "sem_permissao") return voltar("?erro=api");
    return voltar("?erro=troca");
  }
  if (!conta.email) return voltar("?erro=estado");

  const atual = await dadosDaConexao();
  const outraConta = Boolean(atual?.conta) && atual!.conta !== conta.email;
  if (outraConta && !dados.t && (await contaTemPastas(atual!.conta!))) {
    await revogar(troca.refresh); // nada é gravado: a conta de antes continua conectada
    return voltar(`?erro=outra_conta&nova=${encodeURIComponent(conta.email)}`);
  }

  await salvarConexao({
    refresh: troca.refresh,
    conta: conta.email,
    nome: conta.nome,
    escopo: troca.escopo,
    userId: user.id,
    trocar: outraConta,
  });
  try {
    await garantirRaiz();
  } catch {
    // A raiz nasce no primeiro uso; a conexão já vale.
  }
  return voltar("?ok=1");
}
