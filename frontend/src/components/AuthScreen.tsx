import { useState } from "react";
import {
  BarChart3,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  loginEmail,
  registerEmail,
  type AuthUser,
} from "../lib/auth";

type Mode = "login" | "register";

export function AuthScreen({
  onAuthed,
  initialMode = "login",
}: {
  onAuthed: (u: AuthUser) => void;
  initialMode?: Mode;
}) {
  const [mode, setMode] =
    useState<Mode>(initialMode);

  const [email, setEmail] =
    useState("");
  const [name, setName] =
    useState("");
  const [password, setPassword] =
    useState("");

  const [busy, setBusy] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const user =
        mode === "login"
          ? await loginEmail(email, password)
          : await registerEmail(email, password, name);
      onAuthed(user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-glow flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_70px_-30px_rgba(15,23,42,0.35)] lg:grid-cols-[1.05fr_1fr]">

        {/* ============ BRAND PANEL ============ */}
        <div className="relative hidden flex-col justify-between overflow-hidden p-9 lg:flex"
             style={{
               background:
                 "linear-gradient(150deg,#0f172a 0%,#1e293b 55%,#3b2f14 130%)",
             }}>

          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

          <div>
            <div className="flex items-center gap-3">
              <div className="brand-gold-dot flex h-11 w-11 items-center justify-center rounded-xl">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div className="font-display text-xl font-bold text-white">
                BULLION
                <span className="gold-text">AI</span>
              </div>
            </div>

            <h1 className="font-display mt-10 text-[28px] font-bold leading-tight text-white">
              Trade bullion with
              <br />
              institutional clarity.
            </h1>

            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-slate-300/90">
              Live MCX gold &amp; silver intelligence — verified
              strategy signals, tick-level prices and a premium
              charting terminal.
            </p>
          </div>

          <ul className="space-y-2.5 text-[12px] font-medium text-slate-300">
            {[
              "Pine-verified BullionAI signals",
              "Real-time WebSocket market feed",
              "Server-owned historical candles",
            ].map(f => (
              <li key={f} className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* ============ FORM ============ */}
        <div className="p-7 sm:p-10">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="brand-gold-dot flex h-9 w-9 items-center justify-center rounded-lg">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <div className="font-display text-lg font-bold">
              BULLION<span className="gold-text">AI</span>
            </div>
          </div>

          <h2 className="font-display text-[22px] font-bold tracking-tight text-slate-900">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1 text-[12px] font-medium text-slate-400">
            {mode === "login"
              ? "Sign in to access the BullionAI terminal."
              : "Email + password. You can change these later."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">

            {mode === "register" && (
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Name
                </span>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-3 text-[13px] font-medium outline-none transition focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Email
              </span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-3 text-[13px] font-medium outline-none transition focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Password
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={
                    mode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-3 text-[13px] font-medium outline-none transition focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                />
              </div>
            </label>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="tf-active flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold text-white transition disabled:opacity-60"
            >
              {busy && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {mode === "login"
                ? "Sign in"
                : "Create account"}
            </button>
          </form>

          <div className="mt-5 text-center text-[11px] font-medium text-slate-400">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("register"); setError(null); }}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already registered?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(null); }}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Sign in instead
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
