import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  Clock3,
  Copy,
  LifeBuoy,
  LogOut,
  Menu,
  MessageCircle,
  Phone,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  X,
} from "lucide-react";
import {
  clearAuthSession,
  type AuthUser,
} from "../lib/auth";

/* =========================================================
   SAAS LANDING — premium LIGHT theme, mobile-first
   ========================================================= */

const PLANS = [
  {
    id: "monthly",
    name: "Monthly",
    price: "₹2,500",
    per: "/ month",
    note: "Flexible · cancel anytime",
    save: null as string | null,
    highlight: false,
  },
  {
    id: "halfyearly",
    name: "Half-Yearly",
    price: "₹10,000",
    per: "/ 6 months",
    note: "₹1,667 / month equivalent",
    save: "Save ₹5,000",
    highlight: false,
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "₹18,000",
    per: "/ year",
    note: "₹1,500 / month equivalent",
    save: "Best value",
    highlight: true,
  },
];

const NAV = [
  ["Features", "#features"],
  ["Performance", "#performance"],
  ["Pricing", "#pricing"],
  ["Contact", "#contact"],
];

export function HomePage({
  onStartTrial,
  onSignIn,
}: {
  onStartTrial: () => void;
  onSignIn: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [upiPlan, setUpiPlan] = useState<string | null>(null);

  const upiNumber = "9894185211";
  const upiId = "9894185211@upi";

  function scrollTo(id: string) {
    setMenuOpen(false);
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="page-glow min-h-screen text-slate-900">
      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-5">
          <button onClick={() => scrollTo("top")} className="flex items-center gap-2.5">
            <div className="brand-gold-dot flex h-9 w-9 items-center justify-center rounded-xl">
              <BarChart3 className="h-[18px] w-[18px] text-white" />
            </div>
            <div className="font-display text-lg font-bold tracking-tight">
              BULLION<span className="gold-text">AI</span>
            </div>
          </button>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV.map(([label, href]) => (
              <button
                key={href}
                onClick={() => scrollTo(href)}
                className="text-[13px] font-semibold text-slate-600 transition hover:text-slate-900"
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={onSignIn}
              className="hidden rounded-full border border-slate-300 bg-white px-4 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:border-slate-400 hover:shadow-sm sm:block"
            >
              Sign in
            </button>
            <button
              onClick={() => scrollTo("#pricing")}
              className="gold-cta hidden rounded-full px-4 py-1.5 text-[12px] sm:block"
            >
              Get started
            </button>
            <button
              className="rounded-lg p-2 text-slate-600 md:hidden"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
            {NAV.map(([label, href]) => (
              <button
                key={href}
                onClick={() => scrollTo(href)}
                className="block w-full py-2.5 text-left text-[13px] font-semibold text-slate-600"
              >
                {label}
              </button>
            ))}
            <div className="mt-2 flex gap-2 border-t border-slate-100 pt-3">
              <button onClick={onSignIn} className="flex-1 rounded-xl border border-slate-300 py-2 text-[12px] font-semibold text-slate-700">
                Sign in
              </button>
              <button onClick={onStartTrial} className="gold-cta flex-1 rounded-xl py-2 text-[12px]">
                Get started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ================= HERO ================= */}
      <section id="top" className="mx-auto max-w-6xl px-4 pt-12 pb-14 text-center sm:px-5 lg:pt-20 lg:pb-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700 sm:text-[11px]">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verified MCX signals · 14-day free trial
        </span>

        <h1 className="font-display mx-auto mt-6 max-w-3xl text-[34px] font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[60px]">
          Trade{" "}
          <span className="gold-text">gold &amp; silver</span>{" "}
          like an institution.
        </h1>

        <p className="mx-auto mt-4 max-w-2xl px-1 text-[14px] leading-relaxed text-slate-500 sm:mt-5 sm:text-base">
          Rule-based BUY/SELL signals on MCX gold and silver futures —
          powered by a cryptographically verified strategy engine,
          tick-level market feed and server-owned historical candles.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="/?trial=1"
            className="gold-cta flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-[14px] sm:w-auto"
          >
            Start 14-day free trial
            <ArrowRight className="h-4 w-4" />
          </a>
          <button
            onClick={() => scrollTo("#pricing")}
            className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 text-[14px] font-semibold text-slate-700 transition hover:border-slate-400 hover:shadow-sm sm:w-auto"
          >
            View pricing
          </button>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[11px]">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> MCX Gold · Silver
          </span>
          <span className="flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5 text-blue-500" /> 15m – 4H timeframes
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-500" /> Zero strategy tampering
          </span>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16 sm:px-5 lg:pb-20">
        <SectionTitle kicker="Platform" title="Everything a bullion trader needs" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Verified signal engine", "The BullionAI strategy executes with SHA-256 integrity checks on every candle — signals are never repainted.", ShieldCheck],
            ["Real-time market feed", "Tick-level touchline prices stream straight into your chart via a persistent market socket.", TrendingUp],
            ["Complete history", "Downtime-proof candle storage with automatic reconciliation — charts are never missing bars.", Clock3],
            ["Multi-timeframe", "Independent 15m, 30m, 45m, 1H, 2H and 4H datasets — each with its own correct boundaries.", BarChart3],
            ["Premium terminal", "Institutional charting, IST time axis, cursor OHLC and a distraction-free interface.", BarChart3],
            ["Trader-first design", "Built for Indian bullion traders: INR formatting, MCX session clock, IST everywhere.", Smartphone],
          ].map(([title, body, Icon]: any) => (
            <div key={title} className="premium-card rounded-2xl p-5 sm:p-6">
              <Icon className="h-5 w-5 text-amber-500" />
              <div className="font-display mt-3 text-[15px] font-bold">{title}</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= PERFORMANCE ================= */}
      <section id="performance" className="scroll-mt-20 border-y border-slate-200/70 bg-gradient-to-b from-slate-50/90 to-transparent py-14 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <SectionTitle kicker="Performance" title="Transparent, verifiable execution" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Instruments", "MCX Gold & Silver futures"],
              ["Timeframes", "15m · 30m · 45m · 1H · 2H · 4H"],
              ["Execution integrity", "SHA-256 verified every run"],
              ["Risk management", "Dynamic trailing exit on every trade"],
            ].map(([k, v]: any) => (
              <div key={k} className="premium-card rounded-2xl p-5 sm:p-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{k}</div>
                <div className="font-display mt-2 text-[16px] font-bold leading-snug">{v}</div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-[11px] font-medium text-slate-400">
            Strategy state is computed exclusively by the verified script —
            past performance does not guarantee future results.
          </p>
        </div>
      </section>

      {/* ================= PRICING ================= */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-5 lg:py-20">
        <SectionTitle kicker="Pricing" title="Simple plans. UPI only." />
        <p className="-mt-6 mb-10 px-2 text-center text-[13px] font-medium text-slate-500">
          Every new account starts with a <b className="text-amber-600">14-day free trial</b>. Choose a plan below —
          pay via UPI and the admin activates your subscription.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {PLANS.map(p => (
            <div
              key={p.id}
              className={[
                "premium-card relative rounded-3xl p-6 sm:p-7",
                p.highlight ? "!border-amber-300 !shadow-[0_20px_60px_-24px_rgba(232,169,61,0.55)]" : "",
              ].join(" ")}
            >
              {p.save && (
                <span className={[
                  "absolute right-5 top-5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider",
                  p.highlight ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-600",
                ].join(" ")}>
                  {p.save}
                </span>
              )}

              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {p.name}
              </div>
              <div className="font-display mt-3 flex items-baseline gap-1">
                <span className="text-[32px] font-bold tracking-tight sm:text-[34px]">{p.price}</span>
                <span className="text-[12px] font-medium text-slate-400">{p.per}</span>
              </div>
              <div className="mt-1 text-[11px] font-medium text-slate-400">{p.note}</div>

              <ul className="mt-5 space-y-2.5 text-[12.5px] font-medium text-slate-600">
                {["Full terminal access", "All instruments & timeframes", "Live WebSocket feed", "Server-backed history"].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setUpiPlan(p.name + " · " + p.price + " " + p.per.replace("/", ""))}
                className={[
                  "mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-bold transition",
                  p.highlight
                    ? "gold-cta"
                    : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:shadow-sm",
                ].join(" ")}
              >
                Pay via UPI
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ================= CONTACT ================= */}
      <section id="contact" className="scroll-mt-20 border-t border-slate-200/70 bg-white/70 py-14 lg:py-16">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 sm:px-5 lg:grid-cols-3 lg:gap-8">
          <div>
            <SectionTitleLeft kicker="Contact" title="Talk to us" />
            <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
              Questions about plans, payments or activation? Reach the
              BullionAI team directly.
            </p>
          </div>

          <div className="premium-card rounded-2xl p-5 sm:p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Address</div>
            <div className="mt-2 text-[13px] font-medium leading-relaxed text-slate-700">
              BullionAI<br />
              6A, West Street, Line Medu,<br />
              Gugai, Salem – 636006,<br />
              Tamil Nadu, India
            </div>
          </div>

          <div className="premium-card rounded-2xl p-5 sm:p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Phone / Support</div>
            <a href={`tel:+91${upiNumber}`} className="font-display mt-2 flex items-center gap-2 text-[16px] font-bold">
              <Phone className="h-4 w-4 text-amber-500" />
              +91 98941 85211
            </a>
            <div className="mt-3 text-[11px] font-medium text-slate-400">
              Payment support &amp; plan activation · Mon–Sat
            </div>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-5 sm:py-12">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="brand-gold-dot flex h-8 w-8 items-center justify-center rounded-lg">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <div className="font-display text-[15px] font-bold">
                BULLION<span className="gold-text">AI</span>
              </div>
            </div>
            <p className="mt-3 max-w-xs text-[11.5px] leading-relaxed text-slate-500">
              Premium market intelligence for Indian bullion traders.
              Verified strategies, live feeds and institutional-grade tooling.
            </p>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Product</div>
            <ul className="mt-3 space-y-2 text-[12px] font-medium text-slate-600">
              {NAV.map(([label, href]) => (
                <li key={href}>
                  <button onClick={() => scrollTo(href)} className="transition hover:text-slate-900">
                    {label}
                  </button>
                </li>
              ))}
              <li>
                <li>
                  <a href="/?trial=1" className="transition hover:text-slate-900">
                    Start free trial
                  </a>
                </li>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Contact</div>
            <ul className="mt-3 space-y-2 text-[12px] font-medium text-slate-600">
              <li>6A, West Street, Line Medu,</li>
              <li>Gugai, Salem – 636006</li>
              <li>
                <a href={`tel:+91${upiNumber}`} className="transition hover:text-slate-900">
                  +91 98941 85211
                </a>
              </li>
              <li>
                <a href="https://digitalmavens.in" target="_blank" rel="noreferrer" className="transition hover:text-slate-900">
                  digitalmavens.in
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-100">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-[11px] font-medium text-slate-400 sm:flex-row sm:px-5">
            <span>© {new Date().getFullYear()} BullionAI · Not investment advice.</span>
            <span>
              Designed &amp; developed by{" "}
              <a href="https://digitalmavens.in" target="_blank" rel="noreferrer" className="font-semibold text-slate-600 hover:text-slate-900">
                digitalmavens.in
              </a>
            </span>
          </div>
        </div>
      </footer>

      {/* ================= UPI MODAL ================= */}
      {upiPlan && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 backdrop-blur-sm sm:items-center"
             onClick={() => setUpiPlan(null)}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-7"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600">
                  Subscribe · {upiPlan}
                </div>
                <h3 className="font-display mt-1 text-lg font-bold">Pay via UPI to activate</h3>
              </div>
              <button onClick={() => setUpiPlan(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <ol className="mt-5 space-y-4 text-[13px] font-medium text-slate-600">
              <li className="flex gap-3">
                <Step n={1} />
                <span>
                  Open any UPI app (GPay / PhonePe / Paytm) and pay the exact
                  plan amount to:
                  <span className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <span className="break-all font-mono text-[13px] font-bold">{upiId}</span>
                    <CopyBtn text={upiId} />
                  </span>
                  <span className="mt-1.5 block text-[11px] text-slate-400">
                    or directly to number <b>{upiNumber}</b> (BullionAI)
                  </span>
                </span>
              </li>

              <li className="flex gap-3">
                <Step n={2} />
                <span>Send the transaction screenshot to admin along with your registered email.</span>
              </li>

              <li className="flex gap-3">
                <Step n={3} />
                <span>Admin verifies the payment and activates your subscription — usually within minutes during market hours.</span>
              </li>
            </ol>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a
                href={`tel:+91${upiNumber}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 py-2.5 text-[12px] font-semibold text-slate-700"
              >
                <Phone className="h-4 w-4" /> Call admin
              </a>
              <a
                href={`https://wa.me/91${upiNumber}?text=${encodeURIComponent("Hi! I paid for BullionAI (" + upiPlan + "). Please activate my access.")}`}
                target="_blank"
                rel="noreferrer"
                className="gold-cta flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12px]"
              >
                <MessageCircle className="h-4 w-4" /> Send on WhatsApp
              </a>
            </div>

            <p className="mt-4 text-center text-[10px] font-medium text-slate-400">
              Activation is manual by the admin after UPI payment confirmation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- small pieces ---------- */

function Step({ n }: { n: number }) {
  return (
    <span className="brand-gold-dot mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white">
      {n}
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text).catch(() => {})}
      className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition hover:border-slate-300"
    >
      <Copy className="h-3 w-3" /> Copy
    </button>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-10 text-center">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">{kicker}</div>
      <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
    </div>
  );
}

function SectionTitleLeft({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">{kicker}</div>
      <h2 className="font-display mt-2 text-2xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}

/* =========================================================
   TRIAL EXPIRED / CONTACT ADMIN
   ========================================================= */

export function TrialExpired({
  user,
}: {
  user: AuthUser;
}) {
  function logout() {
    clearAuthSession();
    location.reload();
  }

  return (
    <div className="page-glow flex min-h-screen items-center justify-center p-4">
      <div className="premium-card w-full max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-200">
          <LifeBuoy className="h-7 w-7 text-amber-500" />
        </div>

        <h1 className="font-display mt-5 text-xl font-bold text-slate-900">
          Your trial has ended
        </h1>

        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
          Hi {user.name}, your 14-day BullionAI trial has
          expired. To renew or upgrade your access, please
          contact the administrator.
        </p>

        <a
          href="mailto:admin@digitalmavens.in?subject=BullionAI%20access%20renewal"
          className="gold-cta mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px]"
        >
          <LifeBuoy className="h-4 w-4" />
          Contact admin to renew
        </a>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/* header plan badge */

export function TrialBadge({ user }: { user: AuthUser }) {
  if (!user.hasAccess && user.accessUntil == null) return null;
  const isTrial = user.plan !== "full" || user.accessUntil == null;
  return (
    <span className="hidden items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-600 md:flex">
      <Check className="h-3 w-3" />
      {isTrial ? `Trial · ${user.daysLeft ?? 0}d` : "Full"}
    </span>
  );
}
