import { Link } from "react-router-dom";
import {
  Shield,
  Clock,
  Search,
  BarChart2,
  Bell,
  Smartphone,
  MousePointer,
  ArrowRight,
  CheckCircle,
  User,
  CreditCard,
  MessageCircle,
  Calendar,
  Eye,
  Layers,
  Zap,
  Target,
} from "lucide-react";

const STEPS = [
  {
    number: "01",
    title: "Create Your Account",
    description: "Register with your email, full name, and mobile number. Choose your trading segments — MCX (commodities), NSE (equities & F&O), BSE (equities) — or select all three. This determines which markets appear in your terminal.",
    icon: User,
    details: [
      "Email verification required",
      "Mobile number for WhatsApp alerts",
      "Segment selection: MCX / NSE / BSE",
      "No credit card needed for trial",
    ],
    illustration: (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="space-y-4 max-w-xs">
          <div className="rounded-xl bg-slate-50 p-4">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Email Address</label>
            <input type="email" placeholder="trader@example.com" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" readOnly />
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Full Name</label>
            <input type="text" placeholder="Rajesh Kumar" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" readOnly />
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Mobile Number</label>
            <input type="tel" placeholder="+91 98765 43210" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" readOnly />
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Trading Segments</label>
            <div className="flex flex-wrap gap-2">
              {["MCX", "NSE", "BSE", "SPOT"].map((seg) => (
                <span key={seg} className="rounded-full bg-navy px-3 py-1 text-[11px] font-bold text-white">{seg}</span>
              ))}
            </div>
          </div>
          <button className="gold-cta w-full rounded-xl py-2.5 text-sm font-bold">Create Account →</button>
        </div>
      </div>
    ),
  },
  {
    number: "02",
    title: "Start 14-Day Free Trial",
    description: "Immediately after registration, your 14-day trial activates with full platform access. All chosen segments, live WebSocket feed, verified signals, push notifications — everything included. No payment details required.",
    icon: Clock,
    details: [
      "Instant activation — no approval wait",
      "Full access to all features",
      "All chosen segments (MCX / NSE / BSE)",
      "Live feed + historical candles",
      "Push notifications for watchlist signals",
      "Mobile & desktop terminal access",
    ],
    illustration: (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h4 className="font-display mt-4 text-xl font-bold">Trial Active</h4>
          <p className="mt-1 text-slate-500">14 days remaining</p>
          <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-left">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Segments Access</span>
              <span className="font-semibold text-emerald-700">MCX • NSE • BSE</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-600">Markets Access</span>
              <span className="font-semibold">MCX • NSE • BSE</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-600">Live Feed</span>
              <span className="font-semibold text-emerald-700">Active</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-600">Push Alerts</span>
              <span className="font-semibold text-emerald-700">Enabled</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: "03",
    title: "Connect & Customize",
    description: "Search any scrip by name or symbol, add to your watchlist, and configure your terminal. Set up push notifications for BUY/SELL signals. Organize your workspace — mobile shows bottom-friendly layout, desktop shows full three-panel terminal.",
    icon: Search,
    details: [
      "Search 10,000+ NSE/BSE/MCX scrips",
      "Add/remove from watchlist instantly",
      "Configure push notifications per symbol",
      "Mobile: bottom nav + swipe panels",
      "Desktop: three-panel terminal layout",
    ],
    illustration: (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search: GOLD, SILVER, NIFTY, RELIANCE..." className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400" readOnly />
          </div>
          <div className="flex flex-wrap gap-2">
            {["GOLD (MCX)", "SILVER (MCX)", "CRUDEOIL (MCX)", "NIFTY50 (NSE)", "RELIANCE (NSE)", "SENSEX (BSE)"].map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                {s}
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-blue-50 p-3">
            <div className="font-semibold text-blue-700">Push Alerts: ON</div>
            <div className="text-[11px] text-blue-600">BUY/SELL for watchlist</div>
          </div>
          <div className="rounded-xl bg-violet-50 p-3">
            <div className="font-semibold text-violet-700">Signals & Targets</div>
            <div className="text-[11px] text-violet-600">BUY/SELL + SL/TGT marked</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: "04",
    title: "Receive Signals & Trade",
    description: "Verified BUY/SELL signals appear in real-time with entry price, stop loss, Target 1, Target 2. Track current P/L, max favorable excursion, entry/exit times, and final result. When Target 1 hits, the active stop may adjust per strategy rules while Target 2 is monitored.",
    icon: Target,
    details: [
      "Real-time BUY/SELL via WebSocket",
      "Entry, SL, Target 1, Target 2 levels",
      "Current P/L updates on every tick",
      "Max points (best favorable move)",
      "Entry/exit timestamps (IST)",
      "Trade result: TGT1/TGT2/SL hit",
      "Signal history with SHA-256 verification",
    ],
    illustration: (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="space-y-3">
          {[
            { signal: "BUY", sym: "GOLD", entry: "1,57,250", sl: "1,56,850", t1: "1,57,850", t2: "1,58,450", status: "TARGET 1 ACHIEVED", pl: "+600", time: "09:15" },
            { signal: "SELL", sym: "SILVER", entry: "2,37,500", sl: "2,38,200", t1: "2,36,500", t2: "2,35,500", status: "ACTIVE", pl: "-150", time: "10:30" },
            { signal: "BUY", sym: "CRUDEOIL", entry: "7,950", sl: "7,900", t1: "8,020", t2: "8,100", status: "TARGET 2 ACHIEVED", pl: "+1,200", time: "11:45" },
          ].map((sig, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-black ${sig.signal === "BUY" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{sig.signal}</span>
                  <span className="font-semibold text-slate-800">{sig.sym}</span>
                  <span className="text-[11px] text-slate-400">{sig.time} IST</span>
                </div>
                <span className={`font-mono font-bold ${sig.pl.startsWith("+") ? "text-emerald-600" : "text-rose-600"}`}>{sig.pl} pts</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                <div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-400">Entry</div><div className="font-mono font-semibold">{sig.entry}</div></div>
                <div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-400">SL</div><div className="font-mono font-semibold text-rose-600">{sig.sl}</div></div>
                <div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-400">TGT1</div><div className="font-mono font-semibold text-emerald-600">{sig.t1}</div></div>
                <div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-400">TGT2</div><div className="font-mono font-semibold">{sig.t2}</div></div>
              </div>
              <div className="mt-2 text-[11px] font-medium text-amber-600">{sig.status}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

const SUBSCRIPTION_STEPS = [
  {
    step: "1",
    title: "Choose Plan",
    description: "Monthly (₹2,500), Half-Yearly (₹10,000), or Yearly (₹18,000 — best value).",
    icon: Calendar,
  },
  {
    step: "2",
    title: "Pay via UPI",
    description: "Pay to 9842669157@ybl via the QR on the subscribe page. Include your registered email in notes.",
    icon: CreditCard,
  },
  {
    step: "3",
    title: "Send Screenshot",
    description: "WhatsApp payment screenshot + email to +91 79043 11778.",
    icon: MessageCircle,
  },
  {
    step: "4",
    title: "Get Activated",
    description: "Admin verifies and sets validity — usually within minutes (Mon–Sat, 9am–6pm IST).",
    icon: CheckCircle,
  },
];

export function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
            Getting Started
          </div>
          <h1 className="font-display mt-6 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            From Signup to Signals in 4 Steps
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600 max-w-2xl mx-auto">
            No complex setup. No broker integration needed. Just register, trial, customize, and trade with verified intelligence.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="space-y-16">
          {STEPS.map((step, idx) => (
            <article
              key={step.number}
              className={[
                "relative flex gap-8 lg:gap-12",
                idx % 2 === 1 ? "lg:flex-row-reverse" : "",
              ].join(" ")}
            >
              <div className={["relative flex-shrink-0 w-16 lg:w-20", idx < STEPS.length - 1 && "lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:top-0 lg:h-full"].join(" ")}>
                <div className="relative z-10 flex h-16 w-16 lg:h-20 lg:w-20 items-center justify-center rounded-full bg-navy text-white font-bold text-[18px] lg:text-[22px]">
                  {step.number}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className="absolute left-1/2 top-16 bottom-0 w-px bg-slate-200 lg:left-1/2 lg:top-20 lg:-translate-x-1/2" style={{ transform: "translateX(-50%)" }} />
                )}
              </div>

              <div className="flex-1 pt-2 lg:pt-0">
                {idx % 2 === 0 ? (
                  <>
                    <div className="lg:w-[55%]">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                          <step.icon className="h-6 w-6 text-accent" />
                        </div>
                        <h2 className="font-display text-2xl font-bold tracking-tight">{step.title}</h2>
                      </div>
                      <p className="mt-3 text-[14px] leading-relaxed text-slate-600">{step.description}</p>
                      <ul className="mt-5 space-y-2" role="list">
                        {step.details.map((detail, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            <span className="text-[13px] text-slate-700">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-8 lg:mt-0 lg:w-[45%] lg:sticky lg:top-24">
                      {step.illustration}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="lg:w-[55%] lg:ml-auto text-right lg:text-left">
                      <div className="flex items-center gap-3 lg:justify-end">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                          <step.icon className="h-6 w-6 text-accent" />
                        </div>
                        <h2 className="font-display text-2xl font-bold tracking-tight">{step.title}</h2>
                      </div>
                      <p className="mt-3 text-[14px] leading-relaxed text-slate-600">{step.description}</p>
                      <ul className="mt-5 space-y-2 lg:items-end" role="list">
                        {step.details.map((detail, i) => (
                          <li key={i} className="flex items-start gap-2.5 lg:justify-end">
                            <span className="text-[13px] text-slate-700">{detail}</span>
                            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-8 lg:mt-0 lg:w-[45%] lg:sticky lg:top-24">
                      {step.illustration}
                    </div>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Subscription Flow */}
      <section id="subscription" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20 bg-slate-50/50">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">After Trial: Subscribe via UPI</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-500">Simple 4-step payment process. No cards, no auto-renewal without your action.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SUBSCRIPTION_STEPS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="relative rounded-2xl border border-slate-200 bg-white p-6">
                <div className="absolute -top-3 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-navy text-white font-bold text-sm">
                  {item.step}
                </div>
                <div className="mt-6">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 mb-3">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="font-display text-[15px] font-bold">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-10 text-center">
          <Link to="/subscribe" className="gold-cta inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-[14px] font-bold">
            Subscribe Now <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-[11px] text-slate-400">Pay via UPI QR · Activated on WhatsApp within minutes</p>
        </div>
      </section>

      {/* Platform Features Preview */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Terminal Features You'll Use Daily</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: BarChart2, title: "Live Charts", desc: "Candlestick charts with BUY/SELL markers, SL & target lines", color: "text-blue-600" },
            { icon: Zap, title: "Real-Time Feed", desc: "Sub-second WebSocket updates across MCX, NSE, BSE. IST timestamps throughout.", color: "text-amber-500" },
            { icon: Bell, title: "Push Alerts", desc: "Instant browser + mobile notifications when your watchlist symbols trigger signals.", color: "text-rose-600" },
            { icon: Shield, title: "Verified Signals", desc: "Every signal SHA-256 hashed against server-owned candles. Zero repaint guarantee.", color: "text-emerald-600" },
            { icon: Eye, title: "Trade Tracking", desc: "Entry, SL, TGT1, TGT2, current P/L, max points, entry/exit time, final result.", color: "text-violet-600" },
            { icon: Layers, title: "Multi-Market", desc: "Gold, Silver, Crude on MCX. NSE & BSE equities & F&O. One terminal, all segments.", color: "text-indigo-600" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 mb-4">
                  <Icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <h3 className="font-display text-[15px] font-bold">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mobile vs Desktop */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20 bg-slate-50/50">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Optimized for Every Screen</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-500">Responsive design that adapts to your device — not a shrunk-down desktop view.</p>
        </div>
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <Smartphone className="h-5 w-5 text-slate-500" />
              <h3 className="font-display text-[17px] font-bold">Mobile Experience</h3>
            </div>
            <ul className="space-y-3 text-[13px] text-slate-600">
              {[
                "Bottom navigation bar — thumb-friendly",
                "Swipeable panels: Chart | Watchlist | Signals",
                "Full-screen chart with pinch-to-zoom",
                "Push notifications work in background",
                "One-handed signal review & dismissal",
                "Same verified data, optimized layout",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <MousePointer className="h-5 w-5 text-slate-500" />
              <h3 className="font-display text-[17px] font-bold">Desktop Terminal</h3>
            </div>
            <ul className="space-y-3 text-[13px] text-slate-600">
              {[
                "Three-panel layout: Chart | Watchlist | Signal Details",
                "Live ticker bar across top of terminal",
                "Keyboard shortcuts for power users",
                "Multiple monitor support",
                "Full signal history & trade log side panel",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 text-center">
        <div className="rounded-3xl bg-navy p-8 sm:p-12">
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Ready to Start Your Free Trial?</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-200 max-w-xl mx-auto">
            14 days. Full access. No card. Verified signals from day one.
          </p>
          <Link to="/register" className="mt-6 gold-cta inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-[14px] font-bold">
            Start 14-Day Free Trial
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}