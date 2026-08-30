import { Check, X, Calculator } from "lucide-react";
import { Link } from "react-router-dom";

const PLANS = [
  {
    id: "trial",
    name: "Free Trial",
    price: 0,
    period: "14 days",
    description: "Full platform access — no card required",
    highlight: false,
    popular: false,
    features: [
      { name: "All chosen segments (MCX/NSE/BSE)", included: true },
      { name: "All market segments included", included: true },
      { name: "Live WebSocket feed + history", included: true },
      { name: "Verified BUY/SELL signals", included: true },
      { name: "Entry, SL, Target 1 & 2", included: true },
      { name: "Push notifications for watchlist", included: true },
      { name: "Mobile & desktop terminal", included: true },
      { name: "Phone/WhatsApp support", included: true },
      { name: "SHA-256 signal verification", included: true },
      { name: "Trade lifecycle tracking", included: true },
    ],
    cta: "Start Free Trial",
    ctaVariant: "primary",
  },
  {
    id: "monthly",
    name: "Monthly",
    price: 2500,
    period: "/ month",
    description: "Flexible month-to-month",
    highlight: false,
    popular: false,
    monthlyEquiv: 2500,
    features: [
      { name: "All chosen segments (MCX/NSE/BSE)", included: true },
      { name: "All market segments included", included: true },
      { name: "Live WebSocket feed + history", included: true },
      { name: "Verified BUY/SELL signals", included: true },
      { name: "Entry, SL, Target 1 & 2", included: true },
      { name: "Push notifications for watchlist", included: true },
      { name: "Mobile & desktop terminal", included: true },
      { name: "Phone/WhatsApp support", included: true },
      { name: "SHA-256 signal verification", included: true },
      { name: "Trade lifecycle tracking", included: true },
    ],
    cta: "Subscribe Monthly",
    ctaVariant: "secondary",
  },
  {
    id: "half-yearly",
    name: "Half-Yearly",
    price: 10000,
    period: "/ 6 months",
    description: "Save ₹5,000 vs monthly",
    highlight: false,
    popular: false,
    monthlyEquiv: 1667,
    save: "Save ₹5,000",
    features: [
      { name: "All chosen segments (MCX/NSE/BSE)", included: true },
      { name: "All market segments included", included: true },
      { name: "Live WebSocket feed + history", included: true },
      { name: "Verified BUY/SELL signals", included: true },
      { name: "Entry, SL, Target 1 & 2", included: true },
      { name: "Push notifications for watchlist", included: true },
      { name: "Mobile & desktop terminal", included: true },
      { name: "Phone/WhatsApp support", included: true },
      { name: "SHA-256 signal verification", included: true },
      { name: "Trade lifecycle tracking", included: true },
    ],
    cta: "Subscribe 6 Months",
    ctaVariant: "secondary",
  },
  {
    id: "yearly",
    name: "Yearly",
    price: 18000,
    period: "/ year",
    description: "Best value — save ₹12,000 vs monthly",
    highlight: true,
    popular: true,
    monthlyEquiv: 1500,
    save: "Best Value • Save ₹12,000",
    features: [
      { name: "All chosen segments (MCX/NSE/BSE)", included: true },
      { name: "All market segments included", included: true },
      { name: "Live WebSocket feed + history", included: true },
      { name: "Verified BUY/SELL signals", included: true },
      { name: "Entry, SL, Target 1 & 2", included: true },
      { name: "Push notifications for watchlist", included: true },
      { name: "Mobile & desktop terminal", included: true },
      { name: "Phone/WhatsApp support", included: true },
      { name: "SHA-256 signal verification", included: true },
      { name: "Trade lifecycle tracking", included: true },
    ],
    cta: "Subscribe Yearly",
    ctaVariant: "primary",
  },
];

