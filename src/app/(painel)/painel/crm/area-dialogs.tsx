"use client";

import { useState } from "react";
import { Ellipsis, Gauge, KeyRound, LockOpen, Plus, RefreshCw, ShieldOff } from "lucide-react";
import { ConfirmAction, fieldError, FormModal } from "@/components/painel/form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { ConfirmComOpcao, CopiarBotao, WhatsAppTexto } from "../projetos/[id]/_components/drive-dialogs";
import { criarAreaAction, desativarAreaAction, limiteAreaAction, senhaAreaAction, trocarLinkAreaAction } from "./area-actions";

/**
 * Janelas da área do cliente (CRM → cliente → Área do cliente). A área mostra as entregas liberadas e
 * recebe logo, manual de marca e referências do cliente.
 */

export function CriarArea({ clientId, rotulo = "Criar área do cliente" }: { clientId: string; rotulo?: string }) {
  return (
    <FormModal
      trigger={
        <Button variant="primary" size="sm" className="h-10 sm:h-8">
          <Plus aria-hidden /> {rotulo}
        </Button>
      }
      title="Área do cliente"
      description="Um link para o cliente baixar as entregas e mandar arquivos para a ZRO."
      action={criarAreaAction}
      submitLabel="Criar área"
      size="sm"
    >
      {(state) => (
        <>
          <input type="hidden" name="clientId" value={clientId} />
          <Field label="Senha (opcional)" htmlFor="area-senha" hint="Pelo menos 6 caracteres. Mande por outra mensagem." error={fieldError(state, "senha")}>
            <Input id="area-senha" name="senha" type="password" autoComplete="new-password" minLength={6} maxLength={200} />
          </Field>
          <Field label="Limite de envio por dia (GB)" htmlFor="area-limite" hint="Em branco: sem limite." error={fieldError(state, "limite")}>
            <Input id="area-limite" name="limite" inputMode="decimal" defaultValue="20" />
          </Field>
        </>
      )}
    </FormModal>
  );
}

/** Copiar, WhatsApp e o menu (senha, limite, trocar, desativar) de uma área ativa. */
export function AcoesArea({
  clientId,
  linkId,
  url,
  texto,
  telefone,
  temSenha,
  limiteGB,
}: {
  clientId: string;
  linkId: string;
  url: string | null;
  texto: string | null;
  telefone: string | null;
  temSenha: boolean;
  limiteGB: number | null;
}) {
  const [senha, setSenha] = useState(false);
  const [tirarSenha, setTirarSenha] = useState(false);
  const [limite, setLimite] = useState(false);
  const [trocar, setTrocar] = useState(false);
  const [desativar, setDesativar] = useState(false);
  const campos = { clientId, linkId };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {url ? <CopiarBotao texto={url} /> : <p className="text-[13px] text-mute">Use Trocar link para ver o endereço de novo.</p>}
      {texto ? <CopiarBotao texto={texto} rotulo="Copiar para WhatsApp" feito="Texto copiado. É só colar no WhatsApp." icone="whatsapp" /> : null}
      {texto ? <WhatsAppTexto texto={texto} telefone={telefone} /> : null}
      <Menu modal={false}>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="Mais ações da área"
            className="grid size-10 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.08] hover:text-light focus-visible:outline-2 focus-visible:outline-white data-[state=open]:bg-white/[0.08] data-[state=open]:text-light sm:size-8"
          >
            <Ellipsis className="size-4" />
          </button>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem onSelect={() => setSenha(true)}>
            <KeyRound /> {temSenha ? "Trocar senha" : "Definir senha"}
          </MenuItem>
          {temSenha ? (
            <MenuItem onSelect={() => setTirarSenha(true)}>
              <LockOpen /> Tirar senha
            </MenuItem>
          ) : null}
          <MenuItem onSelect={() => setLimite(true)}>
            <Gauge /> Mudar limite
          </MenuItem>
          <MenuItem onSelect={() => setTrocar(true)}>
            <RefreshCw /> Trocar link
          </MenuItem>
          <MenuSeparator />
          <MenuItem destructive onSelect={() => setDesativar(true)}>
            <ShieldOff /> Desativar área
          </MenuItem>
        </MenuContent>
      </Menu>

      <FormModal
        open={senha}
        onOpenChange={setSenha}
        title={temSenha ? "Trocar senha" : "Definir senha"}
        description="Quem já tinha entrado precisa digitar a senha nova."
        action={senhaAreaAction}
        size="sm"
      >
        {(state) => (
          <>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="linkId" value={linkId} />
            <Field label="Senha" htmlFor="area-nova-senha" hint="Pelo menos 6 caracteres." error={fieldError(state, "senha")}>
              <Input id="area-nova-senha" name="senha" type="password" autoComplete="new-password" minLength={6} maxLength={200} required />
            </Field>
          </>
        )}
      </FormModal>
      <ConfirmAction
        open={tirarSenha}
        onOpenChange={setTirarSenha}
        title="Tirar a senha?"
        description="A área passa a abrir só com o link."
        confirmLabel="Tirar senha"
        action={senhaAreaAction}
        fields={{ ...campos, tirar: "1" }}
      />
      <FormModal
        open={limite}
        onOpenChange={setLimite}
        title="Limite de envio por dia"
        description="Quanto o cliente pode mandar em um dia. O limite volta no dia seguinte."
        action={limiteAreaAction}
        size="sm"
      >
        {(state) => (
          <>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="linkId" value={linkId} />
            <Field label="Limite (GB)" htmlFor="area-novo-limite" hint="Em branco: sem limite." error={fieldError(state, "limite")}>
              <Input id="area-novo-limite" name="limite" inputMode="decimal" defaultValue={limiteGB != null ? String(limiteGB).replace(".", ",") : ""} />
            </Field>
          </>
        )}
      </FormModal>
      <ConfirmAction
        open={trocar}
        onOpenChange={setTrocar}
        title="Trocar o link da área?"
        description="O link antigo para de funcionar. Mande o novo para o cliente."
        confirmLabel="Trocar link"
        action={trocarLinkAreaAction}
        fields={campos}
      />
      <ConfirmComOpcao
        open={desativar}
        onOpenChange={setDesativar}
        title="Desativar a área?"
        description="O cliente não abre mais a área. O que ele já mandou fica no Drive."
        confirmLabel="Desativar área"
        action={desativarAreaAction}
        fields={campos}
        opcao={{ name: "cancelarEnvios", label: "Cancelar os envios em andamento" }}
      />
    </div>
  );
}
