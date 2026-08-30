import {
  Shield,
  Zap,
  Smartphone,
  Server,
  BarChart2,
  Lock,
  Globe,
  Clock,
  Layers,
  Target,
  Activity,
  Cpu,
  Eye,
  Check,
  Building2,
} from "lucide-react";
import { Link } from "react-router-dom";

const MARKETS = [
  {
    name: "Gold",
    symbol: "GOLD",
    exchange: "MCX",
    description: "Gold futures and options with precision signals",
    icon: BarChart2,
    color: "text-amber-500",
    bg: "bg-amber-50 border-amber-100",
  },
  {
    name: "Silver",
    symbol: "SILVER",
    exchange: "MCX",
    description: "Silver futures with momentum and trend strategies",
    icon: Activity,
    color: "text-slate-500",
    bg: "bg-slate-50 border-slate-100",
  },
  {
    name: "Crude Oil",
    symbol: "CRUDEOIL",
    exchange: "MCX",
    description: "Crude oil futures with volatility-adjusted risk management",
    icon: Target,
    color: "text-orange-500",
    bg: "bg-orange-50 border-orange-100",
  },
  {
    name: "NSE Equities",
    symbol: "NIFTY50",
    exchange: "NSE",
    description: "Top NSE stocks, futures & options with insights",
    icon: Building2,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-100",
  },
  {
    name: "BSE Equities",
    symbol: "SENSEX",
    exchange: "BSE",
    description: "BSE SENSEX and 500+ scrips with verified signals",
    icon: Globe,
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-100",
  },
];

const FEATURES = [
  {
    title: "Server-Side Computation",
    description: "All indicator calculations run on our servers using verified historical candles. No client-side formula exposure — your edge stays protected.",
    icon: Server,
    color: "text-blue-600",
  },
  {
    title: "SHA-256 Verified Signals",
    description: "Every BUY/SELL signal is cryptographically hashed and verified against server-owned candle data. Zero repaint, zero manipulation.",
    icon: Shield,
    color: "text-emerald-600",
  },
  {
    title: "Real-Time Live Feed",
    description: "Sub-second WebSocket price updates across MCX, NSE, and BSE. IST timestamps throughout. Market hours detection built-in.",
    icon: Zap,
    color: "text-amber-500",
  },
  {
    title: "Mobile-First Terminal",
    description: "Responsive dashboard works on phone, tablet, desktop. Bottom-friendly layout on mobile. Push notifications for watchlist signals.",
    icon: Smartphone,
    color: "text-violet-600",
  },
  {
    title: "Precision Market Data",
    description: "Sub-second WebSocket prices across MCX, NSE and BSE with IST timestamps, market-hours detection, and consistent tabular-nums formatting.",
    icon: Clock,
    color: "text-rose-600",
  },
  {
    title: "Segment-Based Access",
    description: "Choose your markets at signup (MCX, NSE, BSE). Search shows all, display filters to your segments. Admin-managed validity.",
    icon: Layers,
    color: "text-indigo-600",
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Create Account",
    description: "Register with email, name, mobile. Select your trading segments: MCX, NSE, BSE.",
    icon: Shield,
  },
  {
    step: "02",
    title: "Start 14-Day Free Trial",
    description: "Full platform access immediately. No card required. All segments, live feed, everything.",
    icon: Clock,
  },
  {
    step: "03",
    title: "Connect & Customize",
    description: "Search any scrip, add to watchlist. Set up push notifications. Configure your terminal layout.",
    icon: BarChart2,
  },
  {
    step: "04",
    title: "Receive Signals & Trade",
    description: "Verified BUY/SELL signals with entry, SL, Target 1, Target 2. Track P/L, max points, trade lifecycle.",
    icon: Target,
  },
];

