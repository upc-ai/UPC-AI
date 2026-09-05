"use client";

/**
 * API client: in-memory access token (never localStorage), Bearer header,
 * single silent-refresh retry on 401 (Frontend Architecture §1.4).
 */

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "include" });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { access_token?: string } };
    const token = json.data?.access_token ?? null;
    accessToken = token;
    return token;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
  opts: { skipAuth?: boolean } = {},
): Promise<T> {
  const doFetch = async (token: string | null) =>
    fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        // FormData sets its own multipart boundary header — forcing JSON breaks it
        ...(init.body && !(typeof FormData !== "undefined" && init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

  let token = opts.skipAuth ? null : accessToken;
  let res = await doFetch(token);

  // Single silent refresh + retry on 401
  if (res.status === 401 && !opts.skipAuth) {
    token = await refreshAccessToken();
    if (token) res = await doFetch(token);
  }

  if (!res.ok) {
    let code = "INTERNAL_ERROR";
    let message = "Something went wrong";
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as { data?: T };
  return (json.data ?? (json as unknown)) as T;
}

/** Boot-time silent session restore: refresh cookie → access token. */
export async function restoreSession(): Promise<string | null> {
  if (accessToken) return accessToken;
  return refreshAccessToken();
}
