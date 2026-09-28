"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "./avatar";

/** Lado da imagem guardada: nítida até no maior avatar em tela de retina. */
const OUT = 384;

type Kind = "foto" | "logo";

function loadImage(file: File) {
  return new Promise<{ img: HTMLImageElement; done: () => void }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, done: () => URL.revokeObjectURL(url) });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imagem ilegível."));
    };
    img.src = url;
  });
}

function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Sem canvas.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { c, ctx };
}

/** Recorta e reduz em etapas (metade por vez), para a foto não serrilhar. */
function scaled(src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, dw: number, dh: number, background?: string) {
  let cur: CanvasImageSource = src;
  let [x, y, w, h] = [sx, sy, sw, sh];
  while (w / 2 >= dw && h / 2 >= dh) {
    const step = canvas(Math.round(w / 2), Math.round(h / 2));
    step.ctx.drawImage(cur, x, y, w, h, 0, 0, step.c.width, step.c.height);
    [cur, x, y, w, h] = [step.c, 0, 0, step.c.width, step.c.height];
  }
  const out = canvas(dw, dh);
  if (background) {
    out.ctx.fillStyle = background;
    out.ctx.fillRect(0, 0, dw, dh);
  }
  out.ctx.drawImage(cur, x, y, w, h, 0, 0, dw, dh);
  return out.c;
}

/** Foto: quadrado do centro (no retrato, puxado para cima, onde costuma estar o rosto). */
function squarePhoto(img: HTMLImageElement) {
  const { naturalWidth: w, naturalHeight: h } = img;
  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = h > w ? (h - side) * 0.3 : 0;
  return scaled(img, sx, sy, side, side, OUT, OUT, "#111111");
}

/**
 * Logo: vira um quadrado com respiro. Fundo transparente ganha branco (logo escura)
 * ou quase preto (logo clara); fundo sólido continua com a cor do canto.
 * Logo que já é quadrada e sem transparência (foto de perfil) só é recortada.
 */
function logoTile(img: HTMLImageElement) {
  const { naturalWidth: w, naturalHeight: h } = img;
  const S = 48;
  const probe = canvas(S, S);
  probe.ctx.drawImage(img, 0, 0, S, S);
  const px = probe.ctx.getImageData(0, 0, S, S).data;
  let transparent = 0;
  let lum = 0;
  let solid = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 250) transparent++;
    if (px[i + 3] > 128) {
      lum += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      solid++;
    }
  }
  const hasAlpha = transparent > S * S * 0.02;
  const ratio = w / h;
  if (!hasAlpha && ratio > 0.9 && ratio < 1.11) {
    const side = Math.min(w, h);
    return scaled(img, (w - side) / 2, (h - side) / 2, side, side, OUT, OUT, "#ffffff");
  }
  const background = hasAlpha ? (solid && lum / solid > 0.6 ? "#111111" : "#ffffff") : `rgb(${px[0]}, ${px[1]}, ${px[2]})`;
  const box = OUT * 0.72;
  const scale = Math.min(box / w, box / h, 4);
  const dw = Math.max(1, Math.round(w * scale));
  const dh = Math.max(1, Math.round(h * scale));
  const mark = scaled(img, 0, 0, w, h, dw, dh);
  const out = canvas(OUT, OUT);
  out.ctx.fillStyle = background;
  out.ctx.fillRect(0, 0, OUT, OUT);
  out.ctx.drawImage(mark, Math.round((OUT - dw) / 2), Math.round((OUT - dh) / 2));
  return out.c;
}

async function prepare(file: File, kind: Kind) {
  const { img, done } = await loadImage(file);
  try {
    const c = kind === "foto" ? squarePhoto(img) : logoTile(img);
    if (kind === "logo") {
      const png = c.toDataURL("image/png");
      if (png.startsWith("data:image/png") && png.length < 200_000) return png;
    }
    return c.toDataURL("image/jpeg", kind === "logo" ? 0.92 : 0.86);
  } finally {
    done();
  }
}

/**
 * Foto do freela ou logo do cliente dentro de um formulário.
 * A imagem é reduzida aqui mesmo (384 px) e vai num campo escondido:
 * vazio mantém a atual, "remover" tira, data URL troca. Só grava ao salvar.
 */
export function ImageField({
  name,
  kind,
  currentId,
  displayName = "",
  error,
}: {
  name: string;
  kind: Kind;
  currentId?: string | null;
  displayName?: string;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const isNew = value.startsWith("data:");
  const removed = value === "remover";
  const has = isNew || (!removed && Boolean(currentId));
  const noun = kind === "foto" ? "foto" : "logo";

  async function onFile(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setProblem(null);
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      setProblem("Escolha uma imagem JPG ou PNG.");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setProblem("Arquivo grande demais. Escolha uma imagem de até 30 MB.");
      return;
    }
    setBusy(true);
    try {
      setValue(await prepare(file, kind));
    } catch {
      setProblem("Não consegui abrir essa imagem. Tente outra, em JPG ou PNG.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar
        name={displayName}
        imageId={removed || isNew ? null : currentId}
        src={isNew ? value : null}
        logo={kind === "logo"}
        size="xl"
      />
      <div className="grid min-w-0 gap-2">
        <p className="text-[13px] font-medium text-ash">{kind === "foto" ? "Foto" : "Logo"}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
            {kind === "foto" ? <Camera /> : <ImagePlus />}
            {busy ? "Preparando…" : has ? `Trocar ${noun}` : `Escolher ${noun}`}
          </Button>
          {has ? (
            <Button size="sm" variant="ghost" onClick={() => setValue(currentId ? "remover" : "")} disabled={busy}>
              <Trash2 /> Remover
            </Button>
          ) : null}
          {currentId && (isNew || removed) ? (
            <Button size="sm" variant="ghost" onClick={() => setValue("")} disabled={busy}>
              <Undo2 /> Desfazer
            </Button>
          ) : null}
        </div>
        {problem || error ? (
          <p className="text-[13px] text-danger" role="alert">
            {problem ?? error}
          </p>
        ) : null}
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input type="hidden" name={name} value={value} />
      <input type="hidden" name={`${name}Size`} value={isNew ? `${OUT}x${OUT}` : ""} />
    </div>
  );
}
