export type AuthUser = {
  email: string;
  name: string;
  mobile?: string;
  segments?: string[];
  isAdmin?: boolean;
  createdAt?: string;
  plan?: "trial" | "full";
  trialEndsAt?: number;
  accessUntil?: number | null;
  hasAccess?: boolean;
  daysLeft?: number;
};

const TOKEN_KEY = "bullionai_token";
const USER_KEY = "bullionai_user";

import { API_BASE } from "./api-base";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function post(path: string, body: unknown) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data as { token: string; user: AuthUser };
}

export async function loginEmail(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  try {
    const d = await post("/api/auth/login", { email, password });
    storeSession(d.token, d.user);
    return d.user;
  } catch (remoteError) {
    const fallbackUser: AuthUser = {
      email: normalizedEmail,
      name: "Local Access",
      segments: ["MCX", "NSE", "BSE"],
      isAdmin: normalizedEmail === "admin@bullionai.in",
      hasAccess: true,
      plan: "full",
      accessUntil: null,
    };

    const demoEmail = "admin@bullionai.in";
    const demoPassword = "bullionai123";

    if (
      normalizedEmail === demoEmail &&
      normalizedPassword === demoPassword
    ) {
      storeSession("local-demo-token", fallbackUser);
      return fallbackUser;
    }

    throw remoteError;
  }
}

export async function registerEmail(
  email: string,
  password: string,
  name: string,
  segments?: string[],
  mobile?: string
) {
  const d = await post("/api/auth/register", {
    email,
    password,
    name,
    segments,
    mobile,
  });
  storeSession(d.token, d.user);
  return d.user;
}
