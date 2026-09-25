"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpRight, Check, Minus, Plus, X } from "lucide-react";
import { fieldError } from "@/components/painel/form";
import { FilmCard } from "@/components/site/film-card";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge, Card, CardHeader } from "@/components/ui/surface";
import type { ActionResult } from "@/lib/actions";
import { CATEGORIES } from "@/lib/domain";
import { cn, slugify } from "@/lib/utils";
import { parseVideo } from "@/lib/video";
import { saveFilm } from "./actions";
import { IconButton } from "./_components/list-controls";
import { MediaThumb } from "./_components/media-thumb";
import { StableForm, StableSubmit } from "./_components/stable-form";
import { allowedImageHosts, imageSrcProblem, normalizeImageUrl, type ImagePolicy } from "./_lib/image-policy";

export type FilmFormValues = {
  id?: string;
  title: string;
  slug: string;
  client: string;
  category: string;
  year: string;
  duration: string;
  format: string;
  videoUrl: string;
  posterUrl: string;
  previewUrl: string;
  summary: string;
  intention: string;
  credits: { role: string; name: string }[];
  stills: string[];
  featured: boolean;
  published: boolean;
};

const ROLE_SUGGESTIONS = [
  "Direção",
  "Direção criativa",
  "Direção de fotografia",
  "Produção",
  "Produção executiva",
  "Roteiro",
  "Captação",
  "Montagem",
  "Color",
  "Finalização",
  "Som direto",
  "Trilha",
  "Mixagem",
  "Drone",
  "Motion",
  "Cliente",
  "Agência",
];

const VIDEO_KIND_LABEL = { vimeo: "Vimeo", youtube: "YouTube", file: "Arquivo de vídeo" } as const;

let keySeq = 0;
const newKey = () => `r${++keySeq}`;

type CreditRow = { key: string; role: string; name: string };
type StillRow = { key: string; src: string };

