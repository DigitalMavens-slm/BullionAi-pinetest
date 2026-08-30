import { Link } from "react-router-dom";
import {
  HelpCircle,
  Shield,
  CreditCard,
  Layers,
  MessageCircle,
  ArrowRight,
} from "lucide-react";

const FAQ_CATEGORIES = [
  {
    title: "About BullionAI",
    icon: HelpCircle,
    color: "text-amber-500",
  },
  {
    title: "Trial & Subscription",
    icon: CreditCard,
    color: "text-emerald-600",
  },
  {
    title: "Markets & Platform",
    icon: Layers,
    color: "text-blue-600",
  },
  {
    title: "Risk & Compliance",
    icon: Shield,
    color: "text-rose-600",
  },
];

const FAQ_ITEMS = [
  {
    category: "About BullionAI",
    q: "What is BullionAI?",
    a: "BullionAI is a premium AI-driven market intelligence platform that provides verified BUY/SELL trading signals for MCX commodities (Gold, Silver, Crude Oil) and NSE/BSE equities. Signals are computed server-side on verified historical candles, SHA-256 hashed for integrity, and delivered in real-time via WebSocket to a professional trading terminal.",
  },
  {
    category: "About BullionAI",
    q: "How is BullionAI different from Telegram signal groups?",
    a: "Most Telegram signal groups rely on manual, often unverifiable 'gurus'. BullionAI uses a systematic, rules-based engine (EMA, RSI, MACD, Supertrend, ATR) with no emotional bias. Every signal is mathematically derived and cryptographically verified. No formula exposure — you see clean signals, not black-box promises.",
  },
  {
    category: "Trial & Subscription",
    q: "How does the 14-day free trial work?",
    a: "Sign up with email, name, and mobile. Select your trading segments (MCX, NSE, BSE). Your trial activates instantly with full platform access — live feed, verified signals, all market segments, push notifications. No credit card required. After 14 days, subscribe via UPI to continue.",
  },
  {
    category: "Trial & Subscription",
    q: "What are the subscription plans?",
    a: "Three paid plans in INR: Monthly (₹2,500/month), Half-Yearly (₹10,000/6 months ≈ ₹1,667/mo), and Yearly Annual (₹18,000/year ≈ ₹1,500/mo — best value). All plans include full access to the same features; the difference is commitment length and effective monthly rate.",
  },
  {
    category: "Trial & Subscription",
    q: "How do I pay? Can I pay by card?",
    a: "We accept UPI only. Choose a plan and subscribe — you'll see a secure page with a QR code for 9842669157@ybl. Then WhatsApp the payment screenshot + your registered email to +91 79043 11778. Admin verifies and activates your plan, usually within minutes during business hours (Mon–Sat, 9am–6pm IST). We do not store card details.",
  },
  {
    category: "Trial & Subscription",
    q: "What happens when my trial ends?",
    a: "You'll see a 'Trial Ended' screen with plan options. Your watchlist and settings are preserved. You can subscribe anytime via UPI — access restores immediately after admin activation. No automatic charge happens.",
  },
  {
    category: "Trial & Subscription",
    q: "Is this a subscription (recurring billing) or one-time?",
    a: "Each plan is a fixed-term purchase (1 month, 6 months, or 12 months), paid via UPI upfront. There is no auto-renewal or auto-debit. When your period ends, you can renew by contacting us. Nothing is charged without your explicit payment.",
  },
  {
    category: "Trial & Subscription",
    q: "Can I cancel or get a refund?",
    a: "You can cancel anytime and your access continues until the end of the paid period. We offer refunds only in specific cases (e.g., platform failures, duplicate payment). See our Refund & Cancellation Policy for full terms. We do not provide partial refunds for unused time.",
  },
  {
    category: "Markets & Platform",
    q: "Which markets does BullionAI support?",
    a: "MCX commodities: Gold, Silver, Crude Oil, Copper. NSE: equities, futures & options, indices (NIFTY, Bank NIFTY, NIFTY IT). BSE: equities & SENSEX. You select segments at signup; search shows all, display filters to your chosen segments.",
  },
  {
    category: "Markets & Platform",
    q: "Which devices does the terminal support?",
    a: "The BullionAI terminal is fully responsive. On mobile you get a bottom navigation bar with swipeable panels (Chart, Watchlist, Signals); on desktop you get the full three-panel professional terminal. Push notifications work on both phone and desktop browsers.",
  },
  {
    category: "Markets & Platform",
    q: "Does it work on mobile?",
    a: "Yes. The terminal is fully responsive. On mobile, you get a bottom navigation bar with swipeable panels (Chart, Watchlist, Signals). Push notifications work in background. On desktop, you get the full three-panel professional terminal.",
  },
  {
    category: "Markets & Platform",
    q: "Do I need to connect my broker account?",
    a: "No. BullionAI operates as a standalone market intelligence terminal. You don't connect your broker or trading account. We show you verified signals and market data; you execute trades with your own broker ('connect' refers to selecting symbols in your watchlist). This keeps your trading account fully private.",
  },
  {
    category: "Markets & Platform",
    q: "Is the data real-time?",
    a: "Yes. Prices update via WebSocket in near-real-time. Market hours (IST) are detected automatically. Historical candles are pulled from verified server-side data. Signals are recomputed every 30s and pushed instantly on change.",
  },
  {
    category: "Risk & Compliance",
    q: "Is BullionAI investment advice? Will I profit?",
    a: "No. BullionAI provides algorithmically-generated market signals and analytics — it is NOT personalized investment/financial advice. Trading commodities (Gold, Silver, Crude), equities, futures and options carries substantial risk of loss. We do not guarantee profits. Past performance is not indicative of future results. Trade at your own discretion and consider consulting a SEBI-registered advisor.",
  },
  {
    category: "Risk & Compliance",
    q: "Where is BullionAI registered?",
    a: "BullionAI, 44, Queen Circle, Mahendrapuri, Chinna Tirupathi, Salem - 636008. Built and operated under Digital Mavens. For support, WhatsApp +91 79043 11778.",
  },
  {
    category: "Risk & Compliance",
    q: "How do I get support?",
    a: "Fastest: WhatsApp +91 79043 11778 (Mon–Sat, 9am–6pm IST) for support, payments, and activation. Also via the Contact page form or email support@bullionai.in. For payment screenshots, include your registered email.",
  },
];

