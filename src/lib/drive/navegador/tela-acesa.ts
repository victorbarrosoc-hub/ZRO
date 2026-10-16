/**
 * Tela acesa enquanto sobe (Screen Wake Lock). Porte de mobile/lib/wakelock.js do SOBEDESCE.
 * O sistema solta a trava quando a página some; pedimos de novo ao voltar. Sem suporte ou sem
 * permissão, segue sem ela (a tela pede para manter aberta).
 */

type Sentinela = { release(): Promise<void>; addEventListener(t: "release", f: () => void): void };

let sentinela: Sentinela | null = null;
let querida = false;
let pedindo: Promise<void> | null = null;
let ouvindo = false;

export function telaAcesaSuportada(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

async function pedir() {
  if (!telaAcesaSuportada() || sentinela || pedindo || document.visibilityState !== "visible") return;
  const wl = (navigator as Navigator & { wakeLock: { request(t: "screen"): Promise<Sentinela> } }).wakeLock;
  pedindo = wl
    .request("screen")
    .then((s) => {
      sentinela = s;
      s.addEventListener("release", () => {
        if (sentinela === s) sentinela = null;
      });
      if (!querida) soltar();
    })
    .catch(() => {})
    .finally(() => {
      pedindo = null;
    });
  await pedindo;
}

function soltar() {
  const s = sentinela;
  sentinela = null;
  if (s) s.release().catch(() => {});
}

/** Liga ou desliga a trava (idempotente). */
export function manterTelaAcesa(ligar: boolean): void {
  if (typeof document === "undefined") return;
  if (!ouvindo) {
    ouvindo = true;
    document.addEventListener("visibilitychange", () => {
      if (querida && document.visibilityState === "visible") void pedir();
    });
  }
  if (ligar === querida) return;
  querida = ligar;
  if (ligar) void pedir();
  else soltar();
}
