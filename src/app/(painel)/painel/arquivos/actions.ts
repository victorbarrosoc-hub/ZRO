"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, str, type ActionResult } from "@/lib/actions";
import { requireUser } from "@/lib/auth/dal";
import { idDriveValido, nomePasta } from "@/lib/drive/nomes";
import { driveConectado } from "@/lib/google/conexao";
import { arquivoOuNull, criarPasta } from "@/lib/google/drive";
import { GoogleError } from "@/lib/google/erros";

/**
 * Arquivos (docs/dev/drive.md §7.1): "Nova pasta" dentro da pasta aberta no Drive da ZRO.
 * O envio de arquivos não passa por aqui: vai pela rota fixa /painel/arquivos/api (motor no navegador).
 */

const NovaPasta = z.object({
  paiId: z.string().refine((v) => idDriveValido(v), "Pasta não encontrada."),
  nome: z.string({ message: "Digite o nome da pasta." }).trim().min(1, "Digite o nome da pasta.").max(120, "Nome longo demais."),
});

function mensagemGoogle(e: unknown): string {
  if (e instanceof GoogleError) {
    if (e.motivo === "sem_google" || e.motivo === "sem_config") return "Google Drive desconectado. Conecte em Ajustes.";
    if (e.motivo === "reconectar") return "A conexão com o Google expirou. Reconecte em Ajustes.";
    if (e.motivo === "pasta" || e.motivo === "nao_encontrado") return "Esta pasta não existe mais no Drive.";
    if (e.motivo === "sem_permissao") return "A conta conectada não pode criar pastas aqui.";
    if (e.motivo === "sem_espaco") return "O Drive está cheio. Libere espaço e tente de novo.";
  }
  return "O Google não respondeu. Tente de novo.";
}

export async function criarPastaAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = NovaPasta.safeParse({ paiId: str(fd, "paiId"), nome: str(fd, "nome") });
  if (!parsed.success) {
    const erro = parsed.error.issues[0]?.message ?? "Confira o nome.";
    return fail(erro, { nome: [erro] });
  }
  if (!(await driveConectado())) return fail("Google Drive desconectado. Conecte em Ajustes.");
  const nome = nomePasta(parsed.data.nome);
  try {
    const pai = await arquivoOuNull(parsed.data.paiId);
    if (!pai || !pai.pasta || pai.lixeira) return fail("Esta pasta não existe mais no Drive.");
    if (!pai.podeAdicionar) return fail("A conta conectada não pode criar pastas aqui.");
    const id = await criarPasta(nome, pai.id);
    revalidatePath("/painel/arquivos");
    return ok(`Pasta “${nome}” criada.`, id);
  } catch (e) {
    return fail(mensagemGoogle(e));
  }
}
