/**
 * Tamanho, velocidade e tempo em português (puro). Base 1000, como o Finder e os cartões:
 * um cartão de "256 GB" aparece como 256 GB.
 */

const UNIDADES = ["B", "KB", "MB", "GB", "TB", "PB"];

function umaCasa(n: number) {
  const r = Math.round(n * 10) / 10;
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace(".", ",");
}

/** 212_400_000_000 → "212,4 GB"; 12_000_000 → "12 MB"; 512 → "512 B". */
export function bytesBR(n: number | null | undefined): string {
  let v = Math.max(0, Number(n) || 0);
  if (v < 1000) return `${Math.round(v)} B`;
  let i = 0;
  while (v >= 1000 && i < UNIDADES.length - 1) {
    v /= 1000;
    i++;
  }
  // 999,96 MB arredonda para "1000 MB": sobe a unidade.
  if (Math.round(v * 10) / 10 >= 1000 && i < UNIDADES.length - 1) {
    v /= 1000;
    i++;
  }
  return `${umaCasa(v)} ${UNIDADES[i]}`;
}

/** Bytes por segundo → "42 MB/s", "1,5 MB/s", "850 KB/s". */
export function velocidadeBR(bps: number | null | undefined): string {
  let v = Math.max(0, Number(bps) || 0);
  if (v < 1000) return `${Math.round(v)} B/s`;
  let i = 0;
  while (v >= 1000 && i < UNIDADES.length - 1) {
    v /= 1000;
    i++;
  }
  const texto = v >= 10 ? String(Math.round(v)) : umaCasa(v);
  return `${texto} ${UNIDADES[i]}/s`;
}

/** Segundos → "menos de 1 min", "52 min", "2 h", "2 h 10 min". */
export function tempoBR(seg: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  if (s < 60) return "menos de 1 min";
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h} h ${resto} min` : `${h} h`;
}

/** GB (base 1000) → bytes. */
export const GB = 1000 ** 3;