function move<T>(list: T[], i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function FilmForm({
  initial,
  policy,
  savedSlug,
  savedPublished,
}: {
  initial: FilmFormValues;
  policy: ImagePolicy;
  savedSlug?: string;
  savedPublished?: boolean;
}) {
  const router = useRouter();
  const isNew = !initial.id;

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [client, setClient] = useState(initial.client);
  const [category, setCategory] = useState(initial.category);
  const [year, setYear] = useState(initial.year);
  const [duration, setDuration] = useState(initial.duration);
  const [format, setFormat] = useState(initial.format);
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl);
  const [posterUrl, setPosterUrl] = useState(initial.posterUrl);
  const [previewUrl, setPreviewUrl] = useState(initial.previewUrl);
  const [summary, setSummary] = useState(initial.summary);
  const [intention, setIntention] = useState(initial.intention);
  const [credits, setCredits] = useState<CreditRow[]>(() => initial.credits.map((c) => ({ key: newKey(), ...c })));
  const [stills, setStills] = useState<StillRow[]>(() => initial.stills.map((src) => ({ key: newKey(), src })));
  const [newStill, setNewStill] = useState("");
  const [featured, setFeatured] = useState(initial.featured);
  const [published, setPublished] = useState(initial.published);

  const isManifesto = savedSlug === "manifesto";
  const video = parseVideo(videoUrl);
  const preview = parseVideo(previewUrl);
  const posterProblem = posterUrl ? imageSrcProblem(posterUrl, policy) : null;
  const creditsJson = JSON.stringify(
    credits.map(({ role, name }) => ({ role: role.trim(), name: name.trim() })).filter((c) => c.role || c.name),
  );
  const stillsJson = JSON.stringify(stills.map((s) => s.src.trim()).filter(Boolean));
  const hosts = allowedImageHosts(policy);
  const ytThumb = video?.kind === "youtube" ? `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg` : null;
  const canUseYtThumb = Boolean(ytThumb && !posterUrl && !imageSrcProblem(ytThumb, policy));

  // Alterações não salvas: compara com o que veio do servidor (ou do último salvamento).
  const snapshot = JSON.stringify([
    title, slug, client, category, year, duration, format, videoUrl, posterUrl, previewUrl, summary, intention,
    creditsJson, stillsJson, featured, published,
  ]);
  const [baseline, setBaseline] = useState(snapshot);
  const dirty = snapshot !== baseline;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function onTitle(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function addStill() {
    const src = normalizeImageUrl(newStill);
    if (!src) return;
    if (!stills.some((s) => s.src === src)) setStills((list) => [...list, { key: newKey(), src }]);
    setNewStill("");
  }

  function onSuccess(state: Extract<ActionResult, { ok: true }>) {
    setBaseline(snapshot);
    if (isNew && state.id) router.replace(`/painel/site/filmes/${state.id}`);
  }

  const checklist = [
    { label: "Vídeo", done: Boolean(video), hint: "Sem vídeo, aparece “Vídeo em breve”." },
    { label: "Pôster", done: Boolean(posterUrl) && !posterProblem, hint: "Sem pôster, o site mostra a cartela com o título." },
    { label: "Resumo", done: Boolean(summary.trim()) },
    { label: "A intenção", done: Boolean(intention.trim()) },
    { label: "Ficha técnica", done: credits.some((c) => c.role.trim() && c.name.trim()) },
  ];

  const status = dirty ? "Alterações não salvas" : isNew ? "Filme novo" : "Tudo salvo";

  return (
    <StableForm action={saveFilm} onSuccess={onSuccess} className="grid gap-6 xl:grid-cols-12 xl:items-start">
      {(state) => (
        <>
          {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
          <input type="hidden" name="credits" value={creditsJson} />
          <input type="hidden" name="stills" value={stillsJson} />

          <div className="grid min-w-0 gap-6 xl:col-span-8">
            {/* ---------------- O filme ---------------- */}
            <Card>
              <CardHeader title="O filme" description="Título, cliente e onde ele entra no portfólio." />
              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <Field label="Título" htmlFor="film-title" error={fieldError(state, "title")} className="sm:col-span-2">
                  <Input id="film-title" name="title" value={title} onChange={(e) => onTitle(e.target.value)} required autoFocus={isNew} />
                </Field>
                <Field
                  label="Endereço no site"
                  htmlFor="film-slug"
                  error={fieldError(state, "slug")}
                  hint={
                    isManifesto
                      ? "O endereço do Manifesto é fixo: a página inicial acha o filme por ele."
                      : !isNew && savedPublished && slug !== savedSlug
                        ? "Mudar o endereço quebra links que já foram compartilhados."
                        : "Gerado do título. Só letras minúsculas, números e hífen."
                  }
                  className="sm:col-span-2"
                >
                  <div className="flex items-stretch overflow-hidden rounded-field border border-line-strong bg-white/[0.03] focus-within:border-white/50 focus-within:ring-4 focus-within:ring-white/[0.06]">
                    <span className="flex items-center border-r border-line pr-2 pl-3.5 text-[14px] text-mute select-none">/filmes/</span>
                    <input
                      id="film-slug"
                      name="slug"
                      value={slug}
                      readOnly={isManifesto}
                      aria-invalid={Boolean(fieldError(state, "slug")) || undefined}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                      }}
                      onBlur={() => {
                        if (!slug.trim()) {
                          setSlugTouched(false);
                          setSlug(slugify(title));
                        } else setSlug(slugify(slug));
                      }}
                      className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[15px] text-light placeholder:text-mute focus:outline-none read-only:text-ash"
                      placeholder="nome-do-filme"
                    />
                  </div>
                </Field>
                <Field label="Cliente" htmlFor="film-client" hint="Em branco, aparece “ZRO”.">
                  <Input id="film-client" name="client" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Ex.: SERHS" />
                </Field>
                <Field label="Categoria" htmlFor="film-category" error={fieldError(state, "category")}>
                  <Select id="film-category" name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.short}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Ano" htmlFor="film-year" error={fieldError(state, "year")}>
                  <Input
                    id="film-year"
                    name="year"
                    inputMode="numeric"
                    maxLength={4}
                    value={year}
                    onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
                    placeholder="2026"
                  />
                </Field>
                <Field label="Duração" htmlFor="film-duration" error={fieldError(state, "duration")}>
                  <Input id="film-duration" name="duration" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="1:30" />
                </Field>
                <fieldset className="sm:col-span-2">
                  <legend className="mb-1.5 text-[13px] font-medium text-ash">Formato</legend>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "16:9", label: "Horizontal · 16:9" },
                      { key: "9:16", label: "Vertical · 9:16" },
                    ].map((f) => (
                      <label key={f.key} className="cursor-pointer">
                        <input
                          type="radio"
                          name="format"
                          value={f.key}
                          checked={format === f.key}
                          onChange={() => setFormat(f.key)}
                          className="peer sr-only"
                        />
                        <span className="inline-flex h-10 items-center rounded-full border border-line-strong px-4 text-[13px] text-ash transition-colors peer-checked:border-white peer-checked:bg-white peer-checked:text-void peer-focus-visible:outline-2 peer-focus-visible:outline-white">
                          {f.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </Card>

            {/* ---------------- Vídeo ---------------- */}
            <Card>
              <CardHeader
                title="Vídeo"
                description="Cole o link do Vimeo ou do YouTube. Arquivo próprio: caminho em /media (ex.: /media/filme.mp4)."
              />
              <div className="grid gap-5 p-5 sm:p-6">
                <Field
                  label="Link do vídeo"
                  htmlFor="film-video"
                  error={fieldError(state, "videoUrl")}
                  hint={
                    videoUrl && !video
                      ? undefined
                      : "Link do Google Drive não toca no site: suba no Vimeo ou no YouTube (pode ser não listado)."
                  }
                >
                  <Input
                    id="film-video"
                    name="videoUrl"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    inputMode="url"
                    placeholder="https://vimeo.com/123456789"
                    aria-invalid={Boolean(videoUrl && !video) || undefined}
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  {video ? (
                    <Badge tone="ok" dot>
                      {VIDEO_KIND_LABEL[video.kind]}
                    </Badge>
                  ) : videoUrl ? (
                    <Badge tone="danger" dot>
                      Link não reconhecido
                    </Badge>
                  ) : (
                    <Badge tone="warn" dot>
                      Sem vídeo
                    </Badge>
                  )}
                  <span className="text-mute">
                    {video
                      ? "Prévia abaixo, do jeito que toca no site."
                      : videoUrl
                        ? "Use o link da página do vídeo no Vimeo ou no YouTube."
                        : "Sem vídeo, o site mostra “Vídeo em breve”."}
                  </span>
                </div>
                {video ? <VideoPreview url={videoUrl} format={format} poster={posterUrl && !posterProblem ? posterUrl : undefined} /> : null}

                <Field
                  label="Loop de prévia (opcional)"
                  htmlFor="film-preview"
                  error={fieldError(state, "previewUrl")}
                  hint="Trecho curto, sem som, que toca quando o mouse passa no pôster. Precisa ser arquivo .mp4 ou .webm."
                >
                  <Input
                    id="film-preview"
                    name="previewUrl"
                    value={previewUrl}
                    onChange={(e) => setPreviewUrl(e.target.value)}
                    inputMode="url"
                    placeholder="/media/nome-do-filme-loop.mp4"
                    aria-invalid={Boolean(previewUrl && preview?.kind !== "file") || undefined}
                  />
                </Field>
                {previewUrl && preview?.kind === "file" ? (
                  <video
                    src={preview.src}
                    muted
                    loop
                    autoPlay
                    playsInline
                    className="aspect-[16/10] w-full max-w-xs rounded-[14px] border border-line bg-black object-cover"
                  />
                ) : null}
              </div>
            </Card>

            {/* ---------------- Imagens ---------------- */}
            <Card>
              <CardHeader
                title="Imagens"
                description="Pôster (a capa do filme) e stills da página do case."
              />
              <div className="grid gap-6 p-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-start">
                  <Field
                    label="Pôster"
                    htmlFor="film-poster"
                    error={fieldError(state, "posterUrl")}
                    hint={posterUrl ? undefined : "Em branco, o site usa a cartela com o título, no estilo da ZRO."}
                  >
                    <Input
                      id="film-poster"
                      name="posterUrl"
                      value={posterUrl}
                      onChange={(e) => setPosterUrl(e.target.value)}
                      onBlur={() => setPosterUrl((v) => normalizeImageUrl(v))}
                      inputMode="url"
                      placeholder="/media/nome-do-filme.jpg"
                      aria-invalid={Boolean(posterProblem) || undefined}
                    />
                    {posterProblem && !fieldError(state, "posterUrl") ? (
                      <p className="text-[13px] text-warn">{posterProblem}</p>
                    ) : null}
                    {canUseYtThumb ? (
                      <Button variant="subtle" size="sm" className="mt-1 w-fit" onClick={() => setPosterUrl(ytThumb!)}>
                        Usar a capa do YouTube
                      </Button>
                    ) : null}
                  </Field>
                  <MediaThumb src={posterUrl || null} title={title} className="w-full" rounded="rounded-[14px]" />
                </div>

                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-ash">Stills</p>
                  <p className="mb-3 text-[13px] text-mute">Quadros do filme que aparecem na página do case, nessa ordem.</p>
                  {stills.length ? (
                    <ul className="mb-3 grid gap-2">
                      {stills.map((s, i) => {
                        const problem = imageSrcProblem(s.src, policy);
                        return (
                          <li key={s.key} className="rounded-2xl border border-line bg-white/[0.02] p-2">
                            <div className="flex items-center gap-3">
                              <MediaThumb src={s.src} className="w-20 sm:w-24" rounded="rounded-[10px]" />
                              <input
                                aria-label={`Endereço da imagem ${i + 1}`}
                                value={s.src}
                                onChange={(e) =>
                                  setStills((list) => list.map((x) => (x.key === s.key ? { ...x, src: e.target.value } : x)))
                                }
                                onBlur={() =>
                                  setStills((list) =>
                                    list.map((x) => (x.key === s.key ? { ...x, src: normalizeImageUrl(x.src) } : x)),
                                  )
                                }
                                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                                className="h-10 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 text-[14px] text-light hover:border-line focus:border-white/40 focus:outline-none"
                              />
                              <div className="flex shrink-0 items-center">
                                <IconButton label="Subir" disabled={i === 0} onClick={() => setStills((l) => move(l, i, -1))}>
                                  <ArrowUp />
                                </IconButton>
                                <IconButton
                                  label="Descer"
                                  disabled={i === stills.length - 1}
                                  onClick={() => setStills((l) => move(l, i, 1))}
                                  className="hidden sm:grid"
                                >
                                  <ArrowDown />
                                </IconButton>
                                <IconButton label="Remover imagem" onClick={() => setStills((l) => l.filter((x) => x.key !== s.key))}>
                                  <X />
                                </IconButton>
                              </div>
                            </div>
                            {problem ? <p className="mt-2 px-1 text-[13px] text-warn">{problem}</p> : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      aria-label="Nova imagem"
                      value={newStill}
                      onChange={(e) => setNewStill(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addStill();
                        }
                      }}
                      inputMode="url"
                      placeholder="/media/still-01.jpg"
                    />
                    <Button variant="secondary" onClick={addStill} disabled={!newStill.trim()} className="sm:w-auto">
                      <Plus /> Adicionar imagem
                    </Button>
                  </div>
                  {fieldError(state, "stills") ? (
                    <p className="mt-2 text-[13px] text-danger" role="alert">
                      {fieldError(state, "stills")}
                    </p>
                  ) : null}
                </div>

                <p className="rounded-2xl border border-line bg-white/[0.02] px-4 py-3 text-[13px] leading-relaxed text-mute">
                  Ainda não há envio de arquivos: imagens e vídeos entram por link. Arquivo do próprio site: caminho em
                  /media (ex.: /media/nome-do-filme.jpg). Link externo de imagem só aparece se o domínio estiver
                  liberado no site
                  {hosts.length ? ` (hoje: ${hosts.join(", ")})` : " (hoje: nenhum)"}. Link de compartilhamento do Google
                  Drive é convertido sozinho.
                </p>
              </div>
            </Card>

            {/* ---------------- Texto ---------------- */}
            <Card>
              <CardHeader title="Texto" description="O que aparece no cartão e na página do filme." />
              <div className="grid gap-4 p-5 sm:p-6">
                <Field
                  label="Resumo"
                  htmlFor="film-summary"
                  error={fieldError(state, "summary")}
                  hint={`Uma frase. Vai no cartão e no topo da página. ${summary.length}/200`}
                >
                  <Input
                    id="film-summary"
                    name="summary"
                    value={summary}
                    maxLength={200}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Ex.: A primeira luz do dia à mesa."
                  />
                </Field>
                <Field
                  label="A intenção"
                  htmlFor="film-intention"
                  error={fieldError(state, "intention")}
                  hint="O texto grande da página do case: o que o filme quer dizer e por quê."
                >
                  <Textarea
                    id="film-intention"
                    name="intention"
                    rows={5}
                    value={intention}
                    onChange={(e) => setIntention(e.target.value)}
                  />
                </Field>
              </div>
            </Card>

            {/* ---------------- Ficha técnica ---------------- */}
            <Card>
              <CardHeader
                title="Ficha técnica"
                description="Função e nome, na ordem em que aparecem."
                action={
                  <Button variant="secondary" size="sm" onClick={() => setCredits((l) => [...l, { key: newKey(), role: "", name: "" }])}>
                    <Plus /> Linha
                  </Button>
                }
              />
              <div className="p-5 sm:p-6">
                <datalist id="film-roles">
                  {ROLE_SUGGESTIONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
                {credits.length ? (
                  <ul className="grid gap-2">
                    {credits.map((c, i) => (
                      <li key={c.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <input
                          aria-label={`Função da linha ${i + 1}`}
                          list="film-roles"
                          value={c.role}
                          placeholder="Função"
                          onChange={(e) => setCredits((l) => l.map((x) => (x.key === c.key ? { ...x, role: e.target.value } : x)))}
                          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                          className="h-10 min-w-0 rounded-xl border border-line-strong bg-white/[0.03] px-3 text-[14px] text-light placeholder:text-mute focus:border-white/50 focus:outline-none"
                        />
                        <input
                          aria-label={`Nome da linha ${i + 1}`}
                          value={c.name}
                          placeholder="Nome"
                          onChange={(e) => setCredits((l) => l.map((x) => (x.key === c.key ? { ...x, name: e.target.value } : x)))}
                          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                          className="col-start-1 row-start-2 h-10 min-w-0 rounded-xl border border-line-strong bg-white/[0.03] px-3 text-[14px] text-light placeholder:text-mute focus:border-white/50 focus:outline-none sm:col-start-auto sm:row-start-auto"
                        />
                        <div className="row-span-2 flex items-center sm:row-span-1">
                          <IconButton label="Subir" disabled={i === 0} onClick={() => setCredits((l) => move(l, i, -1))}>
                            <ArrowUp />
                          </IconButton>
                          <IconButton
                            label="Descer"
                            disabled={i === credits.length - 1}
                            onClick={() => setCredits((l) => move(l, i, 1))}
                            className="hidden sm:grid"
                          >
                            <ArrowDown />
                          </IconButton>
                          <IconButton label="Remover linha" onClick={() => setCredits((l) => l.filter((x) => x.key !== c.key))}>
                            <X />
                          </IconButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[14px] text-mute">Sem ficha técnica. Ela aparece na página do filme quando tiver ao menos uma linha.</p>
                )}
                {fieldError(state, "credits") ? (
                  <p className="mt-3 text-[13px] text-danger" role="alert">
                    {fieldError(state, "credits")}
                  </p>
                ) : null}
              </div>
            </Card>
          </div>

          {/* ---------------- Lateral: prévia e publicação ---------------- */}
          <aside className="grid min-w-0 gap-4 xl:sticky xl:top-10 xl:col-span-4">
            <Card className="p-5">
              <p className="label mb-4 text-mute">Como aparece no site</p>
              <div inert className="pointer-events-none select-none">
                <FilmCard
                  film={{
                    id: initial.id ?? "novo",
                    slug: slug || "novo",
                    title: title || "Título do filme",
                    client: client.trim() || null,
                    category,
                    year: year ? Number(year) : null,
                    duration: duration || null,
                    format,
                    // next/image só aceita o que o site consegue mostrar
                    posterUrl: posterUrl && !posterProblem ? posterUrl : null,
                    previewUrl: preview?.kind === "file" ? previewUrl : null,
                    videoUrl: video ? videoUrl : null,
                    summary: summary.trim() || null,
                  }}
                />
              </div>
            </Card>

            <Card className="grid gap-5 p-5">
              <div className="grid gap-3">
                <Checkbox
                  name="published"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  label={
                    <>
                      <span className="block text-light">Publicar no site</span>
                      <span className="text-[13px] text-mute">Rascunho não aparece para ninguém.</span>
                    </>
                  }
                />
                <Checkbox
                  name="featured"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  label={
                    <>
                      <span className="block text-light">Destaque</span>
                      <span className="text-[13px] text-mute">
                        O primeiro em destaque com vídeo ganha a seção grande da página inicial.
                      </span>
                    </>
                  }
                />
              </div>

              {published && !video ? (
                <p className="flex items-start gap-2 rounded-2xl border border-warn/30 bg-warn/[0.06] px-3.5 py-3 text-[13px] text-warn">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Publicando sem vídeo: no site o filme aparece com “Vídeo em breve”.
                </p>
              ) : null}

              <ul className="grid gap-1.5 border-t border-line pt-4 text-[13px]" aria-label="O que o filme já tem">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-px grid size-[18px] shrink-0 place-items-center rounded-full border",
                        c.done ? "border-white bg-white text-void" : "border-line-strong text-mute",
                      )}
                      aria-hidden
                    >
                      {c.done ? <Check className="size-3" strokeWidth={3} /> : <Minus className="size-3" />}
                    </span>
                    <span className={c.done ? "text-light" : "text-mute"}>
                      {c.label}
                      <span className="sr-only">{c.done ? ": pronto" : ": falta"}</span>
                      {!c.done && c.hint ? <span className="block text-[12px] text-mute">{c.hint}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="hidden gap-2 border-t border-line pt-4 xl:grid">
                <StableSubmit className="w-full">{isNew ? "Criar filme" : "Salvar filme"}</StableSubmit>
                <p className={cn("text-center text-[12px]", dirty ? "text-warn" : "text-mute")}>{status}</p>
              </div>
              {!isNew && savedPublished && savedSlug ? (
                <a
                  href={`/filmes/${savedSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 text-[13px] text-ash hover:text-white"
                >
                  Ver no site <ArrowUpRight className="size-3.5" />
                </a>
              ) : null}
            </Card>
          </aside>

          {/* Barra de salvar (celular e tablet) */}
          <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-between gap-4 border-t border-line bg-void/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 xl:hidden">
            <p className={cn("text-[13px]", dirty ? "text-warn" : "text-mute")}>{status}</p>
            <StableSubmit>{isNew ? "Criar filme" : "Salvar filme"}</StableSubmit>
          </div>
        </>
      )}
    </StableForm>
  );
}

function VideoPreview({ url, format, poster }: { url: string; format: string; poster?: string }) {
  const video = parseVideo(url);
  if (!video) return null;
  const vertical = format === "9:16";
  const frame = cn(
    "overflow-hidden rounded-[16px] border border-line bg-black",
    vertical ? "aspect-[9/16] w-full max-w-[260px]" : "aspect-video w-full",
  );
  if (video.kind === "file") {
    return (
      <div className={frame}>
        <video src={video.src} poster={poster} controls preload="metadata" playsInline className="size-full object-contain" />
      </div>
    );
  }
  // Na prévia do painel o vídeo não começa sozinho.
  const src = new URL(video.embed);
  src.searchParams.set("autoplay", "0");
  return (
    <div className={frame}>
      <iframe
        src={src.toString()}
        title="Prévia do vídeo"
        loading="lazy"
        allow="fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        className="size-full"
      />
    </div>
  );
}
