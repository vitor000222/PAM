// src/lib/api.ts
export const API_URL = import.meta.env.VITE_API_URL as string;
export const CAIXA_GENERICA_ID = import.meta.env.VITE_CAIXA_GENERICA_ID as string | undefined;
export const USUARIO_ID = import.meta.env.VITE_USUARIO_ID as string | undefined;

let AUTH_TOKEN: string | null =
  (typeof localStorage !== "undefined" && localStorage.getItem("auth_token")) || null;

export function setAuthToken(token: string | null) {
  AUTH_TOKEN = token;
  if (typeof localStorage !== "undefined") {
    if (token) localStorage.setItem("auth_token", token);
    else localStorage.removeItem("auth_token");
  }
}
export function getAuthToken() { return AUTH_TOKEN; }

function envList(key: string, fallbacks: string[]): string[] {
  const list =
    (import.meta.env[key as any] as string | undefined)
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const single = (import.meta.env[(key.replace("PATHS", "PATH") as any)] as string | undefined);
  if (single && !list.includes(single)) list.unshift(single);
  return list.length ? list : fallbacks;
}

async function j<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const headers = new Headers(init.headers || {});
  if (!isForm && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (AUTH_TOKEN) headers.set("Authorization", `Bearer ${AUTH_TOKEN}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json() as Promise<T>;
  return (await res.text()) as unknown as T;
}

/** ========= Auth com .env + fallbacks pt-BR ========= */
const LOGIN_PATHS = envList("VITE_AUTH_LOGIN_PATHS", [
  "/usuarios/login",
  "/auth/login",
  "/login",
  "/sessions",
]);
const ME_PATHS = envList("VITE_AUTH_ME_PATHS", [
  "/usuarios/me",
  "/me",
  "/auth/me",
  "/users/me",
  "/usuario/me",
]);

export async function login(email: string, password: string) {
  const body = { email, password, senha: password }; // compat: alguns backends usam "senha"
  let lastErr: any = null;
  for (const path of LOGIN_PATHS) {
    try {
      const data = await j<any>(path, { method: "POST", body: JSON.stringify(body) });
      const token =
        data?.token ??
        data?.access_token ??
        data?.accessToken ??
        data?.jwt ??
        data?.data?.token ??
        data?.data?.access_token ??
        data?.data?.jwt ??
        null;
      if (!token) throw new Error("Token não retornado pelo backend.");
      setAuthToken(String(token));
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Falha no login");
}

export async function getMe<T = any>() {
  for (const path of ME_PATHS) {
    try {
      return await j<T>(path);
    } catch {
      // tenta próxima
    }
  }
  throw new Error("Nenhuma rota de /me respondeu com sucesso");
}

/** ========= CLIENTES ========= */
export type ClientePayload = {
  nome: string;
  cnpj: string;           // somente dígitos
  moc_id: string;         // UUID da MOC
  segmento?: string | null;
};

export function listClients<T = any[]>(q?: string) {
  const query = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return j<T>(`/clientes${query}`);
}

export function createClient<T = any>(payload: ClientePayload) {
  return j<T>("/clientes", { method: "POST", body: JSON.stringify(payload) });
}

/** ========= MOCs ========= */
export type Moc = { id: string; nome: string; codigo?: string; ativo?: boolean };
export function listMocs<T = Moc[]>() { return j<T>("/mocs"); }

/** ========= PROJETOS ========= */
export function listProjects<T = any[]>() { return j<T>("/projetos"); }

export function createProject<T = { id: string }>(payload: {
  nome: string;
  descricao?: string | null;
  template?: string | null;
  cliente_id: string;
}) {
  return j<T>("/projetos", { method: "POST", body: JSON.stringify(payload) });
}

export function getProject<T = any>(id: string) { return j<T>(`/projetos/${id}`); }

/** Mapeamentos ligados a um projeto */
export function listProjectMappings<T = any[]>(projectId: string) {
  return j<T>(`/projetos/${projectId}/mapeamentos`);
}

export function createProjectMapping<T = { id: string }>(
  projectId: string,
  payload: { nome: string; tipo: "AS_IS" | "TO_BE" }
) {
  return j<T>(`/projetos/${projectId}/mapeamentos`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** ========= MAPEAMENTOS (LEGADO) ========= */
export function createMap(payload: {
  projetoId?: string | null;
  caixaId?: string | null;
  tipo: 'AS_IS' | 'TO_BE';
  baseAsIsId?: string | null;
  escopoId?: string | null;
  criadoPor: string;
  notas?: string | null;
}) {
  return j<{ id: string }>('/mapeamentos', { method: 'POST', body: JSON.stringify(payload) });
}

/** ========= DIAGRAMAS ========= */
export type ElementoDiagrama = {
  elementoId: string;
  bpmnTipo: string;
  nome?: string | null;
  props?: any;
};

export function saveDiagram(
  mapeamentoId: string,
  payload: {
    nome?: string;
    versao?: number;
    bpmnXml: string;
    criadoPor?: string | null;
    elementos: ElementoDiagrama[];
  }
) {
  return j<{ diagramaId: string }>(`/mapeamentos/${mapeamentoId}/diagramas`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** ========= ANEXOS EM MAPEAMENTOS ========= */
export function uploadMappingAttachment<T = any>(mapeamentoId: string, tipo: TipoAnexo, file: File) {
  const form = new FormData();
  form.append("tipo", tipo);
  form.append("arquivo", file);
  return j<T>(`/mapeamentos/${mapeamentoId}/anexos`, { method: "POST", body: form });
}

// ✅ ADICIONE isto logo abaixo:
export type MappingAttachment = { name: string; url: string };

export function listMappingAttachments<T = MappingAttachment[]>(mapeamentoId: string) {
  return j<T>(`/mapeamentos/${mapeamentoId}/anexos`);
}

/** ========= IA (n8n) ========= */

export type IaJobStatus = "AGUARDANDO" | "GERANDO" | "CONCLUIDO" | "ERRO";
export type IaJob = {
  id: string;
  workflow_chave: string;
  status: IaJobStatus;
  criado_em: string;
  iniciado_em?: string | null;
  finalizado_em?: string | null;
  erro?: string | null;
};

export function createIaJob<T = { jobId: string; status: IaJobStatus }>(
  mappingId: string,
  payload: {
    workflow?: string;          // ex: "generate_to_be" (default no server)
    anexoId?: string | null;    // se quiser passar só o id
    anexoUrl?: string | null;   // ou URL absoluta do anexo (server / n8n decidem)
    notes?: string | null;      // observações/prompt extra
  }
) {
  return j<T>(`/mapeamentos/${mappingId}/ia/jobs`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listIaJobs<T = IaJob[]>(mappingId: string) {
  return j<T>(`/mapeamentos/${mappingId}/ia/jobs`);
}

// teste de funcionalidade da geração via IA (n8n)

export function startAiXml(
  mapeamentoId: string,
  payload: { fontes?: Array<{ url: string; tipo?: string }>; prompt?: string }
) {
  return j<{ jobId: string }>(`/mapeamentos/${mapeamentoId}/diagramas/ai`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function pollAiXml(mapeamentoId: string, jobId: string) {
  return j<{ status: 'queued'|'processing'|'done'|'failed'; xml?: string; error?: string }>(
    `/mapeamentos/${mapeamentoId}/diagramas/ai/${jobId}`
  );
}
