"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  CalendarClock,
  Copy,
  Ellipsis,
  FolderPlus,
  Link2,
  Link2Off,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { ActionForm, ConfirmAction, fieldError, FormModal, SubmitButton } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Modal, ModalContent, ModalTrigger } from "@/components/ui/overlay";
import type { ActionResult } from "@/lib/actions";
import { todayISO } from "@/lib/format";
import {
  apagarPastaAction,
  criarPastasAction,
  desativarLinkAction,
  envioDaDiaria,
  liberarEntregasAction,
  recolherEntregasAction,
  trocarLinkAction,
  validadeLinkAction,
} from "../../drive-actions";
import { copyText } from "../_tabs/documentos-client";

type ServerAction = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/* ============================== Peças comuns ============================== */

/** Copia um texto e avisa (com plano B para navegador sem a API de área de transferência). */
export function CopiarBotao({
  texto,
  rotulo = "Copiar link",
  feito = "Link copiado.",
  variant = "secondary",
  icone = "link",
}: {
  texto: string;
  rotulo?: string;
  feito?: string;
  variant?: "primary" | "secondary" | "ghost" | "subtle";
  icone?: "link" | "whatsapp";
}) {
  return (
    <Button
      variant={variant}
      size="sm"
      className="h-10 sm:h-8"
      onClick={async () => {
        if (await copyText(texto)) toast.success(feito);
        else toast.error("Não deu para copiar. Selecione o texto e copie à mão.");
      }}
    >
      {icone === "whatsapp" ? <MessageCircle aria-hidden /> : <Copy aria-hidden />} {rotulo}
    </Button>
  );
}

