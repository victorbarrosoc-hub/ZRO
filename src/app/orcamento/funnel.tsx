"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, MessageCircle } from "lucide-react";
import {
  FUNNEL_BUDGETS,
  FUNNEL_DAYS,
  FUNNEL_EXTRAS,
  FUNNEL_FORMATS,
  FUNNEL_PROJECT_TYPES,
  FUNNEL_VIDEOS,
  optionLabel,
} from "@/lib/domain";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";
import { submitLead, type LeadResult } from "./actions";

type Answers = {
  projectType?: string;
  idea: string;
  company: string;
  segment: string;
  timing: string;
  city: string;
  days?: string;
  videos?: string;
  format?: string;
  extras: string[];
  budget?: string;
  name: string;
  phone: string;
  email: string;
  consent: boolean;
  website: string;
};

type StepId = "tipo" | "ideia" | "quando" | "diarias" | "videos" | "extras" | "investimento" | "contato" | "resumo";

const EASE = [0.16, 1, 0.3, 1] as const;

function formatPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function Funnel({ initialType }: { initialType?: string }) {
  const reduced = usePrefersReducedMotion();
  const [answers, setAnswers] = useState<Answers>({
    projectType: initialType,
    idea: "",
    company: "",
    segment: "",
    timing: "",
    city: "",
    extras: [],
    name: "",
    phone: "",
    email: "",
    consent: false,
    website: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<LeadResult, { ok: true }> | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFinishing = answers.projectType === "finalizacao";
  const steps = useMemo<StepId[]>(
    () =>
      ["tipo", "ideia", "quando", "diarias", "videos", "extras", "investimento", "contato", "resumo"].filter(
        (s) => !(isFinishing && (s === "diarias" || s === "extras")),
      ) as StepId[],
    [isFinishing],
  );
  const [index, setIndex] = useState(initialType ? 1 : 0);
  const step = steps[Math.min(index, steps.length - 1)];
  const progress = (Math.min(index, steps.length - 1) + 1) / steps.length;

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setError(null);
  };

  function validate(current: StepId): string | null {
    if (current === "tipo" && !answers.projectType) return "Escolha uma opção para continuar.";
    if (current === "contato") {
      if (answers.name.trim().length < 2) return "Faltou o seu nome. Como a gente te chama?";
      const digits = answers.phone.replace(/\D/g, "");
      if (!digits && !answers.email.trim()) return "Deixe um WhatsApp ou e-mail para a gente responder.";
      if (digits && digits.length < 10) return "Confira o número com DDD.";
      if (!answers.consent) return "Precisamos do seu ok para guardar esses dados.";
    }
    return null;
  }

  function next() {
    const problem = validate(step);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function back() {
    setError(null);
    setIndex((i) => Math.max(i - 1, 0));
  }

  function pickAndAdvance<K extends keyof Answers>(key: K, value: Answers[K]) {
    set(key, value);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => setIndex((i) => Math.min(i + 1, steps.length - 1)), 280);
  }

  function submit() {
    const problem = validate("contato");
    if (problem) {
      setError(problem);
      setIndex(steps.indexOf("contato"));
      return;
    }
    startTransition(async () => {
      const res = await submitLead({
        ...answers,
        phone: answers.phone || undefined,
        email: answers.email || undefined,
        days: isFinishing ? undefined : answers.days,
        extras: isFinishing ? [] : answers.extras,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res);
      if (res.whatsappUrl) window.location.href = res.whatsappUrl;
    });
  }

  if (result) {
    return (
      <Done
        result={result}
        copied={copied}
        onCopy={async () => {
          try {
            await navigator.clipboard.writeText(result.message);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      />
    );
  }

  const title: Record<StepId, string> = {
    tipo: "Que tipo de projeto você tem em mente?",
    ideia: "Conta rapidinho a ideia.",
    quando: "Quando e onde?",
    diarias: "Quantas diárias de gravação você imagina?",
    videos: isFinishing ? "Quantos vídeos para finalizar?" : "Quantos vídeos finais, e em qual formato?",
    extras: "Precisa de algo a mais?",
    investimento: "Qual a faixa de investimento?",
    contato: "Como a gente te chama?",
    resumo: "Tudo certo?",
  };
  const subtitle: Partial<Record<StepId, string>> = {
    ideia: "O que você quer contar, pra quem e onde o filme vai viver. Pode ser curto, a conversa continua depois.",
    quando: "Uma data, um mês ou só uma previsão. E a cidade da gravação.",
    extras: "Pode marcar mais de um, ou pular.",
    investimento: "Ajuda a gente a propor o formato certo pra sua história.",
    contato: "Seus dados ficam só com a ZRO, para responder ao seu pedido.",
    resumo: "Ao enviar, a conversa continua no WhatsApp com essa mensagem pronta.",
  };

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Topo */}
      <div className="fixed inset-x-0 top-0 z-20 bg-void/80 backdrop-blur-xl">
        <div className="relative h-px w-full bg-white/10">
          <motion.div
            className="absolute inset-y-0 left-0 bg-white shadow-[0_0_12px_rgb(255_255_255/0.8)]"
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.6, ease: EASE }}
          />
        </div>
        <div className="container-zro flex h-16 items-center justify-between">
          <p className="label text-mute">
            {String(Math.min(index, steps.length - 1) + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
          </p>
          <Link href="/" className="label text-mute transition-colors hover:text-white">
            Fechar
          </Link>
        </div>
      </div>

      <form
        className="container-zro flex flex-1 flex-col pt-28 pb-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === "resumo") submit();
          else next();
        }}
      >
        <input
          type="text"
          name="website"
          value={answers.website}
          onChange={(e) => set("website", e.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
        />
        <div className="mx-auto w-full max-w-3xl flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduced ? false : { opacity: 0, y: 16, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduced ? undefined : { opacity: 0, y: -12, filter: "blur(8px)" }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <h1 className="text-[clamp(32px,5vw,64px)] leading-[1.02] font-semibold tracking-[-0.04em] text-white">
                {title[step]}
              </h1>
              {subtitle[step] ? <p className="mt-4 max-w-xl text-body-lg text-ash">{subtitle[step]}</p> : null}

              <div className="mt-10 sm:mt-12">
                {step === "tipo" ? (
                  <OptionGrid
                    options={FUNNEL_PROJECT_TYPES}
                    value={answers.projectType}
                    onPick={(v) => pickAndAdvance("projectType", v)}
                    columns={2}
                  />
                ) : null}

                {step === "ideia" ? (
                  <div className="grid gap-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <TextField label="Empresa ou marca" value={answers.company} onChange={(v) => set("company", v)} placeholder="Ex.: Hotel Maré" autoFocus />
                      <TextField label="Segmento" value={answers.segment} onChange={(v) => set("segment", v)} placeholder="Ex.: hotelaria" />
                    </div>
                    <label className="grid gap-2">
                      <span className="text-[13px] text-ash">A ideia ou o objetivo</span>
                      <textarea
                        value={answers.idea}
                        onChange={(e) => set("idea", e.target.value)}
                        rows={4}
                        maxLength={1200}
                        placeholder="Ex.: um filme para o lançamento da nova unidade, pensado para Instagram e YouTube."
                        className="w-full rounded-[18px] border border-line-strong bg-white/[0.03] px-4 py-3.5 text-[17px] leading-relaxed text-light placeholder:text-mute focus:border-white/50 focus:outline-none"
                      />
                    </label>
                  </div>
                ) : null}

                {step === "quando" ? (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <TextField label="Quando" value={answers.timing} onChange={(v) => set("timing", v)} placeholder="Ex.: novembro de 2026" autoFocus />
                    <TextField label="Cidade" value={answers.city} onChange={(v) => set("city", v)} placeholder="Ex.: Natal/RN" />
                  </div>
                ) : null}

                {step === "diarias" ? (
                  <OptionGrid options={FUNNEL_DAYS} value={answers.days} onPick={(v) => pickAndAdvance("days", v)} columns={3} />
                ) : null}

                {step === "videos" ? (
                  <div className="grid gap-8">
                    <OptionGrid options={FUNNEL_VIDEOS} value={answers.videos} onPick={(v) => set("videos", v)} columns={4} />
                    <div>
                      <p className="label mb-3 text-mute">Formato</p>
                      <OptionGrid options={FUNNEL_FORMATS} value={answers.format} onPick={(v) => set("format", v)} columns={3} />
                    </div>
                  </div>
                ) : null}

                {step === "extras" ? (
                  <div className="flex flex-wrap gap-3">
                    {FUNNEL_EXTRAS.map((o) => {
                      const on = answers.extras.includes(o.key);
                      return (
                        <button
                          key={o.key}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            set("extras", on ? answers.extras.filter((e) => e !== o.key) : [...answers.extras, o.key])
                          }
                          className={cn(
                            "inline-flex h-14 items-center gap-3 rounded-full border px-6 text-[16px] transition-[background-color,border-color] duration-300",
                            on ? "border-white bg-white text-void" : "border-line-strong text-light hover:border-white/40",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-5 place-items-center rounded-full border transition-colors",
                              on ? "border-void bg-void text-white" : "border-white/30",
                            )}
                          >
                            {on ? <Check className="size-3" aria-hidden /> : null}
                          </span>
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {step === "investimento" ? (
                  <OptionGrid options={FUNNEL_BUDGETS} value={answers.budget} onPick={(v) => pickAndAdvance("budget", v)} columns={2} />
                ) : null}

                {step === "contato" ? (
                  <div className="grid gap-5">
                    <TextField label="Seu nome" value={answers.name} onChange={(v) => set("name", v)} autoComplete="name" autoFocus />
                    <div className="grid gap-5 sm:grid-cols-2">
                      <TextField
                        label="WhatsApp"
                        value={answers.phone}
                        onChange={(v) => set("phone", formatPhone(v))}
                        placeholder="(84) 90000-0000"
                        inputMode="tel"
                        autoComplete="tel"
                      />
                      <TextField
                        label="E-mail (opcional)"
                        value={answers.email}
                        onChange={(v) => set("email", v)}
                        inputMode="email"
                        autoComplete="email"
                        type="email"
                      />
                    </div>
                    <label className="mt-2 flex cursor-pointer items-start gap-3 text-[14px] leading-snug text-ash">
                      <input
                        type="checkbox"
                        checked={answers.consent}
                        onChange={(e) => set("consent", e.target.checked)}
                        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-white"
                      />
                      <span>
                        Autorizo a ZRO a guardar esses dados para responder ao meu pedido, conforme a{" "}
                        <Link href="/privacidade" target="_blank" className="text-light underline decoration-white/30 underline-offset-4">
                          política de privacidade
                        </Link>
                        .
                      </span>
                    </label>
                  </div>
                ) : null}

                {step === "resumo" ? <Summary answers={answers} isFinishing={isFinishing} /> : null}
              </div>
            </motion.div>
          </AnimatePresence>

          <p className="mt-6 min-h-6 text-[14px] text-danger" role="alert" aria-live="polite">
            {error ?? ""}
          </p>
        </div>

        {/* Navegação */}
        <div className="mx-auto mt-8 flex w-full max-w-3xl items-center justify-between gap-4 border-t border-line pt-6">
          <button
            type="button"
            onClick={back}
            disabled={index === 0 || pending}
            className="inline-flex h-12 items-center gap-2 rounded-full px-4 text-[15px] text-ash transition-colors hover:text-white disabled:invisible"
          >
            <ArrowLeft className="size-4" aria-hidden /> Voltar
          </button>
          {step === "resumo" ? (
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-14 items-center gap-2.5 rounded-full bg-white px-5 text-[15px] font-medium whitespace-nowrap text-void shadow-[0_0_40px_rgb(255_255_255/0.25)] transition-colors hover:bg-light disabled:opacity-60 sm:gap-3 sm:px-7 sm:text-[16px]"
            >
              <MessageCircle className="size-5" aria-hidden />
              {pending ? "Preparando…" : "Enviar pelo WhatsApp"}
            </button>
          ) : (
            <button
              type="submit"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-medium text-void transition-colors hover:bg-light"
            >
              {step === "extras" && answers.extras.length === 0 ? "Pular" : "Continuar"}
              <ArrowRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function OptionGrid({
  options,
  value,
  onPick,
  columns = 2,
}: {
  options: readonly { key: string; label: string; hint?: string }[];
  value?: string;
  onPick: (key: string) => void;
  columns?: 2 | 3 | 4;
}) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" };
  return (
    <div className={cn("grid gap-3", cols[columns])} role="radiogroup">
      {options.map((o) => {
        const selected = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(o.key)}
            className={cn(
              "group relative flex min-h-16 items-center justify-between gap-4 rounded-[20px] border px-5 py-4 text-left transition-[background-color,border-color,box-shadow] duration-300",
              selected
                ? "border-white bg-white text-void shadow-[0_0_48px_rgb(255_255_255/0.18)]"
                : "border-line-strong bg-white/[0.02] text-light hover:border-white/40 hover:bg-white/[0.05]",
            )}
          >
            <span>
              <span className="block text-[17px] font-medium tracking-[-0.01em]">{o.label}</span>
              {"hint" in o && o.hint ? (
                <span className={cn("mt-0.5 block text-[13px]", selected ? "text-void/60" : "text-mute")}>{o.hint}</span>
              ) : null}
            </span>
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
                selected ? "border-void bg-void text-white" : "border-white/25",
              )}
              aria-hidden
            >
              {selected ? <Check className="size-3.5" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  return (
    <label className="grid gap-2">
      <span className="text-[13px] text-ash">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-14 w-full rounded-[18px] border border-line-strong bg-white/[0.03] px-4 text-[17px] text-light placeholder:text-mute focus:border-white/50 focus:outline-none"
        {...props}
      />
    </label>
  );
}

function Summary({ answers, isFinishing }: { answers: Answers; isFinishing: boolean }) {
  const rows = [
    { label: "Projeto", value: optionLabel(FUNNEL_PROJECT_TYPES, answers.projectType) },
    { label: "Empresa", value: [answers.company, answers.segment].filter(Boolean).join(" · ") },
    { label: "Quando e onde", value: [answers.timing, answers.city].filter(Boolean).join(", ") },
    { label: "Diárias", value: isFinishing ? "" : answers.days ? optionLabel(FUNNEL_DAYS, answers.days) : "" },
    {
      label: "Vídeos",
      value: [answers.videos ? optionLabel(FUNNEL_VIDEOS, answers.videos) : "", answers.format ? optionLabel(FUNNEL_FORMATS, answers.format) : ""]
        .filter(Boolean)
        .join(" · "),
    },
    { label: "Extras", value: isFinishing ? "" : answers.extras.map((e) => optionLabel(FUNNEL_EXTRAS, e)).join(", ") },
    { label: "Investimento", value: answers.budget ? optionLabel(FUNNEL_BUDGETS, answers.budget) : "" },
    { label: "Ideia", value: answers.idea },
    { label: "Contato", value: [answers.name, answers.phone, answers.email].filter(Boolean).join(" · ") },
  ].filter((r) => r.value);

  return (
    <dl className="overflow-hidden rounded-[24px] border border-line bg-white/[0.02]">
      {rows.map((r) => (
        <div key={r.label} className="grid gap-1 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[160px_1fr] sm:gap-6">
          <dt className="label pt-1 text-mute">{r.label}</dt>
          <dd className="text-[16px] whitespace-pre-line text-light">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Done({
  result,
  copied,
  onCopy,
}: {
  result: Extract<LeadResult, { ok: true }>;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="container-zro grid min-h-dvh place-items-center py-24">
      <div className="w-full max-w-2xl">
        <div className="mb-8 grid size-14 place-items-center rounded-full border border-white/20">
          <Check className="size-6 text-white" aria-hidden />
        </div>
        <p className="label mb-4 text-mute">Protocolo {result.protocol}</p>
        <h1 className="text-[clamp(32px,5vw,56px)] leading-[1.02] font-semibold tracking-[-0.04em] text-white">
          Pedido recebido. Agora a conversa continua no WhatsApp.
        </h1>
        <p className="mt-4 text-body-lg text-ash">
          {result.whatsappUrl
            ? "Se o WhatsApp não abriu sozinho, toque no botão abaixo."
            : "Enquanto o WhatsApp da ZRO é configurado, você pode enviar por e-mail."}
        </p>
        <pre className="mt-8 max-h-72 overflow-auto rounded-[20px] border border-line bg-white/[0.02] p-5 font-sans text-[14px] leading-relaxed whitespace-pre-wrap text-ash">
          {result.message}
        </pre>
        <div className="mt-8 flex flex-wrap gap-3">
          {result.whatsappUrl ? (
            <a
              href={result.whatsappUrl}
              className="inline-flex h-14 items-center gap-3 rounded-full bg-white px-7 text-[16px] font-medium text-void transition-colors hover:bg-light"
            >
              <MessageCircle className="size-5" aria-hidden /> Abrir WhatsApp
            </a>
          ) : result.mailtoUrl ? (
            <a
              href={result.mailtoUrl}
              className="inline-flex h-14 items-center gap-3 rounded-full bg-white px-7 text-[16px] font-medium text-void transition-colors hover:bg-light"
            >
              Enviar por e-mail
            </a>
          ) : null}
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-14 items-center gap-2 rounded-full border border-line-strong px-6 text-[15px] text-light transition-colors hover:border-white/40"
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "Copiada" : "Copiar mensagem"}
          </button>
          <Link href="/" className="inline-flex h-14 items-center px-4 text-[15px] text-mute transition-colors hover:text-white">
            Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  );
}
