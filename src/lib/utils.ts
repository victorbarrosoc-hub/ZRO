import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Ensina o tailwind-merge sobre os tokens da ZRO, senão ele confunde
// "text-h1" (tamanho) com "text-light" (cor) e descarta um dos dois.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display", "h1", "h2", "h3", "manifesto", "body-lg", "ui", "caption", "label"],
      color: [
        "void",
        "ink",
        "graphite",
        "smoke",
        "mist",
        "dim",
        "mute",
        "ash",
        "light",
        "white",
        "logo",
        "line",
        "line-strong",
        "paper",
        "paper-ink",
        "paper-mute",
        "paper-line",
        "abs-ice",
        "abs-blue",
        "abs-deep",
        "ok",
        "warn",
        "danger",
      ],
      radius: ["card", "field", "thumb", "media"],
      ease: ["out-expo"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Gera um id aleatório. */
export function newId() {
  return crypto.randomUUID();
}

/** Transforma um texto em slug de URL ("Filme SERHS 2026" → "filme-serhs-2026"). */
export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