/** Abre o WhatsApp com o texto pronto (sem destinatário: a pessoa escolhe a conversa). */
export function WhatsAppTexto({ texto, rotulo = "WhatsApp", telefone }: { texto: string; rotulo?: string; telefone?: string | null }) {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  const numero = digitos ? (digitos.startsWith("55") ? digitos : `55${digitos}`) : "";
  return (
    <a
      href={`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-white/[0.02] px-3.5 text-[13px] font-medium text-light transition-colors hover:border-white/30 hover:bg-white/[0.06] sm:h-8 [&_svg]:size-4"
    >
      <Send aria-hidden /> {rotulo}
    </a>
  );
}

/**
 * Confirmação com uma caixa de marcar (ex.: "Cancelar os envios em andamento").
 * Fica fora de um menu e abre por `open`/`onOpenChange`, ou com `trigger`.
 */
export function ConfirmComOpcao({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel,
  action,
  fields,
  opcao,
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel: string;
  action: ServerAction;
  fields: Record<string, string>;
  opcao: { name: string; label: string };
}) {
  const [aberto, setAberto] = useState(false);
  const visivel = open ?? aberto;
  const mudar = onOpenChange ?? setAberto;
  return (
    <Modal open={visivel} onOpenChange={mudar}>
      {trigger ? <ModalTrigger asChild>{trigger}</ModalTrigger> : null}
      <ModalContent title={title} description={description} size="sm">
        <ActionForm action={action} onSuccess={() => mudar(false)} className="grid gap-5">
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <Checkbox name={opcao.name} label={opcao.label} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => mudar(false)}>
              Cancelar
            </Button>
            <SubmitButton variant="danger" pendingLabel="Aguarde…">
              {confirmLabel}
            </SubmitButton>
          </div>
        </ActionForm>
      </ModalContent>
    </Modal>
  );
}

/* ============================== Pastas ============================== */

/** "Criar pastas no Drive", "Tentar de novo", "Recriar o que falta" e "Criar na conta atual". */
export function PastasBotao({
  projectId,
  modo = "criar",
  rotulo,
  variant = "primary",
}: {
  projectId: string;
  modo?: "criar" | "verificar" | "contaAtual";
  rotulo: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <ActionForm action={criarPastasAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="modo" value={modo} />
      <PastasEnviar modo={modo} rotulo={rotulo} variant={variant} />
    </ActionForm>
  );
}

/** Botão + andamento: criar 17 pastas no Drive leva alguns segundos e a tela não pode parecer travada. */
function PastasEnviar({ modo, rotulo, variant }: { modo: "criar" | "verificar" | "contaAtual"; rotulo: string; variant: "primary" | "secondary" | "ghost" }) {
  const { pending } = useFormStatus();
  return (
    <div className="grid gap-3">
      <div>
        <Button type="submit" variant={variant} size="sm" disabled={pending} className="h-10 sm:h-8">
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : modo === "verificar" ? <RefreshCw aria-hidden /> : <FolderPlus aria-hidden />}
          {pending ? (modo === "verificar" ? "Conferindo…" : "Criando…") : rotulo}
        </Button>
      </div>
      {pending ? <Andamento texto={modo === "verificar" ? "Conferindo as pastas no Drive" : "Criando as pastas no Drive"} /> : null}
    </div>
  );
}

/** Barra com luz correndo + segundos passando: mostra que está vivo. */
export function Andamento({ texto }: { texto: string }) {
  const [seg, setSeg] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeg((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="grid gap-2" role="status" aria-live="polite">
      <div className="relative h-[3px] overflow-hidden rounded-full bg-white/10">
        <span className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-white/80 animate-indeterminate" />
      </div>
      <p className="flex items-center justify-between text-[13px] text-ash">
        <span>{texto}…</span>
        <span className="font-mono text-mute tabular-nums">{seg} s</span>
      </p>
      {seg >= 30 ? (
        <p className="text-[13px] text-mute">Está levando mais que o normal. Pode sair desta tela: as pastas continuam sendo criadas.</p>
      ) : null}
    </div>
  );
}

/** Enquanto as pastas nascem: atualiza a tela a cada 3 s, por até 30 s. */
export function AtualizaEnquantoCria() {
  const router = useRouter();
  useEffect(() => {
    let voltas = 0;
    const t = setInterval(() => {
      voltas++;
      router.refresh();
      if (voltas >= 10) clearInterval(t);
    }, 3000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}

/* ============================== Link da diária ============================== */

/** "Gerar link" (ou "Gerar link novo", quando o anterior expirou ou foi desativado). */
export function GerarLinkDiaria({ eventId, rotulo = "Gerar link" }: { eventId: string; rotulo?: string }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      size="sm"
      className="h-10 sm:h-8"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          let r: Awaited<ReturnType<typeof envioDaDiaria>>;
          try {
            r = await envioDaDiaria(eventId, true);
          } catch {
            toast.error("Não deu para gerar o link agora. Tente de novo.");
            return;
          }
          if (!r.ok) {
            toast.error(r.mensagem);
            return;
          }
          const url = r.link?.estado === "ativo" ? r.link.url : null;
          if (url && (await copyText(url))) toast.success("Link copiado.");
          else toast.success("Link gerado.");
          router.refresh();
        })
      }
    >
      <Link2 aria-hidden /> {pendente ? "Gerando…" : rotulo}
    </Button>
  );
}

/** Copiar, WhatsApp e o menu (validade, trocar, desativar) do link ativo de uma diária. */
export function AcoesLinkDiaria({
  linkId,
  url,
  texto,
  expiraEm,
}: {
  linkId: string;
  url: string | null;
  texto: string | null;
  expiraEm: string | null; // AAAA-MM-DD em Natal
}) {
  const [validade, setValidade] = useState(false);
  const [trocar, setTrocar] = useState(false);
  const [desativar, setDesativar] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {url ? <CopiarBotao texto={url} /> : <p className="text-[13px] text-mute">Use Trocar link para ver o endereço de novo.</p>}
      {texto ? <CopiarBotao texto={texto} rotulo="Copiar para WhatsApp" feito="Texto copiado. É só colar no WhatsApp." icone="whatsapp" /> : null}
      {texto ? <WhatsAppTexto texto={texto} /> : null}
      <Menu modal={false}>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="Mais ações do link"
            className="grid size-10 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.08] hover:text-light focus-visible:outline-2 focus-visible:outline-white data-[state=open]:bg-white/[0.08] data-[state=open]:text-light sm:size-8"
          >
            <Ellipsis className="size-4" />
          </button>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem onSelect={() => setValidade(true)}>
            <CalendarClock /> Mudar validade
          </MenuItem>
          <MenuItem onSelect={() => setTrocar(true)}>
            <RefreshCw /> Trocar link
          </MenuItem>
          <MenuSeparator />
          <MenuItem destructive onSelect={() => setDesativar(true)}>
            <Link2Off /> Desativar
          </MenuItem>
        </MenuContent>
      </Menu>

      <FormModal
        open={validade}
        onOpenChange={setValidade}
        title="Validade do link"
        description="O link vale até o fim do dia escolhido."
        action={validadeLinkAction}
        size="sm"
      >
        {(state) => (
          <>
            <input type="hidden" name="linkId" value={linkId} />
            <Field label="Vale até" htmlFor={`ate-${linkId}`} hint="Em branco: sem data para expirar." error={fieldError(state, "ate")}>
              <Input id={`ate-${linkId}`} name="ate" type="date" min={todayISO()} defaultValue={expiraEm ?? ""} />
            </Field>
          </>
        )}
      </FormModal>
      <ConfirmAction
        open={trocar}
        onOpenChange={setTrocar}
        title="Trocar o link?"
        description="O link antigo para de funcionar. Envios já começados terminam."
        confirmLabel="Trocar link"
        action={trocarLinkAction}
        fields={{ linkId }}
      />
      <ConfirmComOpcao
        open={desativar}
        onOpenChange={setDesativar}
        title="Desativar este link?"
        description="Quem tiver o link não consegue mais enviar. O que já chegou fica no Drive."
        confirmLabel="Desativar"
        action={desativarLinkAction}
        fields={{ linkId }}
        opcao={{ name: "cancelarEnvios", label: "Cancelar os envios em andamento" }}
      />
    </div>
  );
}

/* ============================== Entregas ============================== */

export function LiberarEntregas({ projectId, email, compacto = false }: { projectId: string; email: string | null; compacto?: boolean }) {
  const aviso = email ? ` ${email} recebe um e-mail do Google com o acesso.` : "";
  return (
    <ConfirmAction
      trigger={
        <Button variant={compacto ? "secondary" : "primary"} size="sm" className="h-10 sm:h-8">
          <Send aria-hidden /> {compacto ? "Liberar" : "Liberar entregas"}
        </Button>
      }
      title="Liberar as entregas?"
      description={`Quem tiver o link da área do cliente baixa os arquivos de 06 Entregas. Tudo o que entrar nessa pasta aparece para ele.${aviso}`}
      confirmLabel="Liberar entregas"
      destructive={false}
      action={liberarEntregasAction}
      fields={{ projectId }}
    />
  );
}

export function RecolherEntregas({ projectId }: { projectId: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm" className="h-10 sm:h-8">
          <Undo2 aria-hidden /> Recolher
        </Button>
      }
      title="Recolher as entregas?"
      description="O link de download e o acesso por e-mail param de funcionar. Os arquivos continuam no Drive."
      confirmLabel="Recolher"
      action={recolherEntregasAction}
      fields={{ projectId }}
    />
  );
}

/* ============================== Apagar pasta ============================== */

export function ApagarPasta({ projectId }: { projectId: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm" className="h-10 sm:h-8">
          <Trash2 aria-hidden /> Apagar pasta
        </Button>
      }
      title="Apagar a pasta do Drive?"
      description="Só apaga se estiver vazia. Ela vai para a lixeira do Drive e dá para recuperar por 30 dias. Entregas liberadas são recolhidas."
      confirmLabel="Apagar pasta"
      action={apagarPastaAction}
      fields={{ projectId }}
    />
  );
}
