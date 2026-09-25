"use client";

import { X } from "lucide-react";
import { Dialog as D, DropdownMenu as DM, Tooltip as T } from "radix-ui";
import { cn } from "@/lib/utils";

/* ---------------- Modal: centralizado no desktop, folha de baixo no celular ---------------- */

export const Modal = D.Root;
export const ModalTrigger = D.Trigger;
export const ModalClose = D.Close;

export function ModalContent({
  title,
  description,
  children,
  className,
  size = "md",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const widths = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl" };
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm data-[state=closed]:animate-[fade-out_150ms] data-[state=open]:animate-[fade-in_200ms]" />
      <D.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-[81] max-h-[92dvh] overflow-y-auto rounded-t-[28px] border border-line-strong bg-ink p-5 shadow-[0_-24px_80px_-24px_rgb(0_0_0/0.8)] focus:outline-none data-[state=open]:animate-[sheet-in_320ms_cubic-bezier(0.16,1,0.3,1)]",
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100vw-48px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:p-7 sm:data-[state=open]:animate-[modal-in_260ms_cubic-bezier(0.16,1,0.3,1)]",
          widths[size],
          className,
        )}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden" aria-hidden />
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <D.Title className="text-[19px] font-semibold tracking-[-0.02em] text-white">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 text-[14px] text-mute">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{typeof title === "string" ? title : "Janela"}</D.Description>
            )}
          </div>
          <D.Close
            className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full text-ash transition-colors hover:bg-white/[0.08] hover:text-white"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}

/* ---------------- Menu suspenso ---------------- */

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export function MenuContent({
  children,
  align = "end",
  className,
}: {
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-[90] min-w-48 rounded-2xl border border-line-strong bg-graphite/95 p-1.5 shadow-[0_24px_64px_-16px_rgb(0_0_0/0.8)] backdrop-blur-xl data-[state=open]:animate-[pop-in_160ms_cubic-bezier(0.16,1,0.3,1)]",
          className,
        )}
      >
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function MenuItem({
  className,
  destructive,
  ...props
}: React.ComponentProps<typeof DM.Item> & { destructive?: boolean }) {
  return (
    <DM.Item
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] text-light outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-white/[0.08] [&_svg]:size-4 [&_svg]:text-ash",
        destructive && "text-danger data-[highlighted]:bg-danger/10 [&_svg]:text-danger",
        className,
      )}
      {...props}
    />
  );
}

export function MenuSeparator() {
  return <DM.Separator className="my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <DM.Label className="label px-3 pt-2 pb-1 text-mute">{children}</DM.Label>;
}

/* ---------------- Dica ---------------- */

export function Tip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <T.Provider delayDuration={250}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content
            side={side}
            sideOffset={8}
            className="z-[95] rounded-lg border border-line-strong bg-graphite px-2.5 py-1.5 text-[12px] text-light shadow-lg data-[state=delayed-open]:animate-[fade-in_120ms]"
          >
            {content}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
