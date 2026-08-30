import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, LogIn, Menu, MessageCircle, X, Phone, Mail, MapPin } from "lucide-react";
import { getAuthSession } from "../lib/auth";
import { useSeo } from "../lib/useSeo";

const WHATSAPP_URL = `https://wa.me/917904311778?text=${encodeURIComponent("Hi BullionAI, I'd like to know more about your plans.")}`;

const PAGE_SEO: Record<string, { title: string; description: string }> = {
  "/": {
    title: "BullionAI — AI-Powered MCX Gold, Silver & Crude Oil Trading Signals | India",
    description: "Get verified BUY/SELL trading signals for MCX Gold, Silver, Crude Oil and NSE/BSE equities. AI-powered terminal, live charts, watchlist alerts. 14-day free trial.",
  },
  "/features": {
    title: "Features & Product — BullionAI | AI Trading Signal Engine for MCX, NSE, BSE",
    description: "Explore BullionAI's server-side AI signal engine: verified BUY/SELL signals, live feed, SHA-256 verification, and mobile & desktop terminal.",
  },
  "/pricing": {
    title: "Pricing — BullionAI | 14-Day Free Trial, Plans from ₹2,500/mo (MCX Signals India)",
    description: "View BullionAI pricing: 14-day free trial, Monthly ₹2,500, Half-Yearly ₹10,000, Annual ₹18,000 (best value). Full platform access, UPI payment, cancel anytime.",
  },
  "/how-it-works": {
    title: "How It Works — BullionAI | Get MCX Trading Signals in 4 Easy Steps",
    description: "Sign up, start 14-day free trial, connect & customize your terminal, then receive verified trading signals for MCX Gold, Silver, Crude and more.",
  },
  "/subscribe": {
    title: "Subscribe — BullionAI | Pay via UPI & Activate Your Plan",
    description: "Subscribe to BullionAI via UPI: Monthly ₹2,500, Half-Yearly ₹10,000, Annual ₹18,000. Pay via QR code and activate with WhatsApp confirmation.",
  },
  "/blog": {
    title: "Insights & Market Analysis — BullionAI | Gold, Silver, Crude Oil Trading Education",
    description: "Daily/weekly market analysis on MCX Gold, Silver, Crude Oil. Trading education, strategy breakdowns, and platform updates from the BullionAI research desk.",
  },
  "/faq": {
    title: "FAQ — BullionAI | Trial, Subscription, Refund & Platform Questions",
    description: "Answers to common questions about BullionAI: 14-day free trial, subscription plans, UPI payment, cancellation, refunds, supported markets, and risk disclaimer.",
  },
  "/about": {
    title: "About BullionAI | AI Trading Signals Company in Salem, Tamil Nadu",
    description: "Learn about BullionAI: our mission, Digital Mavens technology partnership, team expertise, and why traders choose verified AI signals over unproven Telegram groups.",
  },
  "/contact": {
    title: "Contact BullionAI | Support, WhatsApp & Address in Salem, Tamil Nadu",
    description: "Contact BullionAI for support, plans, activation. WhatsApp +91 79043 11778, address: 44, Queen Circle, Mahendrapuri, Chinna Tirupathi, Salem - 636008.",
  },
  "/terms": {
    title: "Terms of Service — BullionAI",
    description: "Read BullionAI's Terms of Service governing use of our AI trading signal platform, subscriptions, and disclaimers.",
  },
  "/privacy": {
    title: "Privacy Policy — BullionAI",
    description: "Read BullionAI's Privacy Policy — how we collect, use, and protect your data on our AI trading signals platform.",
  },
  "/risk-disclosure": {
    title: "Risk Disclosure — BullionAI | Trading Risk Disclaimer",
    description: "Important risk disclosure: BullionAI provides informational signals, not investment advice. Trading commodities and derivatives involves substantial risk of loss.",
  },
  "/refund-policy": {
    title: "Refund & Cancellation Policy — BullionAI",
    description: "Read BullionAI's refund & cancellation policy for our 14-day free trial and UPI subscription plans.",
  },
};

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "Features", to: "/features" },
  { label: "Pricing", to: "/pricing" },
  { label: "How It Works", to: "/how-it-works" },
  { label: "Insights", to: "/blog" },
  { label: "FAQ", to: "/faq" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
];

