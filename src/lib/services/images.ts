import "server-only";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { images } = schema;

/** Até 400 KB por imagem (o navegador manda ~30 a 80 KB). */
const MAX_BYTES = 400 * 1024;

/** Formatos aceitos e a assinatura do arquivo. SVG fica de fora: pode carregar script. */
const SIGNATURES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};

type ImageInput = { mime: string; data: string; bytes: number; width: number; height: number };

export type ImageField = { action: "keep" } | { action: "remove" } | { action: "set"; image: ImageInput };

/** "384x384" → [384, 384] (lado entre 1 e 4096; fora disso, 0). */
function readSize(value: FormDataEntryValue | null) {
  const m = /^(\d{1,4})x(\d{1,4})$/.exec(String(value ?? ""));
  const side = (n: string | undefined) => {
    const v = Number(n);
    return v >= 1 && v <= 4096 ? v : 0;
  };
  return [side(m?.[1]), side(m?.[2])] as const;
}

/**
 * Campo de imagem do formulário (ver ImageField no navegador):
 * vazio mantém a atual, "remover" tira, e um data URL troca.
 */
export function readImageField(fd: FormData, name: string): ImageField | { error: string } {
  const raw = fd.get(name);
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { action: "keep" };
  if (value === "remover") return { action: "remove" };

  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!m) return { error: "Imagem em formato não aceito. Use JPG, PNG ou WebP." };
  const [, mime, data] = m;
  const buffer = Buffer.from(data, "base64");
  if (!buffer.length) return { error: "Imagem vazia. Escolha outra." };
  if (buffer.length > MAX_BYTES) return { error: "Imagem grande demais. Escolha outra." };
  const signature = SIGNATURES[mime];
  const webpOk = mime !== "image/webp" || buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (!signature.every((b, i) => buffer[i] === b) || !webpOk) return { error: "Arquivo de imagem inválido. Escolha outra." };

  const [width, height] = readSize(fd.get(`${name}Size`));
  return { action: "set", image: { mime, data, bytes: buffer.length, width, height } };
}

/** Grava a imagem nova (se houver) e devolve o id que fica na linha. */
export async function resolveImageField(field: ImageField, currentId: string | null | undefined) {
  if (field.action === "keep") return currentId ?? null;
  if (field.action === "remove") return null;
  const [row] = await db.insert(images).values(field.image).returning({ id: images.id });
  return row.id;
}

/** Apaga imagens que deixaram de ser usadas. */
export async function deleteImages(ids: (string | null | undefined)[]) {
  const list = ids.filter((id): id is string => Boolean(id));
  if (list.length) await db.delete(images).where(inArray(images.id, list));
}
