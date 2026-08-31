import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
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
  const navigate = useNavigate();
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

  const [showPassword, setShowPassword] =
    useState(false);

  const [mobile, setMobile] = useState("");

  const [segments, setSegments] =
    useState<string[]>([]);

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  }

  function toggleSegment(seg: string) {
    setSegments(prev =>
      prev.includes(seg)
        ? prev.filter(s => s !== seg)
        : [...prev, seg]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (mode === "register") {
      if (segments.length === 0) {
        setError(
          "Select at least one segment (MCX, NSE, BSE)."
        );
        return;
      }
      if (!mobile.trim()) {
        setError("Mobile number is required.");
        return;
      }
      if (!/^(\+?\d{1,3})?\d{10}$/.test(mobile.replace(/\s+/g, ""))) {
        setError("Invalid mobile number. Use 10 digits.");
        return;
      }
    }
    setError(null);
    setBusy(true);
    try {
      const user =
        mode === "login"
          ? await loginEmail(email, password)
          : await registerEmail(
              email,
              password,
              name,
              segments,
              mobile
            );
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
    <div className="page-glow flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_70px_-30px_rgba(10,37,64,0.35)] lg:grid lg:grid-cols-[1.05fr_1fr]">

        {/* ============ BRAND PANEL ============ */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-navy p-10 lg:flex">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-gold-light/10 blur-3xl" />

          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                <BarChart3 className="h-5 w-5 text-gold-light" />
              </div>
              <div className="font-display text-xl font-bold text-white">
                BULLION
                <span className="text-gold-light">AI</span>
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
              "SHA-256 verified BullionAI signals",
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
          <button
            onClick={goBack}
            className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 transition hover:text-accent"
          >
            <span aria-hidden="true">←</span> Back to home
          </button>

          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <div className="font-display text-lg font-bold text-slate-900">
              BULLION<span className="text-accent">AI</span>
            </div>
          </div>

          <h2 className="font-display text-[24px] font-bold tracking-tight text-slate-900">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1 text-[12px] font-medium text-slate-400">
            {mode === "login"
              ? "Sign in to access the BullionAI terminal."
              : "Start your 14-day free trial — no card required."}
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-3 text-[13px] font-medium outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
                  />
                </div>
              </label>
            )}

            {mode === "register" && (
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Mobile <span className="text-rose-500">*</span>
                </span>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    placeholder="9876543210"
                    autoComplete="tel"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-3 text-[13px] font-medium outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-3 text-[13px] font-medium outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
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
                  type={showPassword ? "text" : "password"}
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-10 text-[13px] font-medium outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </label>

            {mode === "register" && (
              <div className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Segments <span className="text-rose-500">*</span>
                </span>
                <p className="mb-2 text-[10px] text-slate-400">
                  Select at least one segment you trade in.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {["MCX", "NSE", "BSE"].map(seg => {
                    const active =
                      segments.includes(seg);
                    return (
                      <button
                        key={seg}
                        type="button"
                        onClick={() =>
                          toggleSegment(seg)
                        }
                        className={[
                          "rounded-xl border py-2.5 text-[12px] font-bold tracking-wide transition",
                          active
                            ? "border-accent bg-accent/5 text-accent ring-2 ring-accent/20"
                            : "border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-white hover:border-slate-300",
                        ].join(" ")}
                      >
                        {seg}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600">
                <div>{error}</div>
                {String(error)
                  .toLowerCase()
                  .includes("user does not exist") &&
                  mode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        setError(null);
                      }}
                      className="mt-1 font-bold text-accent hover:underline"
                    >
                      Register now →
                    </button>
                  )}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="gold-cta flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold disabled:opacity-60"
            >
              {busy && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {mode === "login"
                ? "Sign in"
                : "Create account & start trial"}
            </button>
          </form>

          <div className="mt-5 text-center text-[11px] font-medium text-slate-400">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("register"); setError(null); }}
                  className="font-semibold text-accent hover:underline"
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
                  className="font-semibold text-accent hover:underline"
                >
                  Sign in instead
                </button>
              </>
            )}
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
            All data encrypted. Sign up starts a 14-day free trial — no card required.
          </div>
        </div>
      </div>
    </div>
  );
}