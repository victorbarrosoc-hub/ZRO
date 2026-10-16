"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, str, type ActionResult } from "@/lib/actions";
import { requireUser } from "@/lib/auth/dal";
import { CLIENTES } from "@/lib/drive/estrutura";
import { idDePastaDoLink, nomePasta } from "@/lib/drive/nomes";
import { contaAtual, desconectar, salvarRaiz } from "@/lib/google/conexao";
import { arquivoOuNull } from "@/lib/google/drive";
import { GoogleError } from "@/lib/google/erros";
import { darAcessoEquipe, tirarAcessoEquipe } from "@/lib/services/drive-entregas";
import { garantirPasta, garantirPastasDoProjeto, projetosAtivosSemPasta } from "@/lib/services/drive-pastas";

const CAMINHO = "/painel/ajustes/google";

function mensagemGoogle(e: unknown): string {
  if (e instanceof GoogleError) {
    if (e.motivo === "sem_google" || e.motivo === "sem_config") return "Conecte o Google Drive primeiro.";
    if (e.motivo === "reconectar") return "A conexão com o Google expirou. Reconecte.";
    if (e.motivo === "sem_permissao") return "A conta conectada não pode criar pastas aí.";
  }
  return "O Google não respondeu. Tente de novo.";
}

export async function desconectarGoogleAction(): Promise<ActionResult> {
  const user = await requireUser();
  await desconectar(user.id);
  revalidatePath(CAMINHO);
  revalidatePath("/painel", "layout");
  return ok("Google Drive desconectado.");
}

/** Nome (cria em Meu Drive) ou link de uma pasta que a conta conectada pode editar. */
export async function salvarPastaRaizAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const valor = str(fd, "pasta");
  if (!valor || valor.length > 300) return fail("Digite o nome ou cole o link da pasta.", { pasta: ["Digite o nome ou cole o link da pasta."] });
  if (!(await contaAtual())) return fail("Conecte o Google Drive primeiro.");
  try {
    const doLink = /drive\.google\.com|^https?:\/\//i.test(valor) ? idDePastaDoLink(valor) : null;
    if (/^https?:\/\//i.test(valor) && !doLink) return fail("Esse link não é de uma pasta do Drive.", { pasta: ["Esse link não é de uma pasta do Drive."] });
    let raizId: string;
    let raizNome: string;
    if (doLink) {
      const a = await arquivoOuNull(doLink);
      if (!a || !a.pasta || a.lixeira) return fail("A pasta não abre na conta conectada.", { pasta: ["A pasta não abre na conta conectada."] });
      if (!a.podeAdicionar) return fail("A conta conectada não pode criar nada nessa pasta.");
      raizId = a.id;
      raizNome = a.nome;
    } else {
      raizNome = nomePasta(valor);
      raizId = await garantirPasta("root", raizNome);
    }
    const clientesId = await garantirPasta(raizId, CLIENTES);
    await salvarRaiz({ raizId, clientesId, raizNome });
  } catch (e) {
    return fail(mensagemGoogle(e));
  }
  revalidatePath(CAMINHO);
  return ok("Pasta raiz trocada. Os projetos que já têm pasta ficam onde estão.");
}

export async function darAcessoEquipeAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const email = str(fd, "email") ?? "";
  if (!z.email().safeParse(email.toLowerCase()).success) return fail("Digite um e-mail válido.", { email: ["Digite um e-mail válido."] });
  const r = await darAcessoEquipe(email, user.id);
  if (!r.ok) return fail(r.mensagem);
  revalidatePath(CAMINHO);
  return ok("Acesso dado.");
}

export async function tirarAcessoEquipeAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(fd, "id");
  if (!id) return fail("Acesso não encontrado.");
  try {
    await tirarAcessoEquipe(id, user.id);
  } catch (e) {
    return fail(mensagemGoogle(e));
  }
  revalidatePath(CAMINHO);
  return ok("Acesso removido.");
}

/** Até 10 projetos ativos sem pasta, depois da resposta. */
export async function criarPastasAtivosAction(): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await contaAtual())) return fail("Conecte o Google Drive primeiro.");
  const projetos = await projetosAtivosSemPasta(10);
  if (!projetos.length) return ok("Todos os projetos ativos já têm pasta.");
  after(async () => {
    for (const p of projetos) await garantirPastasDoProjeto(p.id, { userId: user.id }).catch(() => undefined);
  });
  revalidatePath(CAMINHO);
  return ok(projetos.length === 1 ? "Criando em segundo plano: 1 projeto." : `Criando em segundo plano: ${projetos.length} projetos.`);
}
