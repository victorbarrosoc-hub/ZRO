/**
 * Erros do Google num formato só (puro). Nada aqui loga corpo, token ou URI de sessão:
 * `redigir` apaga o que for segredo antes de qualquer texto sair daqui.
 */

export type MotivoGoogle =
  | "sem_config" // faltam as chaves na Vercel
  | "sem_google" // ninguém conectou o Drive
  | "reconectar" // refresh token morto (invalid_grant) ou chave trocada
  | "sem_espaco" // storageQuotaExceeded
  | "limite_diario" // 750 GB/dia (userRateLimitExceeded que não passa)
  | "taxa" // 429, rateLimitExceeded, 5xx: vale tentar de novo
  | "pasta" // a pasta de destino não existe (404 no pai)
  | "nao_encontrado" // 404 em outra coisa
  | "sem_permissao" // insufficientFilePermissions, forbidden
  | "compartilhamento_bloqueado" // regra do Workspace
  | "auth" // 401: token de acesso vencido (driveFetch renova)
  | "rede" // sem resposta
  | "google"; // o resto

export class GoogleError extends Error {
  status: number;
  motivo: MotivoGoogle;
  detalhe?: string;
  constructor(motivo: MotivoGoogle, status = 0, detalhe?: string) {
    super(detalhe ? `${motivo}: ${redigir(detalhe)}` : motivo);
    this.name = "GoogleError";
    this.motivo = motivo;
    this.status = status;
    this.detalhe = detalhe ? redigir(detalhe) : undefined;
  }
}

export function ehGoogleError(e: unknown): e is GoogleError {
  return e instanceof GoogleError;
}

const COMPARTILHAMENTO = new Set([
  "publishOutNotPermitted",
  "cannotShareTeamDriveWithNonGoogleAccounts",
  "invalidSharingRequest",
  "shareOutNotPermitted",
  "shareInNotPermitted",
  "teamDriveDomainUsersOnlyRestriction",
]);
const TAXA = new Set(["rateLimitExceeded", "userRateLimitExceeded", "backendError", "internalError", "sharingRateLimitExceeded"]);

/** Resposta de erro do Google (Drive ou OAuth) → GoogleError. */
export function deResposta(status: number, json: unknown): GoogleError {
  const corpo = (json ?? {}) as {
    error?: string | { code?: number; message?: string; errors?: { reason?: string; message?: string }[] };
    error_description?: string;
  };
  // OAuth: { error: "invalid_grant", error_description }
  if (typeof corpo.error === "string") {
    if (corpo.error === "invalid_grant") return new GoogleError("reconectar", status, corpo.error);
    if (status === 429 || status >= 500) return new GoogleError("taxa", status, corpo.error);
    return new GoogleError("google", status, corpo.error);
  }
  const razao = corpo.error?.errors?.[0]?.reason ?? "";
  const detalhe = razao || corpo.error?.message || `HTTP ${status}`;
  if (status === 401) return new GoogleError("auth", status, detalhe);
  if (razao === "storageQuotaExceeded" || razao === "quotaExceeded") return new GoogleError("sem_espaco", status, razao);
  if (COMPARTILHAMENTO.has(razao)) return new GoogleError("compartilhamento_bloqueado", status, razao);
  if (status === 429 || status >= 500 || TAXA.has(razao)) return new GoogleError("taxa", status, detalhe);
  if (status === 404 || razao === "notFound") return new GoogleError("nao_encontrado", status, detalhe);
  if (razao === "insufficientFilePermissions" || razao === "forbidden" || razao === "insufficientPermissions" || status === 403) {
    return new GoogleError("sem_permissao", status, detalhe);
  }
  return new GoogleError("google", status, detalhe);
}

/** A razão do Google ("userRateLimitExceeded"…), para decidir recuo. */
export function razaoDoErro(json: unknown): string {
  const corpo = (json ?? {}) as { error?: { errors?: { reason?: string }[] } };
  return typeof corpo.error === "object" ? (corpo.error?.errors?.[0]?.reason ?? "") : "";
}

/** Apaga segredo de qualquer texto: upload_id, Bearer, code, tokens. */
export function redigir(texto: string): string {
  return String(texto ?? "")
    .replace(/upload_id=[^&\s"']+/gi, "upload_id=…")
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer …")
    .replace(/([?&]code=)[^&\s"']+/gi, "$1…")
    .replace(/(refresh_token|access_token|client_secret|code_verifier)(["']?\s*[:=]\s*["']?)[^&\s"',}]+/gi, "$1$2…")
    .replace(/ya29\.[A-Za-z0-9._-]+/g, "ya29.…")
    .replace(/1\/\/[A-Za-z0-9._-]+/g, "1//…")
    .slice(0, 500);
}
