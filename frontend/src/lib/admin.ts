import { API_BASE } from "./api-base";
import { getStoredToken } from "./auth";

function authHeaders() {
  const token = getStoredToken();
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  // back-compat: also send X-Admin-Key if present (legacy)
  const legacy =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("bullionai_admin_key")
      : null;
  if (legacy) h["X-Admin-Key"] = legacy;
  return h;
}

function adminHeaders() {
  return authHeaders();
}

export async function verifyAdmin() {
  const r = await fetch(`${API_BASE}/api/admin/verify`, {
    headers: authHeaders(),
  });
  const d = await r.json();
  if (!r.ok || !d.ok)
    throw new Error(d.error || "Not an admin account");
  return true;
}

export async function listAdminUsers() {
  const r = await fetch(`${API_BASE}/api/admin/users`, {
    headers: authHeaders(),
  });
  const d = await r.json();
  if (!r.ok || !d.ok) throw new Error(d.error || "Failed");
  return d.users as any[];
}

export async function getAdminStats() {
  const r = await fetch(`${API_BASE}/api/admin/stats`, {
    headers: authHeaders(),
  });
  const d = await r.json();
  if (!r.ok || !d.ok) throw new Error(d.error || "Failed");
  return d.stats as any;
}

export async function deleteAdminUser(email: string) {
  const r = await fetch(
    `${API_BASE}/api/admin/users/${encodeURIComponent(email)}`,
    { method: "DELETE", headers: authHeaders() }
  );
  const d = await r.json();
  if (!r.ok || !d.ok) throw new Error(d.error || "Delete failed");
  return d;
}

export async function updateAdminUser(
  email: string,
  updates: any
) {
  const r = await fetch(
    `${API_BASE}/api/admin/users/${encodeURIComponent(email)}`,
    {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify(updates),
    }
  );
  const d = await r.json();
  if (!r.ok || !d.ok) throw new Error(d.error || "Update failed");
  return d.user;
}

export async function renewAdminUser(
  email: string,
  days: number
) {
  const r = await fetch(
    `${API_BASE}/api/admin/users/${encodeURIComponent(email)}/renew`,
    {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ days }),
    }
  );
  const d = await r.json();
  if (!r.ok || !d.ok) throw new Error(d.error || "Renew failed");
  return d.user;
}

export async function createAdminUser(data: {
  email: string;
  name: string;
  password: string;
  segments: string[];
  plan?: string;
  validTill?: string;
  isAdmin?: boolean;
}) {
  const r = await fetch(`${API_BASE}/api/admin/users`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(data),
  });
  const d = await r.json();
  if (!r.ok || !d.ok) throw new Error(d.error || "Create failed");
  return d.user;
}

export async function resetAdminPassword(
  email: string,
  newPassword: string
) {
  const r = await fetch(
    `${API_BASE}/api/admin/users/${encodeURIComponent(email)}/reset-password`,
    {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ newPassword }),
    }
  );
  const d = await r.json();
  if (!r.ok || !d.ok)
    throw new Error(d.error || "Reset failed");
  return d.user;
}

// Back-compat shim
export async function verifyAdminWithKey(_key: string) {
  return verifyAdmin();
}