function IconWrapper({ icon: Icon, color }: { icon: any; color: string; children?: React.ReactNode }) {
  return (
    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${color} bg-opacity-10`}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

export function FeaturesPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
            Product Deep Dive
          </div>
          <h1 className="font-display mt-6 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            The Intelligence Behind Every Signal
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600 max-w-2xl mx-auto">
            BullionAI combines institutional-grade technical analysis with systematic risk logic — all computed server-side, cryptographically verified, and delivered in real-time across Indian markets.
          </p>
        </div>
      </section>

      {/* Core Philosophy */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 border-y border-slate-200/50">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              No Black Box. Just Verified Logic.
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-slate-600">
              Most signal services hide their methodology. We hide nothing — except the proprietary weightings. Every signal is generated from a known stack: EMA, RSI, MACD, Supertrend, ATR — computed on server-owned candles, SHA-256 verified, and delivered via WebSocket.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "EMA Trend Bias",
                "RSI Momentum",
                "MACD Confirmation",
                "Supertrend Direction",
                "ATR Risk Sizing",
                "Multi-Target Logic",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <Check className="h-5 w-5 text-emerald-500 shrink-0" />
                  <span className="text-[13px] font-medium text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="aspect-video rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-8">
                  <Cpu className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-3 text-[13px] font-medium text-slate-500">Strategy Engine Visualization</p>
                  <p className="mt-1 text-[12px] text-slate-400">Server-side Pine Script execution</p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 md:-bottom-8 md:-right-8 rounded-2xl bg-white p-4 shadow-xl border border-slate-200 max-w-xs">
              <div className="font-display text-[12px] font-bold text-slate-900">Verification</div>
              <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> SHA-256 hash per signal</div>
                <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> Server-owned candles only</div>
                <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> No client-side computation</div>
                <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> Immutable audit trail</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Markets Deep Dive */}
      <section id="markets" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-dark">Market Coverage</div>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Five Markets. One Terminal.</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-500">
            Trade Gold, Silver, Crude Oil on MCX plus NSE & BSE equities — all with the same verified signal engine.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MARKETS.map((market) => {
            const Icon = market.icon;
            return (
              <article key={market.symbol} className={`rounded-2xl border ${market.bg} p-6 transition hover:border-accent/40 hover:shadow-lg`}>
                <div className="flex items-start justify-between">
                  <IconWrapper icon={Icon} color={market.color}>
                    <Icon className="h-5 w-5" />
                  </IconWrapper>
                  <span className="rounded-full bg-navy px-2 py-0.5 text-[9px] font-bold tracking-wider text-white">{market.exchange}</span>
                </div>
                <h3 className="font-display mt-4 text-[17px] font-bold">{market.name}</h3>
                <p className="mt-1 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">{market.symbol}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-slate-600">{market.description}</p>
                <div className="mt-4 pt-4 border-t border-slate-200/50">
                  <Link to="/pricing" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent hover:text-accent-dark">
                    View Plans
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Features Grid */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20 bg-slate-50/50">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-dark">Core Features</div>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Built for Serious Traders</h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <IconWrapper icon={Icon} color={feature.color}>
                  <Icon className="h-5 w-5" />
                </IconWrapper>
                <h3 className="font-display mt-4 text-[15px] font-bold">{feature.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-dark">Dashboard Preview</div>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Professional Trading Terminal</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-500">
            Premium light terminal. Live charts, watchlist, signal history, and trade management — all in one view.
          </p>
        </div>
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xl">
          <div className="bg-navy px-4 py-3 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <BarChart2 className="h-4 w-4 text-white" />
              </div>
              <span className="font-display font-bold text-white">BULLIONAI TERMINAL</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-300">
              <span>IST</span>
              <span className="font-mono tabular-nums">09:15:00</span>
              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-white">LIVE</span>
            </div>
          </div>
          <div className="p-4 md:p-6 grid lg:grid-cols-3 gap-4">
            {/* Chart area */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 aspect-video">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display text-[13px] font-bold">GOLD FUTURES</span>
                  <span className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold text-white">MCX</span>
                </div>
                <svg viewBox="0 0 400 200" className="h-full w-full" role="img" aria-label="Sample candlestick chart with signals">
                  <g stroke="#e2e8f0" strokeWidth="0.5" opacity="0.4">
                    <line x1="0" y1="50" x2="400" y2="50" />
                    <line x1="0" y1="100" x2="400" y2="100" />
                    <line x1="0" y1="150" x2="400" y2="150" />
                  </g>
                  {[
                    [20, 80, 60, 70],
                    [45, 70, 50, 55],
                    [70, 55, 40, 48],
                    [95, 48, 60, 58],
                    [120, 58, 35, 42],
                    [145, 42, 55, 50],
                    [170, 50, 65, 62],
                    [195, 62, 45, 52],
                    [220, 52, 70, 65],
                    [245, 65, 50, 58],
                    [270, 58, 75, 70],
                    [295, 70, 48, 55],
                    [320, 55, 80, 75],
                    [345, 75, 55, 62],
                    [370, 62, 70, 68],
                  ].map(([x, o, h, c], i) => (
                    <g key={i}>
                      <line x1={x} y1={200 - h * 1.5} x2={x} y2={200 - o * 1.5} stroke={c >= o ? "#10b981" : "#ef4444"} strokeWidth="1.5" />
                      <rect x={x - 3} y={Math.min(200 - c * 1.5, 200 - o * 1.5)} width="6" height={Math.max(Math.abs(c - o) * 1.5, 1.5)} fill={c >= o ? "#10b981" : "#ef4444"} rx="1" />
                    </g>
                  ))}
                  {/* BUY signal marker */}
                  <g>
                    <polygon points="70,110 66,120 74,120" fill="#10b981" />
                    <text x="70" y="130" textAnchor="middle" fontSize="7" fontWeight="700" fill="#059669" fontFamily="monospace">BUY</text>
                  </g>
                  {/* SL line */}
                  <line x1="0" y1="125" x2="400" y2="125" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" />
                  <text x="5" y="122" fontSize="7" fill="#ef4444" fontWeight="600" fontFamily="monospace">SL</text>
                  {/* Target lines */}
                  <line x1="0" y1="70" x2="400" y2="70" stroke="#10b981" strokeWidth="1" strokeDasharray="4 4" />
                  <text x="5" y="67" fontSize="7" fill="#10b981" fontWeight="600" fontFamily="monospace">TGT1</text>
                  <line x1="0" y1="40" x2="400" y2="40" stroke="#10b981" strokeWidth="0.8" strokeDasharray="2 3" />
                  <text x="5" y="37" fontSize="7" fill="#10b981" fontWeight="600" fontFamily="monospace">TGT2</text>
                </svg>
              </div>
              {/* Signal info bar */}
              <div className="grid grid-cols-4 gap-3 text-center">
                {[
                  ["Signal", "BUY", "text-emerald-600"],
                  ["Entry", "₹1,57,250", "text-slate-900"],
                  ["SL", "₹1,56,850", "text-rose-600"],
                  ["TGT1", "₹1,57,850", "text-emerald-600"],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
                    <div className={`font-mono font-bold text-[13px] ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Sidebar */}
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-display text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-3">Watchlist</div>
                <div className="space-y-2">
                  {[
                    { sym: "GOLD", price: "1,57,250", chg: "+0.42%", up: true },
                    { sym: "SILVER", price: "2,37,701", chg: "-0.31%", up: false },
                    { sym: "CRUDEOIL", price: "7,962", chg: "+0.08%", up: true },
                    { sym: "NIFTY", price: "24,850", chg: "+0.22%", up: true },
                  ].map((item) => (
                    <div key={item.sym} className="flex items-center justify-between text-[12px]">
                      <span className="font-semibold text-slate-700">{item.sym}</span>
                      <div className="flex items-center gap-3 text-right">
                        <span className="font-mono tabular-nums font-semibold text-slate-900">{item.price}</span>
                        <span className={`font-mono font-medium ${item.up ? "text-emerald-600" : "text-rose-600"}`}>{item.chg}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-display text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-3">Recent Signals</div>
                <div className="space-y-2">
                  {[
                    { time: "09:15", sym: "GOLD", signal: "BUY", price: "1,57,250", pl: "+600", up: true },
                    { time: "10:30", sym: "SILVER", signal: "SELL", price: "2,37,500", pl: "-200", up: false },
                    { time: "11:45", sym: "CRUDE", signal: "BUY", price: "7,950", pl: "+120", up: true },
                  ].map((sig, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-black ${sig.up ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{sig.signal}</span>
                        <span className="font-semibold text-slate-700">{sig.sym}</span>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <span className="font-mono tabular-nums text-slate-600">{sig.price}</span>
                        <span className={`font-mono font-semibold ${sig.up ? "text-emerald-600" : "text-rose-600"}`}>{sig.pl}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20 bg-slate-50/50">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-dark">Getting Started</div>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">From Signup to Signals in Minutes</h2>
        </div>
        <div className="mt-10 relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 hidden lg:block" style={{ transform: "translateX(-50%)" }} />
          <div className="grid gap-8 lg:grid-cols-2">
            {HOW_IT_WORKS_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="relative flex gap-4">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-white font-bold text-[12px] z-10">
                    {step.step}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-3">
                      <IconWrapper icon={Icon} color="text-accent">
                        <Icon className="h-5 w-5" />
                      </IconWrapper>
                      <h3 className="font-display text-[16px] font-bold">{step.title}</h3>
                    </div>
                    <p className="mt-2 ml-10 text-[13px] leading-relaxed text-slate-600">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-10 text-center">
          <Link to="/register" className="gold-cta inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-[14px] font-bold">
            Start 14-Day Free Trial
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* Security & Architecture */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-dark">Trust & Security</div>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Your Data. Your Edge. Protected.</h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Lock, title: "Data Encryption", desc: "TLS 1.3 in transit, AES-256 at rest. Zero trading data shared with third parties." },
            { icon: Shield, title: "No Formula Exposure", desc: "Proprietary weightings stay server-side. Client receives only verified signals." },
            { icon: Server, title: "99.9% Uptime SLA", desc: "Redundant infrastructure across Mumbai & Singapore regions. Health checks every 30s." },
            { icon: Eye, title: "Audit Trail", desc: "Every signal hashed (SHA-256) with timestamp, candle reference, and strategy version." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <IconWrapper icon={Icon} color="text-accent">
                  <Icon className="h-5 w-5" />
                </IconWrapper>
                <h3 className="font-display mt-4 text-[15px] font-bold">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 text-center">
        <div className="rounded-3xl bg-navy p-8 sm:p-12">
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Ready to Trade with Verified Intelligence?</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-200 max-w-xl mx-auto">
            Start your 14-day free trial. Full access. No card required. Cancel anytime.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row items-center justify-center">
            <Link to="/register" className="gold-cta inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-[14px] font-bold">
              Start Free Trial
              <span aria-hidden="true">→</span>
            </Link>
            <Link to="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-transparent px-8 py-3.5 text-[14px] font-semibold text-white transition hover:bg-white/10">
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}