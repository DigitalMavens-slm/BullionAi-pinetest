import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart2,
  Check,
  Shield,
  Server,
  Smartphone,
  Zap,
  Cpu,
  Target,
  LineChart,
  Activity,
  Layers,
  Quote,
} from "lucide-react";

const FEATURES = [
  { title: "Real-Time Signals", desc: "Verified BUY/SELL signals with entry, SL, TGT1, TGT2 — pushed via WebSocket.", icon: Zap },
  { title: "Server-Side Computation", desc: "All logic runs server-side. No formula exposure, no client-side tampering.", icon: Server },
  { title: "Secure & Verified", desc: "Every signal SHA-256 hashed against server-owned candles. Zero repaint.", icon: Shield },
  { title: "Mobile-Friendly", desc: "Fully responsive terminal with push notifications on phone & desktop.", icon: Smartphone },
];

const RESULTS = [
  { value: "68%", label: "Q2 2026 signal win rate (MCX Gold)" },
  { value: "1:1.8", label: "Average risk-reward on MCX Gold" },
  { value: "15+", label: "Technical indicators per signal" },
  { value: "5", label: "Markets covered (MCX·NSE·BSE)" },
];

export function MarketingHomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
        {/* Background accents */}
        <div className="absolute inset-0 opacity-60">
          <div className="absolute -top-20 -left-20 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-gold-light/40 blur-3xl" />
        </div>
        <div className="absolute inset-0 opacity-[0.10]" aria-hidden="true">
          <svg viewBox="0 0 1440 600" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <path d="M0,400 C200,300 300,350 450,250 C600,150 700,200 900,120 C1100,40 1200,100 1440,50" fill="none" stroke="#1D4ED8" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Precision Signals · MCX · NSE · BSE
            </div>
            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.06] tracking-tight text-slate-900 sm:text-5xl lg:text-[54px]">
              Trade Gold, Silver, Crude &amp; Equities with <span className="text-accent">Verified Signals</span>
            </h1>
            <p className="mt-5 text-[16px] leading-relaxed text-slate-600 max-w-xl">
              BullionAI delivers server-verified, SHA-256 authenticated BUY/SELL signals across <strong>MCX</strong> (Gold, Silver, Crude Oil), <strong>NSE</strong> and <strong>BSE</strong> — with entry, stop loss, and multi-target levels. Institutional-grade intelligence, built for serious traders.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="gold-cta inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-[14px] font-bold">
                Start 14-Day Free Trial <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/pricing" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-7 py-3.5 text-[14px] font-semibold text-slate-700 transition hover:border-accent hover:text-accent">
                See Pricing
              </Link>
            </div>
            <p className="mt-4 text-[12px] font-medium text-slate-500">No card required · 14 days full access · Cancel anytime</p>

            <div className="mt-6 flex flex-wrap gap-2">
              {["MCX", "NSE", "BSE", "SPOT"].map((seg) => (
                <span key={seg} className="rounded-full bg-white border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-700 shadow-sm">{seg}</span>
              ))}
              <span className="rounded-full bg-navy px-3 py-1 text-[11px] font-bold text-white">Gold · Silver · Crude</span>
            </div>
          </div>

          {/* Product preview mockup */}
          <div className="relative">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_40px_90px_-20px_rgba(10,37,64,0.35)] p-3 sm:p-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy">
                    <BarChart2 className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-display text-[13px] font-bold text-slate-900">BULLIONAI TERMINAL</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">LIVE</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">IST</span>
              </div>
              <div className="grid gap-3 pt-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">GOLD · MCX</span>
                      <span className="font-mono text-[11px] font-bold text-slate-900">₹1,57,250</span>
                    </div>
                    <svg viewBox="0 0 400 180" className="h-36 w-full" role="img" aria-label="Sample candlestick chart with BUY marker">
                      <g stroke="#cbd5e1" strokeWidth="0.5" opacity="0.4">
                        <line x1="0" y1="45" x2="400" y2="45" />
                        <line x1="0" y1="90" x2="400" y2="90" />
                        <line x1="0" y1="135" x2="400" y2="135" />
                      </g>
                      {[
                        [20,70,50,60],[45,60,40,48],[70,48,35,42],[95,42,55,52],[120,52,30,38],
                        [145,38,50,46],[170,46,60,57],[195,57,40,48],[220,48,65,60],[245,60,45,52],
                        [270,52,70,65],[295,65,42,50],[320,50,75,70],[345,70,52,58],[370,58,66,63],
                      ].map(([x,o,h,c],i) => (
                        <g key={i}>
                          <line x1={x} y1={180 - h*1.5} x2={x} y2={180-o*1.5} stroke={c>=o?"#10b981":"#ef4444"} strokeWidth="1.5" />
                          <rect x={x-3} y={Math.min(180-c*1.5,180-o*1.5)} width="6" height={Math.max(Math.abs(c-o)*1.5,1.5)} fill={c>=o?"#10b981":"#ef4444"} rx="1" />
                        </g>
                      ))}
                      <polygon points="70,100 65,112 75,112" fill="#10b981" />
                      <text x="70" y="124" textAnchor="middle" fontSize="8" fontWeight="700" fill="#059669" fontFamily="monospace">BUY</text>
                      <line x1="0" y1="112" x2="400" y2="112" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" />
                      <text x="5" y="108" fontSize="7" fill="#dc2626" fontFamily="monospace">SL</text>
                      <line x1="0" y1="60" x2="400" y2="60" stroke="#10b981" strokeWidth="1" strokeDasharray="4 4" />
                      <text x="5" y="56" fontSize="7" fill="#059669" fontFamily="monospace">TGT1</text>
                      <line x1="0" y1="30" x2="400" y2="30" stroke="#10b981" strokeWidth="0.8" strokeDasharray="2 3" />
                      <text x="5" y="26" fontSize="7" fill="#059669" fontFamily="monospace">TGT2</text>
                    </svg>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Signal</div>
                    <div className="font-mono text-[15px] font-bold text-emerald-600">BUY</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Entry</div>
                    <div className="font-mono text-[11px] font-bold text-slate-900">1,57,250</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">SL</div>
                    <div className="font-mono text-[11px] font-bold text-rose-600">1,56,850</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">P/L</div>
                    <div className="font-mono text-[11px] font-bold text-emerald-600">+600</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="border-b border-slate-200/60 bg-paper">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {["MCX · NSE · BSE", "SHA-256 Verified", "99.9% Uptime", "No Formula Exposure"].map((item) => (
              <div key={item} className="flex items-center justify-center gap-2 text-[12px] font-semibold text-slate-600">
                <Check className="h-4 w-4 text-accent" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT SNAPSHOT / FEATURES */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-dark">Why BullionAI</div>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">The Intelligence Behind Every Trade</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-500">
            Precision-engineered signals for traders who demand more than hype.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-4 font-display text-[16px] font-bold">{feature.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{feature.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-8 text-center">
          <Link to="/features" className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-6 py-2.5 text-[13px] font-semibold text-slate-700 hover:border-slate-400">
            Explore Full Features <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* HOW IT WORKS - 3 STEP */}
      <section className="border-y border-slate-200/60 bg-paper">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-dark">How It Works</div>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">Up and Trading in Minutes</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { num: "1", title: "Create Account", desc: "Register with email, name & mobile. Choose your segments (MCX/NSE/BSE).", icon: Cpu },
              { num: "2", title: "Start 14-Day Trial", desc: "Full access instantly. No card. Live feed, verified signals, all markets.", icon: LineChart },
              { num: "3", title: "Receive Signals & Trade", desc: "Verified BUY/SELL with entry, SL, TGT1/TGT2. Track P/L in real time.", icon: Target },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="relative rounded-2xl border border-slate-200 bg-white p-6 pt-8">
                  <div className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-white">
                    {step.num}
                  </div>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy mb-3">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-display text-[15px] font-bold">{step.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{step.desc}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-8 text-center">
            <Link to="/how-it-works" className="inline-flex items-center gap-2 text-[13px] font-semibold text-accent hover:text-accent-dark">
              See Full Walkthrough <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* RESULTS / TRUST */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-dark">Transparent Performance</div>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">Data-Led, Not Hype-Driven</h2>
            <p className="mt-4 text-[14px] leading-relaxed text-slate-600">
              We publish our signal performance openly. Every signal is logged with its verification hash. No cherry-picked wins — the data speaks for itself.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              {RESULTS.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="font-mono text-3xl font-bold text-accent">{stat.value}</div>
                  <div className="mt-1 text-[12px] leading-snug text-slate-500">{stat.label}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-slate-400">Past performance is not indicative of future results. Trading involves risk.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Quote className="h-5 w-5 text-accent" />
              <span className="font-display text-[14px] font-bold">What Traders Say</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Early Testimonials</span>
            </div>
            <div className="space-y-4">
              {[
                { name: "S. Kumar", role: "MCX Gold Trader", text: "Finally a signal tool that shows entry, SL and exact targets. The SHA-256 verification gives real confidence — no repaint, no games." },
                { name: "A. Reddy", role: "Equity & Commodity Trader", text: "The terminal feels like a Bloomberg terminal for Indian markets. Clean signals, disciplined risk management, and it works on my phone." },
              ].map((t, i) => (
                <div key={i} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy font-bold text-white">{t.name.charAt(0)}</div>
                    <div>
                      <div className="text-[13px] font-bold">{t.name}</div>
                      <div className="text-[11px] text-slate-500">{t.role}</div>
                    </div>
                  </div>
                  <p className="text-[13px] leading-relaxed text-slate-600 italic">"{t.text}"</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Testimonials are illustrative. Results not typical guaranteed.</p>
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section className="border-y border-slate-200/60 bg-paper">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-dark">Pricing</div>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">Simple. Transparent. Starts Free.</h2>
            <p className="mt-3 text-[13px] text-slate-500">14-day free trial. Then UPI payment. No card lock-in.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { name: "Monthly", price: "₹2,500", period: "/ month", note: "Flexible" },
              { name: "Half-Yearly", price: "₹10,000", period: "/ 6 months", note: "Save ₹5,000" },
              { name: "Yearly", price: "₹18,000", period: "/ year", note: "Best Value", popular: true },
            ].map((plan) => (
              <div key={plan.name} className={`relative rounded-3xl border p-6 ${plan.popular ? "border-accent bg-white shadow-[0_20px_60px_-24px_rgba(29,78,216,0.35)]" : "border-slate-200 bg-white"}`}>
                {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Best Value</div>}
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{plan.name}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-[28px] font-bold">{plan.price}</span>
                  <span className="text-[12px] text-slate-400">{plan.period}</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">{plan.note}</div>
                <ul className="mt-4 space-y-2 text-[12px] text-slate-600">
                  {["All market segments", "Live feed + signals", "Entry · SL · Targets", "WhatsApp support"].map((f) => (
                    <li key={f} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> {f}</li>
                  ))}
                </ul>
                <Link to={plan.name === "Yearly" ? "/pricing" : "/pricing"} className={`mt-5 block w-full rounded-xl py-2.5 text-center text-[13px] font-bold ${plan.popular ? "gold-cta" : "border border-slate-300 text-slate-700 hover:border-slate-400"}`}>
                  View Plan
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full bg-navy px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-navy-light">
              Compare All Plans <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* MARKETS strip */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: LineChart, name: "Gold", desc: "MCX Gold futures & options", color: "text-amber-500" },
            { icon: Activity, name: "Silver", desc: "MCX Silver futures", color: "text-slate-500" },
            { icon: Zap, name: "Crude Oil", desc: "MCX Crude futures", color: "text-orange-500" },
            { icon: Layers, name: "NSE & BSE", desc: "Equities & derivatives", color: "text-blue-600" },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.name} className="rounded-2xl border border-slate-200 bg-white p-5">
                <Icon className={`h-5 w-5 ${m.color}`} />
                <div className="mt-3 font-display text-[15px] font-bold">{m.name}</div>
                <div className="text-[12px] text-slate-500">{m.desc}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl bg-navy p-8 text-center sm:p-14 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 rounded-full bg-accent/40 blur-3xl" />
            <div className="absolute bottom-0 right-10 h-40 w-40 rounded-full bg-gold-light/30 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Start Trading with Verified Intelligence</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-white/80 max-w-xl mx-auto">
              Join serious traders across MCX, NSE &amp; BSE who chose data over hype. 14-day free trial — full access, no card required.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/register" className="gold-cta inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-[14px] font-bold">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/faq" className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-8 py-3.5 text-[14px] font-semibold text-white transition hover:bg-white/10">
                Read FAQ
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}