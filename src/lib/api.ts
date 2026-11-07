export type Tokens = { access_token: string; refresh_token: string };
export type DownloadFormat = 'csv' | 'xlsx' | 'pdf' | 'jpeg';
const downloadTypes = { csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pdf: 'application/pdf', jpeg: 'image/jpeg' };
const downloadNames = { csv: 'CSV', xlsx: 'Excel', pdf: 'PDF', jpeg: 'photo' };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Memory-only credentials: a reload requires sign-in. Never persist bearer tokens.
export function createApi(fetcher: typeof fetch = fetch, expired = () => {}) {
  let tokens: Tokens | null = null;
  let generation = 0;
  let refreshing: Promise<void> | null = null;

  function setTokens(value: Tokens | null) {
    tokens = value;
    generation++;
    refreshing = null;
  }

  async function send<T>(
    path: string,
    init: RequestInit,
    token?: string,
    csv: DownloadFormat | false = false,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetcher(`/api${path}`, {
        ...init,
        cache: "no-store",
        headers: {
          Accept: csv ? downloadTypes[csv] : "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new ApiError(
        "Cannot reach the campus server. Check your connection and try again.",
        0,
      );
    }
    if (csv && response.ok) {
      if (response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== downloadTypes[csv]) {
        throw new ApiError(`The server did not return a ${downloadNames[csv]} file. Please try again.`, 502);
      }
      try { return await response.blob() as T; }
      catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        throw new ApiError(`The ${downloadNames[csv]} download was interrupted. Please try again.`, 0);
      }
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError(
        response.status >= 500
          ? "The campus server could not complete this request. Please try again."
          : typeof body?.error === "string"
            ? body.error
            : `Request failed (${response.status}).`,
        response.status,
      );
    }
    if (
      !body ||
      body.success !== true ||
      !("data" in body || "message" in body)
    ) {
      throw new ApiError(
        "The server returned an unexpected response. Please try again.",
        502,
      );
    }
    return body.data as T;
  }

  async function request<T>(path: string, init: RequestInit = {}, csv: DownloadFormat | false = false): Promise<T> {
    const original = tokens;
    const started = generation;
    try {
      return await send<T>(path, init, original?.access_token, csv);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || !original)
        throw error;
      if (generation !== started) {
        // Never retry a request under a different account or signed-out session.
        throw new ApiError("Your session changed. Please try again.", 401);
      }
      if (tokens === original && !refreshing) {
        refreshing = (async () => {
          try {
            const rotated = await send<Tokens>("/auth/refresh", {
              method: "POST",
              body: JSON.stringify({ refresh_token: original.refresh_token }),
            });
            if (generation !== started)
              throw new ApiError(
                "Your session changed. Please sign in again.",
                401,
              );
            tokens = rotated;
          } catch (refreshError) {
            if (
              generation === started &&
              refreshError instanceof ApiError &&
              refreshError.status === 401
            ) {
              setTokens(null);
              expired();
            }
            throw refreshError;
          } finally {
            if (generation === started) refreshing = null;
          }
        })();
      }
      if (refreshing) await refreshing;
      if (generation !== started || !tokens)
        throw new ApiError("Please sign in again.", 401);
      try {
        return await send<T>(path, init, tokens.access_token, csv);
      } catch (retryError) {
        if (
          generation === started &&
          retryError instanceof ApiError &&
          retryError.status === 401
        ) {
          setTokens(null);
          expired();
        }
        throw retryError;
      }
    }
  }

  return {
    request: <T>(path: string, init: RequestInit = {}) => request<T>(path, init),
    async download(path: string, signal?: AbortSignal, format: DownloadFormat = 'csv') {
      const started = generation;
      const blob = await request<Blob>(path, { signal }, format);
      if (generation !== started) throw new ApiError("Your session changed. Download the report again after signing in.", 401);
      return blob;
    },
    setTokens,
    async googleLogin(credential: string, challenge_token: string) {
      const started = generation;
      const value = await send<Tokens>("/auth/google/login", {
        method: "POST", body: JSON.stringify({ credential, challenge_token }),
      });
      if (generation !== started) throw new ApiError("Your session changed. Please try again.", 401);
      setTokens(value);
    },
    async login(email: string, password: string) {
      const value = await send<Tokens>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setTokens(value);
    },
    async logout() {
      if (!tokens) return;
      // Refresh first if needed so logout revokes the currently rotated refresh token.
      await request("/auth/me");
      if (!tokens) return;
      const current = tokens;
      // Leave failures visible so the user can retry server-side revocation.
      try {
        await send(
          "/auth/logout",
          {
            method: "POST",
            body: JSON.stringify({ refresh_token: current.refresh_token }),
          },
          current.access_token,
        );
      } catch (error) {
        // An unusable token cannot be revoked again; still end the local session.
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
      }
      setTokens(null);
    },
  };
}

export const api = createApi(fetch, () =>
  window.dispatchEvent(new Event("cfabs:expired")),
);