const LEGAL_LINKS = [
  { label: "Terms of Service", to: "/terms" },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Risk Disclosure", to: "/risk-disclosure" },
  { label: "Refund & Cancellation", to: "/refund-policy" },
];

function WhatsAppButton() {
  return (
    <div className="fixed bottom-5 right-5 z-50">
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat with BullionAI on WhatsApp"
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_30px_rgba(37,211,102,0.45)] transition hover:scale-110 hover:shadow-[0_12px_40px_rgba(37,211,102,0.6)]"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuthSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const seoKey = location.pathname.startsWith("/blog/") ? "/blog" : location.pathname;
  useSeo(PAGE_SEO[seoKey] ?? PAGE_SEO["/"]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  function go(href: string) {
    if (href.startsWith("/#")) {
      if (location.pathname !== "/") {
        navigate("/");
        setTimeout(() => document.querySelector(href.slice(1))?.scrollIntoView({ behavior: "smooth" }), 100);
      } else {
        document.querySelector(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      navigate(href);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-slate-900 flex flex-col">
      <header className={`sticky top-0 z-40 transition-shadow ${scrolled ? "shadow-md" : ""} bg-white/95 backdrop-blur-md border-b border-slate-200/80`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div className="leading-none">
              <div className="font-display text-[16px] font-bold tracking-tight text-slate-900">
                BULLION<span className="text-accent">AI</span>
              </div>
              <div className="text-[8px] font-semibold uppercase tracking-[0.2em] text-slate-500">Market Intelligence</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 lg:flex" aria-label="Primary">
            {NAV_LINKS.map(item => (
              <button
                key={item.to}
                onClick={() => go(item.to)}
                className={`relative px-3 py-2 text-[13px] font-semibold transition-colors group ${location.pathname === item.to ? "text-accent" : "text-slate-600 hover:text-accent"}`}
              >
                {item.label}
                <span className={`absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-accent transition-transform duration-300 origin-left ${location.pathname === item.to ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} aria-hidden="true" />
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(auth ? "/dashboard" : "/login")}
              className="hidden items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:border-accent hover:text-accent md:inline-flex"
            >
              <LogIn className="h-3.5 w-3.5" /> Login
            </button>
            {auth ? (
              <button onClick={() => navigate("/dashboard")} className="hidden rounded-full bg-navy px-4 py-1.5 text-[12px] font-bold text-white hover:bg-navy-light sm:block">
                Dashboard
              </button>
            ) : (
              <button onClick={() => navigate("/register")} className="hidden rounded-full bg-accent px-4 py-1.5 text-[12px] font-bold text-white transition hover:bg-accent-dark sm:block">
                Start Free Trial
              </button>
            )}
            <button onClick={() => setMenuOpen(v => !v)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 lg:hidden" aria-label="Toggle menu" aria-expanded={menuOpen}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden border-t border-slate-200/80 bg-white" aria-label="Mobile menu">
            <nav className="mx-auto max-w-7xl px-4 py-4 space-y-1 sm:px-6">
              {NAV_LINKS.map(item => (
                <button key={item.to} onClick={() => go(item.to)} className={`block w-full text-left px-4 py-3 rounded-lg text-[14px] font-medium transition ${location.pathname === item.to ? "bg-slate-100 text-accent" : "text-slate-700 hover:bg-slate-50 hover:text-accent"}`}>
                  {item.label}
                </button>
              ))}
              <div className="pt-3 mt-3 border-t border-slate-200/80">
                {auth ? (
                  <button onClick={() => { setMenuOpen(false); navigate("/dashboard"); }} className="w-full rounded-xl bg-navy px-4 py-3 text-[14px] font-bold text-white">
                    Go to Dashboard
                  </button>
                ) : (
                  <button onClick={() => { setMenuOpen(false); navigate("/login"); }} className="w-full rounded-xl bg-navy px-4 py-3 text-[14px] font-bold text-white">
                    Login
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200/80 bg-slate-50/60">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div className="font-display text-[16px] font-bold text-slate-900">
                BULLION<span className="text-accent">AI</span>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-[12px] leading-relaxed text-slate-500">
              AI-powered market intelligence for MCX Gold, Silver &amp; Crude Oil and NSE/BSE equities. Premium, server-verified signals.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
              <span className="rounded-full bg-navy px-2.5 py-1 font-bold text-white">MCX</span>
              <span className="rounded-full bg-slate-200 px-2.5 py-1 font-bold text-slate-600">NSE</span>
              <span className="rounded-full bg-slate-200 px-2.5 py-1 font-bold text-slate-600">BSE</span>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Product</div>
            <ul className="mt-4 space-y-2.5 text-[13px] font-medium text-slate-600">
              <li><Link to="/features" className="transition hover:text-accent">Features</Link></li>
              <li><Link to="/pricing" className="transition hover:text-accent">Pricing</Link></li>
              <li><Link to="/how-it-works" className="transition hover:text-accent">How It Works</Link></li>
              <li><Link to="/blog" className="transition hover:text-accent">Insights</Link></li>
              <li><Link to="/faq" className="transition hover:text-accent">FAQ</Link></li>
            </ul>
          </div>

          <div className="lg:col-span-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Company</div>
            <ul className="mt-4 space-y-2.5 text-[13px] font-medium text-slate-600">
              <li><Link to="/about" className="transition hover:text-accent">About Us</Link></li>
              <li><Link to="/contact" className="transition hover:text-accent">Contact</Link></li>
              <li><a href="https://digitalmavens.in" target="_blank" rel="noreferrer" className="transition hover:text-accent">Digital Mavens</a></li>
            </ul>
            <div className="mt-6 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Legal</div>
            <ul className="mt-4 space-y-2.5 text-[13px] font-medium text-slate-600">
              {LEGAL_LINKS.map(link => (
                <li key={link.to}><Link to={link.to} className="transition hover:text-accent">{link.label}</Link></li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Contact</div>
            <ul className="mt-4 space-y-3 text-[13px] font-medium text-slate-600">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>
                  BullionAI
                  <br />
                  44, Queen Circle, Mahendrapuri,
                  <br />
                  Chinna Tirupathi, Salem - 636008
                  <br />
                  Tamil Nadu, India
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-accent" />
                <a href="tel:+917904311778" className="transition hover:text-accent">+91 79043 11778</a>
              </li>
              <li className="flex items-center gap-2.5">
                <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="font-semibold text-emerald-600 transition hover:text-emerald-700">
                  Chat With Us
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-accent" />
                <a href="mailto:support@bullionai.in" className="transition hover:text-accent">support@bullionai.in</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mx-auto max-w-7xl border-t border-slate-200/80 px-4 py-6 sm:px-6">
          <p className="text-center text-[11px] leading-relaxed text-slate-500">
            <strong className="font-semibold text-slate-700">Risk Disclosure:</strong> Trading in commodities (Gold, Silver, Crude Oil), equities, futures and options involves substantial risk of loss. BullionAI provides algorithmic signals and market intelligence — it is NOT personalized investment advice and does not guarantee profits. Past performance is not indicative of future results. Trade at your own discretion. Consult a SEBI-registered investment advisor before trading.
          </p>
          <div className="mt-4 flex flex-col items-center justify-between gap-2 text-[11px] font-medium text-slate-400 sm:flex-row">
            <span>© {new Date().getFullYear()} BullionAI · MCX · NSE · BSE</span>
            <span>
              Designed &amp; developed by{" "}
              <a href="https://digitalmavens.in" target="_blank" rel="noreferrer" className="font-semibold text-slate-500 transition hover:text-accent">
                digitalmavens.in
              </a>
            </span>
          </div>
        </div>
      </footer>

      <WhatsAppButton />
    </div>
  );
}