const FAQ_ITEMS = [
  {
    q: "How does the 14-day free trial work?",
    a: "Sign up with email, name, and mobile. Select your trading segments. You get immediate full access to all features — live feed, verified signals, all market segments, push notifications. No credit card required. After 14 days, your trial ends and you can subscribe via UPI to continue.",
  },
  {
    q: "What payment methods do you accept?",
    a: "UPI only. Choose a plan and subscribe — you'll be taken to a secure page with a QR code. Pay to 9842669157@ybl, then send the payment screenshot + your registered email on WhatsApp (+91 79043 11778). Admin verifies and activates your plan — usually within minutes during business hours (Mon–Sat, 9am–6pm IST).",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Your subscription runs for the paid period (monthly, 6-month, or yearly). Auto-renewal can be disabled by contacting support before the renewal date. No partial refunds for unused time within a billing period — see our Refund Policy.",
  },
  {
    q: "What happens when my trial ends?",
    a: "You'll see a 'Trial Ended' screen with plan options. Your watchlist and settings are preserved. Subscribe via UPI to reactivate immediately. Admin sets your validity date via calendar.",
  },
  {
    q: "Are signals guaranteed to be profitable?",
    a: "No. BullionAI provides algorithmic market analysis and verified signals — not financial advice. Trading commodities, equities, and derivatives carries substantial risk of loss. Past performance is not indicative of future results. Trade at your own discretion.",
  },
  {
    q: "Which markets are included?",
    a: "All plans include your chosen segments: MCX (Gold, Silver, Crude Oil, Copper), NSE (equities, F&O, indices) and BSE (equities, SENSEX). Segment selection happens at signup and can be updated by contacting support.",
  },
];

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
            Simple, Transparent Pricing
          </div>
          <h1 className="font-display mt-6 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Choose Your Plan. Start Free.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600 max-w-2xl mx-auto">
            14-day free trial with full access. Then pay via UPI — admin activates. No auto-charge, no card lock-in.
          </p>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid gap-6 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={[
                "relative rounded-3xl border p-6 sm:p-7 flex flex-col",
                plan.highlight
                  ? "border-accent bg-white shadow-[0_20px_60px_-24px_rgba(29,78,216,0.3)]"
                  : "border-slate-200 bg-white",
              ].join(" ")}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  Most Popular
                </div>
              )}
              {plan.save && !plan.popular && (
                <div className="absolute -top-3 right-4 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  {plan.save}
                </div>
              )}

              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-2">
                {plan.name}
              </div>

              <div className="font-display flex items-baseline gap-1 mb-1">
                <span className="text-[32px] font-bold tracking-tight">
                  {plan.price === 0 ? "₹0" : formatINR(plan.price)}
                </span>
                <span className="text-[14px] font-medium text-slate-400">{plan.period}</span>
              </div>

              <p className="text-[12px] font-medium text-slate-500 mb-4">{plan.description}</p>

              {plan.monthlyEquiv && plan.price > 0 && (
                <p className="text-[11px] text-slate-400 mb-4">
                  ~₹{plan.monthlyEquiv.toLocaleString("en-IN")}/month effective
                </p>
              )}

              <ul className="flex-1 space-y-3 mb-6" role="list">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    {feature.included ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                    )}
                    <span className={[
                      "text-[12.5px] leading-relaxed",
                      feature.included ? "text-slate-700" : "text-slate-400 line-through",
                    ].join(" ")}>
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                to={plan.id === "trial" ? "/register" : `/subscribe?plan=${plan.id}`}
                className={[
                  "inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-bold transition w-full",
                  plan.ctaVariant === "primary"
                    ? "gold-cta"
                    : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400",
                ].join(" ")}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Payment Info */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 bg-slate-50/50">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10">
              <Calculator className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="font-display text-[17px] font-bold">UPI Payment Process</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                We keep it simple — no payment gateways, no card details stored. Pay via UPI, send proof, get activated.
              </p>
              <ol className="mt-4 space-y-3 text-[13px] font-medium text-slate-700">
                {[
                  "Choose a plan and click <strong>Subscribe</strong> to open the secure UPI payment page with QR code",
                  "Pay via any UPI app (PhonePe, GPay, Paytm, BHIM) to <strong>9842669157@ybl</strong>",
                  "Send payment screenshot + your registered email to admin on <strong>WhatsApp +91 79043 11778</strong>",
                  "Admin verifies payment and sets your validity date — usually within minutes during business hours",
                  "Access restored immediately. You'll receive confirmation on WhatsApp.",
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="brand-gold-dot mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white">
                      {i + 1}
                    </span>
                    <span dangerouslySetInnerHTML={{ __html: step }} />
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="pricing-faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Pricing Questions</h2>
        </div>
        <div className="space-y-3" itemScope itemType="https://schema.org/FAQPage">
          {FAQ_ITEMS.map((item, idx) => (
            <details key={idx} className="group rounded-2xl border border-slate-200 bg-white p-5 open:bg-slate-50" itemProp="mainEntity" itemType="https://schema.org/Question">
              <summary className="cursor-pointer list-none flex items-start justify-between gap-4 text-[13px] font-semibold text-slate-800" itemProp="name">
                {item.q}
                <span className="ml-2 shrink-0 text-slate-400 group-open:rotate-180 transition">⌄</span>
              </summary>
              <div className="mt-3 text-[12.5px] leading-relaxed text-slate-600" itemProp="acceptedAnswer" itemType="https://schema.org/Answer" itemScope>
                <span itemProp="text">{item.a}</span>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 text-center">
        <div className="rounded-3xl bg-navy p-8 sm:p-12">
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Start Your 14-Day Free Trial Today</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-200 max-w-xl mx-auto">
            Full platform access. No card required. Choose your segments. Get verified signals in minutes.
          </p>
          <Link to="/register" className="mt-6 gold-cta inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-[14px] font-bold">
            Start Free Trial
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}