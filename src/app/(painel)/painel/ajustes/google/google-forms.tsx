"use client";

import { FolderPlus, LogOut, Plug, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ConfirmAction, fieldError, FormModal } from "@/components/painel/form";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ehAppDaTela } from "@/lib/drive/navegador/plataforma";
import {
  criarPastasAtivosAction,
  darAcessoEquipeAction,
  desconectarGoogleAction,
  salvarPastaRaizAction,
  tirarAcessoEquipeAction,
} from "./actions";

const semAssinatura = () => () => {};

/**
 * "Conectar Google": um <a> (e não Link) porque a rota redireciona para o Google.
 * No app da tela de início, o consentimento abriria fora do app e o cookie se perderia.
 */
export function ConectarGoogle({ rotulo = "Conectar Google", trocar = false }: { rotulo?: string; trocar?: boolean }) {
  // Só o navegador sabe se é o app da tela de início (no servidor: não é).
  const noApp = useSyncExternalStore(semAssinatura, ehAppDaTela, () => false);
  if (noApp) return <p className="text-[13px] text-ash">Para conectar, abra esta página no Safari ou no computador (não pelo app da tela de início).</p>;
  return (
    <a href={trocar ? "/api/google/conectar?trocar=1" : "/api/google/conectar"} className={buttonClasses({ variant: "primary" })}>
      {rotulo === "Reconectar" ? <RefreshCw aria-hidden /> : <Plug aria-hidden />} {rotulo}
    </a>
  );
}

export function DesconectarGoogle({ enviando }: { enviando: number }) {
  const extra = enviando > 0 ? ` ${enviando === 1 ? "1 envio em andamento vai parar." : `${enviando} envios em andamento vão parar.`}` : "";
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost">
          <LogOut aria-hidden /> Desconectar
        </Button>
      }
      title="Desconectar o Google Drive?"
      description={`Links e área do cliente param até conectar de novo. Nada é apagado do Drive.${extra}`}
      confirmLabel="Desconectar"
      action={desconectarGoogleAction}
      fields={{}}
    />
  );
}

export function PastaRaizForm() {
  return (
    <FormModal
      trigger={<Button variant="secondary">Trocar</Button>}
      title="Pasta raiz"
      description="Os projetos que já têm pasta ficam onde estão."
      action={salvarPastaRaizAction}
      submitLabel="Salvar"
    >
      {(state) => (
        <Field label="Nome ou link da pasta" htmlFor="pasta-raiz" error={fieldError(state, "pasta")} hint="Nome: a pasta nasce em Meu Drive. Link: a pasta precisa aceitar arquivos.">
          <Input id="pasta-raiz" name="pasta" placeholder="ZRO" autoComplete="off" required />
        </Field>
      )}
    </FormModal>
  );
}

export function AcessoEquipeForm() {
  return (
    <FormModal
      trigger={
        <Button variant="secondary">
          <UserPlus aria-hidden /> Dar acesso
        </Button>
      }
      title="Acesso da equipe"
      description="Edição na pasta raiz para um e-mail Google. Sem e-mail de aviso."
      action={darAcessoEquipeAction}
      submitLabel="Dar acesso"
    >
      {(state) => (
        <Field label="E-mail Google" htmlFor="acesso-email" error={fieldError(state, "email")}>
          <Input id="acesso-email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="nome@gmail.com" required />
        </Field>
      )}
    </FormModal>
  );
}

export function TirarAcessoEquipe({ id, email }: { id: string; email: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon" aria-label={`Remover o acesso de ${email}`}>
          <Trash2 aria-hidden />
        </Button>
      }
      title="Remover o acesso?"
      description={`${email} deixa de editar a pasta raiz. Nada é apagado do Drive.`}
      confirmLabel="Remover"
      action={tirarAcessoEquipeAction}
      fields={{ id }}
    />
  );
}

export function CriarPastasAtivos({ total }: { total: number }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="secondary">
          <FolderPlus aria-hidden /> Criar pastas dos projetos ativos
        </Button>
      }
      title="Criar as pastas no Drive?"
      description={`${total > 10 ? "Os 10 primeiros" : total === 1 ? "O projeto" : `Os ${total} projetos`} ganham a estrutura padrão. Projeto com link do Drive usa a pasta do link.`}
      confirmLabel="Criar pastas"
      destructive={false}
      action={criarPastasAtivosAction}
      fields={{}}
    />
  );
}

/** Aviso de "Google conectado." depois do retorno do Google (e limpa o endereço). */
export function AvisoConectado() {
  const router = useRouter();
  useEffect(() => {
    toast.success("Google conectado.");
    router.replace("/painel/ajustes/google", { scroll: false });
  }, [router]);
  return null;
}