export function FAQPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
            Frequently Asked Questions
          </div>
          <h1 className="font-display mt-6 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Everything You Need to Know
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600 max-w-2xl mx-auto">
            Answers about the trial, subscription, markets, platform, and risk. Still need help? Reach us on WhatsApp anytime.
          </p>
        </div>
      </section>

      {/* Categories overview */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FAQ_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <a
                key={cat.title}
                href={`#${cat.title.toLowerCase().replace(/[\s&]/g, '-')}`}
                className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-accent/40 hover:shadow-lg"
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 mb-3">
                  <Icon className={`h-5 w-5 ${cat.color}`} />
                </div>
                <div className="text-[14px] font-bold text-slate-800">{cat.title}</div>
                <div className="mt-1 text-[12px] text-slate-500">
                  {cat.title === "About BullionAI" ? "2 questions" :
                   cat.title === "Trial & Subscription" ? "6 questions" :
                   cat.title === "Markets & Platform" ? "5 questions" : "3 questions"}
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* Full FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        {["About BullionAI", "Trial & Subscription", "Markets & Platform", "Risk & Compliance"].map((section) => (
          <div key={section} id={section.toLowerCase().replace(/[\s&]/g, '-')} className="mb-14 scroll-mt-24">
            <h2 className="font-display text-xl font-bold tracking-tight mb-6 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                {section === "About BullionAI" && <HelpCircle className="h-4 w-4 text-accent" />}
                {section === "Trial & Subscription" && <CreditCard className="h-4 w-4 text-emerald-600" />}
                {section === "Markets & Platform" && <Layers className="h-4 w-4 text-blue-600" />}
                {section === "Risk & Compliance" && <Shield className="h-4 w-4 text-rose-600" />}
              </span>
              {section}
            </h2>

            <div className="space-y-3" itemScope itemType="https://schema.org/FAQPage">
              {FAQ_ITEMS.filter((item) => item.category === section).map((item, idx) => (
                <details
                  key={idx}
                  itemScope
                  itemType="https://schema.org/Question"
                  className="group rounded-2xl border border-slate-200 bg-white p-5 open:bg-slate-50"
                >
                  <summary
                    itemProp="name"
                    className="cursor-pointer list-none flex items-start justify-between gap-4 text-[13px] font-semibold text-slate-800"
                  >
                    {item.q}
                    <span className="ml-2 shrink-0 text-slate-400 group-open:rotate-180 transition" aria-hidden="true">⌄</span>
                  </summary>
                  <div
                    itemProp="acceptedAnswer"
                    itemScope
                    itemType="https://schema.org/Answer"
                    className="mt-3 text-[12.5px] leading-relaxed text-slate-600"
                  >
                    <span itemProp="text">{item.a}</span>
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Still need help */}
      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-8 text-center sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white">
            <MessageCircle className="h-7 w-7" />
          </div>
          <h2 className="font-display mt-4 text-xl font-bold sm:text-2xl">Still have questions?</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-600 max-w-md mx-auto">
            Our team is available Mon–Sat, 9am–6pm IST on WhatsApp. Get instant answers about subscriptions, activation, or anything else.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row items-center justify-center">
            <a
              href="https://wa.me/917904311778?text=Hi%20BullionAI%2C%20I%20have%20a%20question"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-7 py-3 text-[13px] font-bold text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
            </a>
            <Link to="/contact" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-7 py-3 text-[13px] font-semibold text-slate-700 hover:border-slate-400">
              <ArrowRight className="h-4 w-4" /> Contact Page
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}