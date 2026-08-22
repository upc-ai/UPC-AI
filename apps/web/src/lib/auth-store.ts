"use client";

import { useSyncExternalStore } from "react";
import { api, restoreSession, setAccessToken } from "./api-client";

/**
 * Minimal auth store (module-level, subscribe via useSyncExternalStore).
 * Access token lives in memory only; the refresh cookie is httpOnly.
 */

export interface AuthUser {
  user_id: string;
  email: string;
  display_name: string;
  user_type: "student" | "faculty" | "admin";
  is_verified?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "anonymous";
}

let state: AuthState = { user: null, status: "loading" };
const listeners = new Set<() => void>();

function set(next: Partial<AuthState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

/** Server snapshot for static prerender: always the logged-out loading state.
    Must be a stable module constant — useSyncExternalStore re-renders in a loop
    if getServerSnapshot returns a fresh object each call. */
const SERVER_SNAPSHOT: AuthState = { user: null, status: "loading" };

function getServerSnapshot(): AuthState {
  return SERVER_SNAPSHOT;
}

let bootstrapped = false;

/** Call once (app mount): refresh cookie → token → /users/me. */
export async function bootstrapAuth() {
  if (typeof window === "undefined") return; // SSR/prerender: no session to restore
  if (bootstrapped) return;
  bootstrapped = true;
  const token = await restoreSession();
  if (!token) {
    set({ user: null, status: "anonymous" });
    return;
  }
  try {
    const user = await api<AuthUser>("/api/v1/users/me");
    set({ user, status: "authenticated" });
  } catch {
    setAccessToken(null);
    set({ user: null, status: "anonymous" });
  }
}

export async function loginWithPassword(email: string, password: string): Promise<AuthUser> {
  const result = await api<{ access_token: string; user: AuthUser }>(
    "/api/v1/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    { skipAuth: true },
  );
  setAccessToken(result.access_token);
  set({ user: result.user, status: "authenticated" });
  return result.user;
}

/** Google one-click: posts Google's signed ID token; backend creates the account on first use. */
export async function loginWithGoogle(idToken: string): Promise<AuthUser> {
  const result = await api<{ access_token: string; user: AuthUser }>(
    "/api/v1/auth/login/google",
    { method: "POST", body: JSON.stringify({ credential: idToken }) },
    { skipAuth: true },
  );
  setAccessToken(result.access_token);
  set({ user: result.user, status: "authenticated" });
  return result.user;
}

export async function registerAccount(input: {
  email: string;
  password: string;
  displayName: string;
  userType: "student" | "faculty";
}): Promise<{ devOtp?: string }> {
  const result = await api<{ access_token: string; dev_otp?: string }>(
    "/api/v1/auth/register",
    { method: "POST", body: JSON.stringify(input) },
    { skipAuth: true },
  );
  setAccessToken(result.access_token);
  try {
    const user = await api<AuthUser>("/api/v1/users/me");
    set({ user, status: "authenticated" });
  } catch {
    set({ user: null, status: "anonymous" });
  }
  return { devOtp: result.dev_otp };
}

export async function logout() {
  try {
    await api("/api/v1/auth/logout", { method: "POST" });
  } catch {
    /* best effort */
  }
  setAccessToken(null);
  set({ user: null, status: "anonymous" });
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
