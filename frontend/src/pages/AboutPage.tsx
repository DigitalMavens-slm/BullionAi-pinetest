import { Link } from "react-router-dom";
import {
  Target,
  Shield,
  Users,
  Cpu,
  Code2,
  TrendingUp,
  LineChart,
  Eye,
  ArrowRight,
  BarChart2,
} from "lucide-react";

const DIFFERENTIATORS = [
  {
    title: "Verified Signals, Not Gurus",
    desc: "Unlike Telegram signal groups, every BullionAI signal is algorithmically computed and SHA-256 verified. No 'guru' discretion, no unverifiable claims.",
    icon: Shield,
  },
  {
    title: "Server-Side Logic Protection",
    desc: "Proprietary weightings stay on our servers. You see clean, credible signals without formula exposure — unlike copy-trade schemes.",
    icon: Cpu,
  },
  {
    title: "Structured Risk, Every Trade",
    desc: "Every signal ships with entry, stop loss, Target 1, Target 2 and systematic risk management. No vague 'buy the dip' advice.",
    icon: Target,
  },
  {
    title: "Full Trade Lifecycle Tracking",
    desc: "Track current P/L, max points, entry/exit times and final result. Complete transparency on every recommended trade.",
    icon: LineChart,
  },
];

const TEAM = [
  {
    name: "Chief Trading Strategist",
    role: "Market Strategy & Engine Design",
    desc: "Institutional background in derivatives & quantitative market analysis. Defines strategy logic and risk framework.",
    icon: TrendingUp,
  },
  {
    name: "Quantitative Engineer",
    role: "Signal Engine & Infrastructure",
    desc: "Builds and maintains the server-side Pine script engine, real-time WebSocket feed, and verification system.",
    icon: Code2,
  },
  {
    name: "Market Research Analyst",
    role: "Gold, Silver & Crude Analysis",
    desc: "Publishes daily/weekly market commentary and keeps the Insight hub fresh with actionable analysis.",
    icon: Eye,
  },
  {
    name: "Client Success & Risk Desk",
    role: "Support & Compliance",
    desc: "Handles onboarding, UPI activation, support via WhatsApp, and compliance review of disclaimers.",
    icon: Users,
  },
];

export function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
            About BullionAI
          </div>
          <h1 className="font-display mt-6 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Precision Intelligence for Indian Markets
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600 max-w-2xl mx-auto">
            BullionAI turns noisy market data into structured, verifiable trading intelligence — built for serious MCX commodity and equity traders.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 border-y border-slate-200/50">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-dark">Our Story</div>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Built by Traders & Engineers</h2>
            <p className="mt-4 text-[14px] leading-relaxed text-slate-600">
              BullionAI was born from a simple frustration: signal services were opaque, unverifiable, and unreliable. Telegram groups promised profits but never disclosed how calls were made. Copy-trade platforms leaked your entire position.
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
              So we built the platform we'd trust with our own money — a rules-based, mathematically verifiable engine. Every signal is computed on server-owned historical candles, cryptographically hashed, and delivered in real-time. No black box. No repaint. No formula exposure.
            </p>
          </div>
          <div className="rounded-3xl bg-navy p-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="font-mono text-4xl font-bold text-gold-light">15+</div>
                <div className="mt-1 text-[11px] font-medium text-white/60">Tech indicators run per signal</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-4xl font-bold text-gold-light">5</div>
                <div className="mt-1 text-[11px] font-medium text-white/60">Markets covered</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-4xl font-bold text-gold-light">30s</div>
                <div className="mt-1 text-[11px] font-medium text-white/60">Signal recompute interval</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-4xl font-bold text-gold-light">100%</div>
                <div className="mt-1 text-[11px] font-medium text-white/60">Server-side computation</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
              <Target className="h-6 w-6 text-accent" />
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Our Mission</h2>
          </div>
          <p className="mt-5 text-[16px] leading-relaxed text-slate-600">
            "To transform complex, noisy market data into structured, verifiable, and actionable intelligence — so every trader can act with information, not emotion."
          </p>
        </div>
      </section>

      {/* What We Do */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20 bg-slate-50/50">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-dark">What We Do</div>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">More Than a Signal. A System.</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BarChart2, title: "Market Intelligence", desc: "Real-time data on MCX Gold, Silver, Crude Oil + NSE/BSE equities & derivatives." },
            { icon: TrendingUp, title: "Signal Generation", desc: "Rules-based BUY/SELL signals with entry, SL, and multi-target levels." },
            { icon: Eye, title: "Verification", desc: "Every signal SHA-256 hashed against server-owned candles — zero repaint." },
            { icon: LineChart, title: "Trade Tracking", desc: "Full lifecycle: current P/L, max points, entry/exit time, final result." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 mb-4">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="font-display text-[15px] font-bold">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Digital Mavens */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-navy px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold-light">
                <Code2 className="h-3.5 w-3.5" /> Technology Partner
              </div>
              <h2 className="font-display mt-4 text-2xl font-bold tracking-tight">Powered by Digital Mavens</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
                BullionAI is built and operated under <strong>Digital Mavens</strong> — a product studio specializing in market intelligence and trading technology. We handle the engineering, infrastructure, and ongoing development of the signal engine, terminal, and security systems.
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
                As the technology partner, Digital Mavens owns the code, infrastructure, and release pipeline. This means BullionAI benefits from continuous innovation, rigorous testing, and institutional-grade reliability.
              </p>
              <a href="https://digitalmavens.in" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2.5 text-[13px] font-semibold text-slate-700 hover:border-slate-400">
                Visit digitalmavens.in <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <div className="rounded-2xl bg-navy p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                <Code2 className="h-8 w-8 text-gold-light" />
              </div>
              <div className="font-display mt-4 text-lg font-bold text-white">Digital Mavens</div>
              <p className="mt-1 text-[12px] text-white/60">Technology Partner · Product Studio</p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="font-mono text-xl font-bold text-gold-light">99.9%</div>
                  <div className="text-[10px] text-white/50">Uptime</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="font-mono text-xl font-bold text-gold-light">24/7</div>
                  <div className="text-[10px] text-white/50">Monitoring</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="font-mono text-xl font-bold text-gold-light">100%</div>
                  <div className="text-[10px] text-white/50">Server-side</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why BullionAI */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20 bg-slate-50/50">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-dark">Why Choose Us</div>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Why BullionAI Over Generic Signal Groups</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {DIFFERENTIATORS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 mb-4">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="font-display text-[15px] font-bold">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Team */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-dark">The Team</div>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Expertise Behind Every Signal</h2>
          <p className="mt-3 text-[14px] text-slate-500">A cross-functional team of market strategists, quantitative engineers, and research analysts.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((person) => {
            const Icon = person.icon;
            return (
              <div key={person.name} className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-navy">
                  <Icon className="h-8 w-8 text-gold-light" />
                </div>
                <h3 className="font-display mt-4 text-[15px] font-bold">{person.name}</h3>
                <div className="text-[11px] font-semibold text-accent uppercase tracking-wider">{person.role}</div>
                <p className="mt-3 text-[12.5px] leading-relaxed text-slate-500">{person.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 text-center">
        <div className="rounded-3xl bg-navy p-8 sm:p-12">
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Trade With Better Information</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-200 max-w-xl mx-auto">
            Join traders who chose verifiable intelligence over unproven promises. Start your free trial today.
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