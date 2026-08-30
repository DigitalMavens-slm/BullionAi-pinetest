// @ts-nocheck
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  Clock3,
  Copy,
  LogOut,
  Menu,
  MessageCircle,
  Phone,
  ShieldCheck,
  X,
  Zap,
  Layers,
  Building2,
  TrendingUp,
  Target,
  Activity,
  Eye,
  Cpu,
  Shield,
  LineChart,
  Database,
} from "lucide-react";
import { clearAuthSession, type AuthUser } from "../lib/auth";

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "917904311778";
const WHATSAPP_DISPLAY = "+91 79043 11778";

export function HomePage({ onStartTrial, onSignIn }: { onStartTrial: () => void; onSignIn: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [upiPlan, setUpiPlan] = useState<string | null>(null);
  const upiId = "9842669157@ybl";
  function scrollTo(id: string) {
    setMenuOpen(false);
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="bg-white text-slate-900 antialiased overflow-x-hidden">
      <main>
        {/* HERO */}
        <section id="top" className="mx-auto grid max-w-7xl gap-8 px-4 pt-8 pb-12 sm:px-6 sm:pt-12 lg:grid-cols-2 lg:items-center lg:gap-12 lg:pt-16">
          <div className="text-left">
            <h1 className="font-display text-[32px] font-bold leading-[1.08] tracking-tight sm:text-4xl lg:text-[46px]">AI-Powered Market Intelligence for Smarter Trading</h1>
            <p className="mt-4 text-[14px] leading-relaxed text-slate-600 sm:text-[15px]">
              AI calls, market strategies and real-time trade intelligence across <strong>MCX, NSE and BSE</strong>.
            </p>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Built for active traders across Indian markets.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={onStartTrial} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-[14px] font-semibold text-white hover:bg-black">
                Start 14-Day Free Trial <ArrowRight className="h-4 w-4" />
              </button>
              <a href="/ai-calls" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-[14px] font-semibold text-slate-700 hover:border-slate-400">
                Explore AI Calls
              </a>
            </div>
            <p className="mt-4 text-[11px] font-medium text-slate-400">14-Day Free Trial • Full Platform Access</p>
          </div>
          <div className="relative">
            <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
              <img
                src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=600&fit=crop&crop=center"
                alt="Professional financial market with charts"
                className="h-full w-full object-cover opacity-20"
                loading="eager"
              />
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.18)] backdrop-blur-sm sm:p-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">AI CALL — DEMO PREVIEW</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">HIGH CONFIDENCE</span>
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">AI CALL</span>
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">MCX</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-xl font-bold">BUY</span>
                  <span className="text-[11px] font-semibold text-slate-500">GOLD • Entry ₹1,57,250</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-xl bg-white p-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Target 1</dt>
                    <dd className="font-mono font-semibold text-emerald-700">₹1,57,850</dd>
                  </div>
                  <div className="rounded-xl bg-white p-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Target 2</dt>
                    <dd className="font-mono font-semibold">₹1,58,450</dd>
                  </div>
                  <div className="rounded-xl bg-white p-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">SL</dt>
                    <dd className="font-mono font-semibold text-rose-600">₹1,56,850</dd>
                  </div>
                  <div className="rounded-xl bg-white p-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Confidence</dt>
                    <dd className="font-semibold text-slate-700">HIGH</dd>
                  </div>
                </dl>
                <div className="mt-2 text-[10px] font-medium text-slate-400">Strategy: AI TREND + MOMENTUM • MCX</div>
              </div>
              <p className="mt-3 text-center text-[10px] font-medium text-slate-400">Demo preview • Not live advice</p>
            </div>
          </div>
        </section>

        {/* MARKET TICKER */}
        <section className="border-y border-slate-200/70 bg-slate-50/50 py-3" aria-label="Market ticker">
          <div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 text-[11px] sm:px-6 scrollbar-none">
            {[
              ["GOLD", "₹1,57,250", "+0.42%", "text-emerald-600"],
              ["SILVER", "₹2,37,701", "-0.31%", "text-rose-600"],
              ["CRUDE OIL", "₹7,962", "+0.08%", "text-emerald-600"],
              ["COPPER", "₹1,390", "-0.17%", "text-rose-600"],
            ].map(([name, price, change, cls]) => (
              <span key={name} className="flex shrink-0 items-center gap-2">
                <span className="font-bold tracking-wider text-slate-700">{name}</span>
                <span className="font-mono font-semibold">{price}</span>
                <span className={`font-mono font-bold ${cls}`}>{change}</span>
              </span>
            ))}
            <span className="ml-auto hidden shrink-0 text-[10px] font-medium text-slate-400 sm:block">Sample values • Demo</span>
          </div>
        </section>

        {/* MARKET COVERAGE */}
        <section id="markets" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 sm:px-6 lg:py-16">
          <div className="text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">Market Coverage</div>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">One Platform. Multiple Indian Markets.</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <img src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=220&fit=crop&crop=center" alt="MCX commodity trading - gold bars" className="h-32 w-full object-cover" loading="lazy" />
              <div className="p-5">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <h3 className="font-display mt-3 text-[15px] font-bold">MCX</h3>
                <p className="text-[11px] font-semibold text-slate-500">Commodity Markets</p>
                <ul className="mt-3 space-y-1 text-[12px] font-medium text-slate-600">
                  <li>Gold</li>
                  <li>Silver</li>
                  <li>Crude Oil</li>
                  <li>Copper</li>
                </ul>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <img src="https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=400&h=220&fit=crop&crop=center" alt="NSE stock market charts" className="h-32 w-full object-cover" loading="lazy" />
              <div className="p-5">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="font-display mt-3 text-[15px] font-bold">NSE</h3>
                <p className="text-[11px] font-semibold text-slate-500">Equity Markets</p>
                <ul className="mt-3 space-y-1 text-[12px] font-medium text-slate-600">
                  <li>Stocks</li>
                  <li>Futures</li>
                  <li>Options</li>
                  <li>Market Analysis</li>
                </ul>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <img src="https://images.unsplash.com/photo-1559526324-4f035d45e00b?w=400&h=220&fit=crop&crop=center" alt="BSE Bombay financial district" className="h-32 w-full object-cover" loading="lazy" />
              <div className="p-5">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <Layers className="h-4 w-4" />
                </div>
                <h3 className="font-display mt-3 text-[15px] font-bold">BSE</h3>
                <p className="text-[11px] font-semibold text-slate-500">Equity Markets</p>
                <ul className="mt-3 space-y-1 text-[12px] font-medium text-slate-600">
                  <li>Stocks</li>
                  <li>Market Opportunities</li>
                  <li>Market Analysis</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-6 text-center">
            <a href="/markets" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-[13px] font-semibold text-slate-700 hover:border-slate-400">
              Explore Markets <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>

        {/* WHY BULLIONAI */}
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
          <div className="text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">Why BullionAI</div>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-tight">Built for Traders Who Want Better Market Information</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <Cpu className="h-5 w-5 text-amber-600" />
              <div className="font-display mt-3 text-[14px] font-bold">01 · AI Market Calls</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">Structured BUY and SELL opportunities generated from systematic market analysis.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <Activity className="h-5 w-5 text-blue-600" />
              <div className="font-display mt-3 text-[14px] font-bold">02 · Market Intelligence</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">Monitor market conditions, trends, momentum and volatility.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <Target className="h-5 w-5 text-emerald-600" />
              <div className="font-display mt-3 text-[14px] font-bold">03 · Trading Strategies</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">Follow clearly defined entry, stop-loss and target levels.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <LineChart className="h-5 w-5 text-violet-600" />
              <div className="font-display mt-3 text-[14px] font-bold">04 · Trade Monitoring</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">Track active opportunities and trade outcomes in a structured workflow.</p>
            </div>
          </div>
        </section>

        {/* AI CALLS PREVIEW — single */}
        <section id="ai-calls" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 sm:px-6 lg:py-16">
          <div className="text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">AI Calls Preview</div>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Clear Calls. Clear Levels.</h2>
            <p className="mx-auto mt-3 max-w-xl text-[13px] leading-relaxed text-slate-500">
              Every call shows entry, stop loss, targets, status and points — no hidden logic.
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-sm">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black tracking-wider text-white">BUY CALL</span>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-600">DEMO</span>
              </div>
              <div className="mt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">GOLD FUTURES</div>
                <div className="font-display text-[15px] font-bold">GOLD</div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <dt className="text-slate-500">Entry</dt>
                  <dd className="font-mono font-semibold">₹1,57,250</dd>
                </div>
                <div>
                  <dt className="text-slate-500">SL</dt>
                  <dd className="font-mono font-semibold">₹1,56,850</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Target 1</dt>
                  <dd className="font-mono font-semibold">₹1,57,850</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Target 2</dt>
                  <dd className="font-mono font-semibold">₹1,58,450</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-semibold">TARGET 1 ACHIEVED</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Points</dt>
                  <dd className="font-mono font-semibold">+600 pts</dd>
                </div>
              </dl>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-emerald-100 pt-3 text-[10px]">
                <div>
                  <div className="font-semibold text-slate-500">Entry Time</div>
                  <div className="font-mono font-medium">28-08-2026 09:15</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-500">Trade Status</div>
                  <div className="font-semibold text-emerald-700">ACTIVE</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-500">Current P/L</div>
                  <div className="font-mono font-semibold">+320 pts</div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] font-medium text-slate-400">DEMO data for illustration — not live advice.</p>
            <div className="mt-4 text-center">
              <a href="/ai-calls" className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-black">
                Explore AI Calls <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        {/* CHART VISUAL */}
        <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[13px] font-bold">GOLD FUTURES — 15m</h3>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold">DEMO CHART</span>
            </div>
            <div className="mt-4 h-48 rounded-xl bg-slate-50 p-3 sm:h-56">
              <svg viewBox="0 0 400 140" className="h-full w-full" role="img" aria-label="Sample candlestick chart with BUY markers">
                {/* grid */}
                <g stroke="#e2e8f0" strokeWidth="0.5" opacity="0.6">
                  <line x1="0" y1="35" x2="400" y2="35" />
                  <line x1="0" y1="70" x2="400" y2="70" />
                  <line x1="0" y1="105" x2="400" y2="105" />
                </g>
                {/* candles - simplified */}
                {[
                  [10, 30, 20, 25],
                  [30, 25, 15, 18],
                  [50, 18, 12, 22],
                  [70, 22, 28, 26],
                  [90, 26, 32, 30],
                  [110, 30, 18, 20],
                  [130, 20, 25, 23],
                  [150, 23, 30, 28],
                  [170, 28, 35, 33],
                  [190, 33, 28, 30],
                  [210, 30, 22, 24],
                  [230, 24, 30, 28],
                  [250, 28, 20, 22],
                  [270, 22, 28, 26],
                  [290, 26, 32, 30],
                  [310, 30, 36, 34],
                  [330, 34, 28, 30],
                  [350, 30, 26, 28],
                ].map(([x, o, h, c], i) => (
                  <g key={i}>
                    <line x1={x} y1={140 - h * 2} x2={x} y2={140 - o * 2} stroke={c >= o ? "#10b981" : "#ef4444"} strokeWidth="1" />
                    <rect x={x - 4} y={Math.min(140 - c * 2, 140 - o * 2)} width="8" height={Math.abs(c - o) * 2 || 2} fill={c >= o ? "#10b981" : "#ef4444"} rx="1" />
                  </g>
                ))}
                {/* BUY marker */}
                <g>
                  <polygon points="50,95 46,102 54,102" fill="#10b981" />
                  <text x="50" y="112" textAnchor="middle" fontSize="6" fontWeight="700" fill="#059669">
                    BUY
                  </text>
                </g>
                {/* SL line */}
                <line x1="0" y1="100" x2="400" y2="100" stroke="#ef4444" strokeWidth="0.8" strokeDasharray="4 4" />
                <text x="5" y="98" fontSize="6" fill="#ef4444" fontWeight="600">
                  SL
                </text>
                {/* Target lines */}
                <line x1="0" y1="60" x2="400" y2="60" stroke="#10b981" strokeWidth="0.8" strokeDasharray="4 4" />
                <text x="5" y="58" fontSize="6" fill="#10b981" fontWeight="600">
                  TGT1
                </text>
                <line x1="0" y1="40" x2="400" y2="40" stroke="#10b981" strokeWidth="0.6" strokeDasharray="2 3" />
                <text x="5" y="38" fontSize="6" fill="#10b981" fontWeight="600">
                  TGT2
                </text>
              </svg>
            </div>
            <p className="mt-3 text-center text-[11px] font-medium text-slate-400">
              Clean candlestick view — entry, SL and targets marked. DEMO data.
            </p>
          </div>
        </section>

        {/* STRATEGIES */}
        <section id="strategies" className="scroll-mt-20 bg-slate-50/70 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">Strategies</div>
              <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Systematic Trading Strategies</h2>
              <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-relaxed text-slate-500">
                BullionAI combines market conditions and technical analysis to identify structured trading opportunities.
              </p>
            </div>
            <div className="mx-auto mt-8 max-w-2xl space-y-3">
              {[
                { title: "Trend", desc: "EMA and Supertrend define directional bias." },
                { title: "Momentum", desc: "RSI and MACD confirm strength behind the move." },
                { title: "Volatility", desc: "ATR sets dynamic risk and range expectations." },
                { title: "Confirmation", desc: "Multiple inputs must align before a signal is generated." },
                { title: "Risk Management", desc: "Stop loss is placed systematically, not arbitrarily." },
                { title: "Target Management", desc: "Two targets allow partial protection and continuation." },
              ].map(s => (
                <div key={s.title} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                    •
                  </div>
                  <div>
                    <div className="text-[13px] font-bold">{s.title}</div>
                    <p className="text-[12px] leading-relaxed text-slate-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-8 max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400">Strategy Flow</div>
              <div className="mt-4 grid gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wider">
                {["Market Data", "Market Analysis", "Signal Generation", "Entry", "Stop Loss", "Target 1", "Target 2", "Trade Result"].map((step, i) => (
                  <div key={step} className="flex flex-col items-center">
                    <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700">{step}</div>
                    {i < 7 && <div className="my-1 text-slate-300" aria-hidden="true">
                      ↓
                    </div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* TRADE MANAGEMENT */}
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">Trade Management</div>
            <h2 className="font-display mt-2 text-xl font-bold">More Than a Signal</h2>
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-slate-500">
              Tracks entry, stop loss, Target 1/2, status, max favorable movement, points, entry/exit time and final result. When Target 1 is achieved, the active stop may be adjusted per strategy rules while continuation to Target 2 is monitored.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-[11px] font-bold text-slate-600">Entry → SL → TGT1</div>
                <div className="text-[11px] text-slate-500">Structured levels from the start</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-[11px] font-bold text-slate-600">TGT1 → Adjusted SL</div>
                <div className="text-[11px] text-slate-500">Protects part of the move</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-[11px] font-bold text-slate-600">TGT2 → Result</div>
                <div className="text-[11px] text-slate-500">Full trade lifecycle tracked</div>
              </div>
            </div>
          </div>
        </section>

        {/* INFORMATION CENTER */}
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
          <div className="text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">Live Dashboard</div>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-tight">Information Center Preview</h2>
            <p className="mx-auto mt-2 max-w-xl text-[12px] text-slate-500">Demo preview of the professional trading terminal — sample values.</p>
          </div>
          <div className="mx-auto mt-6 max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-[#0c0e12] shadow-[0_24px_64px_-16px_rgba(0,0,0,0.5)]">
            <div className="grid grid-cols-2 gap-px bg-[#1a1d23] p-px">
              <div className="bg-[#be9619] px-3 py-2 text-center text-[11px] font-black tracking-wider text-black">BULLIONAI</div>
              <div className="bg-[#be9619] px-3 py-2 text-center text-[10px] font-bold text-black">INFORMATION CENTER</div>
              {[
                ["TRADE", "BUY", "text-lime-400"],
                ["STATUS", "OPEN", "text-yellow-400"],
                ["ENTRY", "157250", "text-white"],
                ["SL", "156850", "text-red-400"],
                ["TARGET 1", "157850", "text-cyan-400"],
                ["TGT1", "WAITING", "text-slate-400"],
                ["TARGET 2", "158450", "text-emerald-400"],
                ["CURRENT P/L", "+320 pts", "text-emerald-400"],
                ["MAX POINTS", "+540 pts", "text-cyan-400"],
                ["ENTRY TIME", "28-08-2026 • 08:30 PM", "text-white"],
                ["EXIT TIME", "—", "text-slate-400"],
                ["RESULT", "—", "text-slate-400"],
              ].map(([k, v, cls]) => (
                <div key={k} className="flex items-center justify-between bg-[#0c0e12] px-3 py-2">
                  <span className="text-[10px] font-semibold text-zinc-400">{k}</span>
                  <span className={`text-[11px] font-bold ${cls}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
          <div className="text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">Why BullionAI</div>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-tight">Why Traders Choose AI-Powered Analysis</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["AI-Powered Analysis", "Systematic rules across multiple market conditions.", Cpu],
              ["Real-Time Monitoring", "Live market movements tracked continuously.", Activity],
              ["Structured Risk", "Stop loss and targets defined systematically.", Shield],
              ["Multi-Target", "Target 1 and Target 2 vs single exit.", Target],
              ["Multi-Market", "MCX, NSE and BSE in one terminal.", Layers],
              ["Clear Information", "Entry, SL, targets and status in one place.", Eye],
            ].map(([title, body, Icon]: any) => (
              <div key={title as string} className="rounded-2xl border border-slate-200 bg-white p-5">
                <Icon className="h-5 w-5 text-amber-600" />
                <div className="font-display mt-3 text-[15px] font-bold">{title as string}</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">{body as string}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-5">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 text-center text-[11px] font-medium leading-relaxed text-slate-600">
            <span className="font-bold text-amber-700">High-Confidence AI Calls</span> · <span className="font-bold">AI-Driven Trade Opportunities</span> · Systematic Market Signals · Data-Driven Strategies — <em>Not guaranteed profit. Past performance is not indicative of future results.</em>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6 lg:py-16">
          <div className="text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">Pricing</div>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Simple plans. UPI only.</h2>
            <p className="-mt-1 mb-8 text-center text-[13px] font-medium text-slate-500">14-day free trial — pay via UPI, admin activates.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {[
              { name: "Monthly", price: "₹2,500", per: "/ month", note: "Flexible", save: null, hl: false },
              { name: "Half-Yearly", price: "₹10,000", per: "/ 6 months", note: "Save ₹5,000", save: "Save ₹5,000", hl: false },
              { name: "Yearly", price: "₹18,000", per: "/ year", note: "Best value", save: "Best value", hl: true },
            ].map(p => (
              <div key={p.name} className={["premium-card relative rounded-3xl p-6 sm:p-7", p.hl ? "!border-amber-300 !shadow-[0_20px_60px_-24px_rgba(232,169,61,0.55)]" : ""].join(" ")}>
                {p.save && <span className={["absolute right-5 top-5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider", p.highlight ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-600"].join(" ")}>{(p as any).save}</span>}
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{p.name}</div>
                <div className="font-display mt-3 flex items-baseline gap-1">
                  <span className="text-[28px] font-bold tracking-tight sm:text-[32px]">{p.price}</span>
                  <span className="text-[12px] font-medium text-slate-400">{p.per}</span>
                </div>
                <div className="mt-1 text-[11px] font-medium text-slate-400">{(p as any).note}</div>
                <ul className="mt-5 space-y-2.5 text-[12.5px] font-medium text-slate-600">
                  {["All segments you chose", "All timeframes", "Live feed + history", "Phone/WhatsApp support"].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-500" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setUpiPlan(p.name + " · " + p.price)}
                  className={["mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-bold transition", p.highlight ? "gold-cta" : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400"].join(" ")}
                >
                  Pay via UPI <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">India’s unified terminal for NSE, BSE &amp; MCX</h2>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
              BullionAI brings <b>NSE equities</b>, <b>BSE SENSEX</b> and <b>MCX commodities</b> into one premium terminal. Search any scrip, add to watchlist, and get verified <b>BUY/SELL</b> signals with live charts — filtered by your chosen segments.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div>
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-700">NSE — Equities</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">Top NSE equities with live prices and verified signals.</p>
              </div>
              <div>
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-700">BSE — Equities</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">BSE SENSEX and 500 scrips — same alerts.</p>
              </div>
              <div>
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-700">MCX — Commodities</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">Gold, Silver, Crude and more — live commodity feed.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-12 sm:px-5">
          <h2 className="font-display text-center text-xl font-bold tracking-tight sm:text-2xl">Frequently asked questions</h2>
          <div className="mx-auto mt-6 grid max-w-3xl gap-3">
            {[
              ["What segments does BullionAI support?", "NSE, BSE and MCX. Choose at signup; search shows all, display is filtered."],
              ["Is it mobile responsive?", "Yes — phone shows bottom-friendly layout, desktop shows full terminal."],
              ["How are signals verified?", "Every signal is SHA-256 verified Pine on server-owned candles — no repaint."],
              ["How does subscription work?", "14-day trial, then UPI — admin sets Valid Till via calendar."],
            ].map(([q, a]) => (
              <details key={q as string} className="group rounded-2xl border border-slate-200 bg-white p-4 open:bg-slate-50">
                <summary className="cursor-pointer list-none text-[13px] font-semibold text-slate-800 flex items-center justify-between">
                  {q as string} <span className="ml-2 text-slate-400 group-open:rotate-180 transition">⌄</span>
                </summary>
                <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">{a as string}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="about" className="scroll-mt-20 border-t border-slate-200/70 bg-slate-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 shadow-sm">
              <Building2 className="h-3.5 w-3.5" /> About BullionAI
            </div>
            <h2 className="font-display mt-4 text-2xl font-bold tracking-tight">Trade With Better Information</h2>
            <p className="mx-auto mt-3 max-w-xl text-[13px] leading-relaxed text-slate-500">Turn complex market data into structured, actionable intelligence. One platform. Multiple markets. Trade with information, not emotion.</p>
          </div>
        </section>
      </main>

      {upiPlan && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 backdrop-blur-sm sm:items-center" onClick={() => setUpiPlan(null)}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-7" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600">Subscribe · {upiPlan}</div>
                <h3 className="font-display mt-1 text-lg font-bold">Pay via UPI to activate</h3>
              </div>
              <button onClick={() => setUpiPlan(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="mt-5 space-y-4 text-[13px] font-medium text-slate-600">
              <li className="flex gap-3">
                <span className="brand-gold-dot mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white">1</span>
                <span>
                  Pay to{" "}
                  <span className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <span className="break-all font-mono text-[13px] font-bold">{upiId}</span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(upiId).catch(() => {})}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="brand-gold-dot mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white">2</span>
                <span>Send screenshot + your email to admin on WhatsApp.</span>
              </li>
              <li className="flex gap-3">
                <span className="brand-gold-dot mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white">3</span>
                <span>Admin verifies and activates — usually within minutes.</span>
              </li>
            </ol>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a href="tel:+917904311778" className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 py-2.5 text-[12px] font-semibold text-slate-700">
                <Phone className="h-4 w-4" /> Call admin
              </a>
              <a
                href={`https://wa.me/917904311778?text=${encodeURIComponent("Hi! I paid for BullionAI (" + upiPlan + "). Please activate.")}`}
                target="_blank"
                rel="noreferrer"
                className="gold-cta flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12px]"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20L16 16" />
    </svg>
  );
}

export function TrialExpired({ user }: { user: AuthUser }) {
  const [upiPlan, setUpiPlan] = useState<string | null>(null);
  const upiNumber = "9842669157";
  const upiId = "9842669157@ybl";
  function logout() {
    clearAuthSession();
    location.reload();
  }
  return (
    <div className="page-glow flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl sm:p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
          <span className="text-xl">⏳</span>
        </div>
        <h1 className="font-display mt-4 text-xl font-bold">Trial ended</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
          Hi {user.name}, your 14-day trial expired. Subscribe to continue — admin will set your validity.
        </p>
        <button onClick={() => window.location.assign("/subscribe?plan=yearly")} className="gold-cta mt-5 w-full rounded-xl py-3 text-[13px] font-bold">
          View Plans
        </button>
        <button onClick={logout} className="mt-3 text-[11px] font-semibold text-slate-400 hover:text-slate-600">
          Sign out
        </button>
        {upiPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setUpiPlan(null)}>
            <div className="rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-bold">Pay via UPI: {upiId}</p>
              <button onClick={() => setUpiPlan(null)} className="mt-3 text-xs text-slate-500">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
