import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";

type User = {
  id: string;
  nome: string;
  email: string;
  role?: "admin" | "member";
  conta_id?: string | null;
  conta?: { id: string; nome: string } | null;
};

type AuthCtx = {
  ready: boolean;
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateProfile: (payload: Partial<Pick<User, "nome">>) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

let AUTH_TOKEN: string | null =
  (typeof localStorage !== "undefined" && localStorage.getItem("auth_token")) ||
  null;

function setAuthToken(token: string | null) {
  AUTH_TOKEN = token;
  if (typeof localStorage !== "undefined") {
    if (token) localStorage.setItem("auth_token", token);
    else localStorage.removeItem("auth_token");
  }
}

/** ===================== ENV/Helpers ===================== */
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

const ABS_LOGIN = (import.meta.env.VITE_AUTH_LOGIN_ABSOLUTE as string | undefined) || undefined;
const ABS_ME    = (import.meta.env.VITE_AUTH_ME_ABSOLUTE as string | undefined) || undefined;
const DEBUG     = (import.meta.env.VITE_AUTH_DEBUG as string | undefined) === "1";
const DEV_BYPASS= (import.meta.env.VITE_DEV_BYPASS_AUTH as string | undefined) === "1";

// Fallbacks pt-BR + comuns
const LOGIN_PATHS = envList("VITE_AUTH_LOGIN_PATHS", [
  "/usuarios/login",
  "/auth/login",
  "/login",
  "/sessions",
  "/api/auth/login",
  "/api/login",
  "/api/sessions",
  "/api/usuarios/login",
]);

const ME_PATHS = envList("VITE_AUTH_ME_PATHS", [
  "/usuarios/me",
  "/me",
  "/auth/me",
  "/users/me",
  "/usuario/me",
  "/api/me",
  "/api/auth/me",
  "/api/usuarios/me",
]);

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}
function buildUrls(base: string, paths: string[], absolute?: string) {
  return absolute ? [absolute] : uniq(paths.map(p => `${base}${p}`));
}

function extractToken(j: any): string | null {
  return (
    j?.token ??
    j?.access_token ??
    j?.accessToken ??
    j?.jwt ??
    j?.data?.token ??
    j?.data?.access_token ??
    j?.data?.jwt ??
    null
  );
}

/** ===================== Provider ===================== */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(AUTH_TOKEN);

  function setTokenPersist(t: string | null) {
    setToken(t);
    setAuthToken(t);
  }

  async function fetchMe(): Promise<User | null> {
    if (DEV_BYPASS) {
      // Mock de usuário para dev
      return {
        id: "dev-user",
        nome: "Dev User",
        email: "dev@example.com",
        role: "admin",
        conta_id: "dev-conta",
        conta: { id: "dev-conta", nome: "Conta Dev" },
      };
    }

    const urls = buildUrls(API_URL, ME_PATHS, ABS_ME);
    if (DEBUG) console.info("[Auth] Tentando /me em:", urls);

    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) {
          if (DEBUG) console.warn("[Auth] /me falhou:", res.status, url);
          continue;
        }
        const j = await res.json();
        const raw: any = j?.user ?? j?.usuario ?? j?.data ?? j;
        if (!raw?.id) {
          if (DEBUG) console.warn("[Auth] /me sem campo id:", j);
          continue;
        }
        const conta = raw?.conta ?? raw?.account ?? raw?.organization ?? raw?.org ?? null;
        const mapped: User = {
          id: String(raw.id),
          nome: String(raw.nome ?? raw.name ?? "Usuário"),
          email: String(raw.email ?? ""),
          role: (raw.role ?? raw.papel ?? "member") as any,
          conta_id: conta?.id ?? raw?.conta_id ?? raw?.account_id ?? null,
          conta: conta
            ? { id: String(conta.id), nome: String(conta.nome ?? conta.name ?? "Conta") }
            : null,
        };
        return mapped;
      } catch (e) {
        if (DEBUG) console.error("[Auth] Erro /me:", e);
      }
    }
    return null;
  }

  async function refresh() {
    if (!token && !DEV_BYPASS) {
      setUser(null);
      return;
    }
    const u = await fetchMe();
    setUser(u);
  }

  async function login(email: string, password: string) {
    if (DEV_BYPASS) {
      if (DEBUG) console.info("[Auth] DEV_BYPASS_AUTH=1 — pulando login real.");
      setTokenPersist("dev-token");
      await refresh();
      return;
    }

    const urls = buildUrls(API_URL, LOGIN_PATHS, ABS_LOGIN);
    if (DEBUG) console.info("[Auth] Tentando login em:", urls);

    let lastErr: any = null;
    const body = { email, password, senha: password }; // compat: alguns backends usam "senha"

    for (const url of urls) {
      try {
        if (DEBUG) console.debug("[Auth] POST", url);
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.status === 401 || res.status === 403) {
          // Encontrou a rota, mas credenciais inválidas
          const msg = await res.text().catch(() => "Credenciais inválidas");
          throw new Error(msg || "Credenciais inválidas");
        }

        if (!res.ok) {
          // 404/500/etc → tenta próxima rota
          lastErr = new Error(`${res.status} ${res.statusText} @ ${url}`);
          continue;
        }

        const j = await res.json();
        const tok = extractToken(j);
        if (!tok) throw new Error("Token não retornado pelo backend.");
        setTokenPersist(String(tok));
        await refresh();
        return;
      } catch (e) {
        lastErr = e;
        if (DEBUG) console.error("[Auth] Falha login em", url, e);
      }
    }

    // sem sucesso
    const tried = urls.join(", ");
    throw new Error(`[Auth] Falha no login. URLs tentadas: ${tried}. Erro: ${String(lastErr?.message || lastErr)}`);
  }

  function logout() {
    setTokenPersist(null);
    setUser(null);
  }

  async function updateProfile(payload: Partial<Pick<User, "nome">>) {
    if (DEV_BYPASS) return; // sem-op em dev bypass
    const res = await fetch(`${API_URL}/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    await refresh();
  }

  async function changePassword(current: string, next: string) {
    if (DEV_BYPASS) return;
    const candidates = envList("VITE_AUTH_PASSWORD_PATHS", ["/me/password", "/auth/password"]);
    const urls = buildUrls(API_URL, candidates, (import.meta.env.VITE_AUTH_PASSWORD_ABSOLUTE as string | undefined) || undefined);
    let ok = false, lastErr: any = null;
    for (const url of urls) {
      try {
        const body =
          url.includes("/auth/") ? { old_password: current, new_password: next } : { current, next };
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          lastErr = new Error(await res.text());
          continue;
        }
        ok = true;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!ok) throw lastErr ?? new Error("Falha ao alterar senha");
  }

  useEffect(() => {
    (async () => {
      await refresh();
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const value = useMemo(
    () => ({ ready, user, token, login, logout, refresh, updateProfile, changePassword }),
    [ready, user, token]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
