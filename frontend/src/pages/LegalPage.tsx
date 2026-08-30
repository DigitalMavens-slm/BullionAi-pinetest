import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FileText, Clock, AlertTriangle } from "lucide-react";

type LegalSection = {
  id: string;
  heading: string;
  body: React.ReactNode;
};

export type LegalDoc = {
  title: string;
  slug: string;
  category: string;
  updated: string;
  lead: string;
  sections: LegalSection[];
};

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const [activeSection, setActiveSection] = useState<string>(doc.sections[0]?.id ?? "");

  useEffect(() => {
    setActiveSection(doc.sections[0]?.id ?? "");
    window.scrollTo(0, 0);
  }, [doc]);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="border-b border-slate-200/70 bg-slate-50/60">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-4">
            <Link to="/" className="hover:text-accent">Home</Link>
            <span>/</span>
            <span>{doc.category}</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">{doc.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Last updated: {doc.updated}
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{doc.category}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Sidebar nav */}
          <aside className="lg:col-span-3">
            <nav className="lg:sticky lg:top-8" aria-label="Document sections">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-3">On this page</div>
              <ul className="space-y-1 border-l-2 border-slate-100">
                {doc.sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className={[
                        "block border-l-2 -ml-0.5 pl-4 py-1.5 text-[13px] font-medium transition",
                        activeSection === section.id
                          ? "border-accent text-slate-900"
                          : "border-transparent text-slate-500 hover:text-slate-800",
                      ].join(" ")}
                      onClick={() => setActiveSection(section.id)}
                    >
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <div className="text-[12px] font-bold text-amber-800">Questions about this policy?</div>
                <a href="https://wa.me/917904311778?text=Hi%2C%20I%20have%20a%20question%20about%20BullionAI%20policies" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 hover:text-emerald-800">
                  Chat on WhatsApp →
                </a>
              </div>
            </nav>
          </aside>

          {/* Content */}
          <div className="lg:col-span-9">
            <p className="text-[14px] leading-relaxed text-slate-600 border-b border-slate-100 pb-6 mb-8">{doc.lead}</p>
            <div className="space-y-10">
              {doc.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="font-display text-xl font-bold tracking-tight mb-3 flex items-center gap-2">
                    <span className="flex h-6 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                    {section.heading}
                  </h2>
                  <div className="prose prose-slate max-w-none text-[14px] leading-relaxed text-slate-700">
                    {section.body}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-[12px] leading-relaxed text-slate-500">
                This document is a placeholder for review by BullionAI's compliance/legal advisor before launch. Last updated {doc.updated}. For questions, WhatsApp +91 79043 11778.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const TERMS_DOC: LegalDoc = {
  title: "Terms of Service",
  slug: "terms",
  category: "Legal",
  updated: "August 28, 2026",
  lead: "These Terms of Service ('Terms') govern your access to and use of BullionAI, operated by Digital Mavens. By creating an account or using the platform, you agree to be bound by these Terms. Please read them carefully.",
  sections: [
    {
      id: "acceptance",
      heading: "1. Acceptance of Terms",
      body: (
        <>
          <p>By registering, creating an account, or otherwise accessing BullionAI (the 'Platform'), you agree to be bound by these Terms of Service and the accompanying Privacy Policy, Risk Disclosure, and Refund & Cancellation Policy. If you do not agree to these Terms, you must not use the Platform.</p>
          <p>You must be at least 18 years of age to use the Platform. By using BullionAI, you represent and warrant that you are at least 18 and have the legal capacity to enter into these Terms.</p>
        </>
      ),
    },
    {
      id: "service",
      heading: "2. Description of Service",
      body: (
        <>
          <p>BullionAI provides AI-generated market analysis, trading signals, market data, and a terminal interface for Indian financial markets, including MCX commodities (Gold, Silver, Crude Oil) and NSE/BSE equities and derivatives. Signals are computationally generated and provided on an as-is, informational basis.</p>
          <p>BullionAI is a market intelligence platform. It is not a broker, exchange, investment advisor, or portfolio manager. BullionAI does not execute trades, hold funds, or provide personalized investment advice.</p>
        </>
      ),
    },
    {
      id: "accounts",
      heading: "3. User Accounts",
      body: (
        <>
          <p>You are responsible for maintaining the confidentiality of your account credentials (email, mobile, password). You agree to provide accurate, current, and complete registration information. You are solely responsible for all activity that occurs under your account.</p>
          <ul>
            <li>You must not share your account credentials with any third party.</li>
            <li>You must notify us immediately of any unauthorized use of your account.</li>
            <li>You are responsible for the accuracy of information provided at registration, including your trading segments.</li>
            <li>BullionAI may suspend or terminate accounts that violate these Terms.</li>
          </ul>
        </>
      ),
    },
    {
      id: "subscriptions",
      heading: "4. Subscriptions & Billing",
      body: (
        <>
          <p>BullionAI offers a 14-day free trial and paid subscriptions in INR via UPI. Plans include:</p>
          <ul>
            <li>Monthly: ₹2,500 per month</li>
            <li>Half-Yearly: ₹10,000 per 6 months (≈₹1,667/month)</li>
            <li>Annual: ₹18,000 per year (≈₹1,500/month)</li>
          </ul>
          <p>All payments are made via UPI to 9842669157@ybl, verified manually by BullionAI administration. Subscription activation is manual and subject to verification of payment. Access is provided for the period purchased. There is no auto-renewal or auto-debit. Renewal is at your discretion.</p>
        </>
      ),
    },
    {
      id: "trial",
      heading: "5. Trial Period",
      body: (
        <>
          <p>The 14-day free trial provides full platform access for 14 days from account activation. No credit card is required. At the end of the trial, access will be suspended until a paid subscription is activated. All data and watchlist settings are retained. BullionAI reserves the right to modify or discontinue trial terms.</p>
        </>
      ),
    },
    {
      id: "signals-disclaimer",
      heading: "6. Signals & Not Investment Advice",
      body: (
        <>
          <p>All signals, analytics, and market commentary provided by BullionAI are generated algorithmically and are provided for informational and educational purposes only. They are <strong>not</strong> personalized investment, financial, or trading advice. They do not account for your individual financial situation, risk tolerance, or investment objectives.</p>
          <p>Trading in commodities, equities, futures, and options involves substantial risk of loss. You acknowledge that you are solely responsible for any trading decisions and their outcomes. Past performance of any signal, strategy, or model does not guarantee future results.</p>
        </>
      ),
    },
    {
      id: "ip",
      heading: "7. Intellectual Property",
      body: (
        <>
          <p>The Platform, including its software, design, trade dress, proprietary algorithms, signal-generation models, graphics, and content, is the exclusive property of BullionAI and Digital Mavens, protected by applicable intellectual property laws. No formula or proprietary weighting is disclosed to users.</p>
          <p>You may not copy, modify, distribute, reverse-engineer, or create derivative works of any portion of the Platform without prior written consent.</p>
        </>
      ),
    },
    {
      id: "acceptable-use",
      heading: "8. Acceptable Use",
      body: (
        <>
          <p>You agree not to use the Platform to:</p>
          <ul>
            <li>Violate any applicable law, regulation, or exchange rule.</li>
            <li>Attempt to reverse-engineer, probe, or exploit the signal engine or its data sources.</li>
            <li>Share, redistribute, or resell signals or market data to third parties.</li>
            <li>Interfere with the Platform's operation through automated means, denial-of-service, or data scraping at scale.</li>
            <li>Impersonate BullionAI or misrepresent your relationship with us.</li>
            <li>Use the Platform for any unlawful, fraudulent, or harmful purpose.</li>
          </ul>
        </>
      ),
    },
    {
      id: "limitation-liability",
      heading: "9. Limitation of Liability",
      body: (
        <>
          <p>To the maximum extent permitted by law, BullionAI, its affiliates, and its personnel shall not be liable for any indirect, incidental, special, consequential, or exemplary damages — including trading losses, loss of profits, or data loss — arising from your use of or reliance on the Platform, signals, or market data.</p>
          <p>Our cumulative liability for any claim shall not exceed the total amount paid by you to BullionAI in the twelve (12) months preceding the claim.</p>
        </>
      ),
    },
    {
      id: "termination",
      heading: "10. Term & Termination",
      body: (
        <>
          <p>These Terms remain in force while you use the Platform. You may terminate your account at any time by contacting support. BullionAI may suspend or terminate your access for breach of these Terms, fraudulent activity, or conduct that harms the Platform or other users. Upon termination, your right to use the Platform ceases; paid access continues only for the period purchased.</p>
        </>
      ),
    },
    {
      id: "governing-law",
      heading: "11. Governing Law & Jurisdiction",
      body: (
        <>
          <p>These Terms are governed by the laws of the Republic of India. Any disputes arising from these Terms or the use of the Platform shall be subject to the exclusive jurisdiction of the courts at Salem, Tamil Nadu, India.</p>
        </>
      ),
    },
    {
      id: "changes",
      heading: "12. Changes to Terms",
      body: (
        <>
          <p>We may update these Terms from time to time. Continued use of the Platform after changes constitutes acceptance of the revised terms. We will notify users of material changes via the Platform or WhatsApp. Users may terminate their account if they disagree with the changes.</p>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center gap-2 text-[12px] font-bold text-amber-800">
              <AlertTriangle className="h-4 w-4" /> Contact
            </div>
            <p className="mt-1 text-[12px] text-slate-600">
              BullionAI, 44, Queen Circle, Mahendrapuri, Chinna Tirupathi, Salem - 636008. WhatsApp: +91 79043 11778.
            </p>
          </div>
        </>
      ),
    },
  ],
};

export const PRIVACY_DOC: LegalDoc = {
  title: "Privacy Policy",
  slug: "privacy",
  category: "Legal",
  updated: "August 28, 2026",
  lead: "This Privacy Policy explains how BullionAI ('we', 'us') collects, uses, and protects your personal information when you use the Platform. We are committed to respecting your privacy and safeguarding your data.",
  sections: [
    {
      id: "info-we-collect",
      heading: "1. Information We Collect",
      body: (
        <>
          <p>We collect minimal data required to provide the service:</p>
          <ul>
            <li><strong>Account Data:</strong> Your full name, email address, and mobile number.</li>
            <li><strong>Profile Data:</strong> Selected trading segments (MCX, NSE, BSE) and subscription plan.</li>
            <li><strong>Usage Data:</strong> Default scripts/watchlist symbols selected (stored locally on your device for personal convenience; not transmitted as personal data to us for marketing).</li>
            <li><strong>Transaction Data:</strong> UPI payment references and activation records for billing/admin purposes.</li>
          </ul>
          <p>We do not collect sensitive financial information, card numbers, bank credentials, or personal trading account credentials.</p>
        </>
      ),
    },
    {
      id: "how-we-use",
      heading: "2. How We Use Your Data",
      body: (
        <>
          <p>We use collected information solely to:</p>
          <ul>
            <li>Create and manage your account.</li>
            <li>Provide the terminal, live feed, and signals to your selected segments.</li>
            <li>Administer subscriptions, payments, and access validity.</li>
            <li>Provide customer support via WhatsApp or email.</li>
            <li>Send transactional and account-related notifications (e.g., trial end, activation confirmations).</li>
            <li>Comply with applicable legal obligations.</li>
          </ul>
          <p>We do not sell, rent, or trade your personal information to third parties. We do not use your data for third-party advertising.</p>
        </>
      ),
    },
    {
      id: "data-sharing",
      heading: "3. Data Sharing & Disclosure",
      body: (
        <>
          <p>We may share limited data in the following circumstances:</p>
          <ul>
            <li><strong>Service Providers:</strong> With trusted infrastructure providers (hosting, data storage, security) under data-processing agreements, limited to what is necessary to operate the Platform.</li>
            <li><strong>Legal Compliance:</strong> When required by law, court order, or regulatory authority, subject to legal process.</li>
            <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, where your data would be transferred under an equivalent privacy framework.</li>
          </ul>
          <p>Your trading watchlist and settings are stored on your device. Individual signal-history records are per-account and not shared with other users.</p>
        </>
      ),
    },
    {
      id: "data-security",
      heading: "4. Data Security",
      body: (
        <>
          <p>We implement reasonable technical and organizational measures to protect your data: TLS 1.3 encryption in transit, restricted access controls, and regular security reviews. While we strive to protect your information, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>
        </>
      ),
    },
    {
      id: "retention",
      heading: "5. Data Retention",
      body: (
        <>
          <p>We retain your account data for as long as your account is active. If you request deletion or your account becomes inactive, we retain minimal records as required for legal, accounting, and compliance purposes (typically up to the periods required by Indian law). You may request deletion of your account data by contacting support@bullionai.in.</p>
        </>
      ),
    },
    {
      id: "your-rights",
      heading: "6. Your Privacy Rights",
      body: (
        <>
          <p>You have the right to:</p>
          <ul>
            <li>Access a copy of your personal data held by us.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your account and associated data (subject to legal/accounting retention).</li>
            <li>Withdraw consent for processing where applicable.</li>
          </ul>
          <p>To exercise any of these rights, contact us via WhatsApp +91 79043 11778 or support@bullionai.in. We will respond within a reasonable timeframe.</p>
        </>
      ),
    },
    {
      id: "cookies",
      heading: "7. Cookies & Local Storage",
      body: (
        <>
          <p>We use browser local storage to persist your session and watchlist preferences on your own device. We do not use third-party tracking cookies for advertising. You may clear your browser's local storage to remove these preferences.</p>
        </>
      ),
    },
    {
      id: "changes",
      heading: "8. Changes to This Policy",
      body: (
        <>
          <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date. Continued use following changes constitutes acceptance. For material changes, we will notify active users.</p>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <p className="text-[12px] text-slate-600"><strong>Contact:</strong> BullionAI, 44, Queen Circle, Mahendrapuri, Chinna Tirupathi, Salem - 636008. Email: support@bullionai.in.</p>
          </div>
        </>
      ),
    },
  ],
};

export const RISK_DOC: LegalDoc = {
  title: "Risk Disclosure & Disclaimer",
  slug: "risk-disclosure",
  category: "Legal",
  updated: "August 28, 2026",
  lead: "CRITICAL: Please read this Risk Disclosure carefully before using BullionAI. This document explains the real risks associated with trading and the limitations of algorithmic signals. This is a placeholder structure for review by your compliance/legal advisor before launch.",
  sections: [
    {
      id: "not-advice",
      heading: "1. Not Investment / Financial Advice",
      body: (
        <>
          <p>BullionAI is a software tool that generates algorithmic trading signals and provides market data. <strong>BullionAI does NOT provide personalized investment, financial, or trading advice.</strong> We are not a SEBI-registered investment advisor. Nothing on the Platform should be construed as a recommendation to buy or sell any security, commodity, or derivative.</p>
          <p>All signals are informational and educational. They do not account for your personal financial situation, goals, experience, or risk tolerance. You must independently evaluate any signal before acting on it.</p>
        </>
      ),
    },
    {
      id: "risk-of-loss",
      heading: "2. Risk of Loss in Trading",
      body: (
        <>
          <p>Trading in commodities (Gold, Silver, Crude Oil), equities, futures, and options involves substantial risk of loss and is not suitable for every investor. Leverage can magnify both gains and losses. You may lose more than your initial capital. Past performance of any market, signal, strategy, or model is <strong>not indicative of future results</strong>.</p>
          <ul>
            <li>Commodity and derivative prices are volatile and can move rapidly.</li>
            <li>Gap risk, liquidity risk, and market closure risk are inherent.</li>
            <li>Algorithmic signals may fail, produce false signals, or become stale in fast markets.</li>
            <li>Technical-analysis-based models have known limitations and blind spots.</li>
          </ul>
        </>
      ),
    },
    {
      id: "no-guarantee",
      heading: "3. No Guarantee of Profit",
      body: (
        <>
          <p>BullionAI makes no warranties, express or implied, regarding the accuracy, completeness, timeliness, or profitability of any signal, data, or analysis. You agree that trade decisions are made at your own sole discretion and risk. BullionAI is not liable for any trading losses you incur.</p>
        </>
      ),
    },
    {
      id: "data-limitations",
      heading: "4. Data & Signal Limitations",
      body: (
        <>
          <p>Signals are generated by a rules-based engine on server-side candle data. However:</p>
          <ul>
            <li>Market data may be delayed from exchanges.</li>
            <li>The engine does not account for fundamental, news, or event-driven shocks.</li>
            <li>Signals are recomputed periodically; live conditions may differ.</li>
            <li>Past verification/accuracy statistics do not predict future performance.</li>
          </ul>
        </>
      ),
    },
    {
      id: "own-responsibility",
      heading: "5. Your Responsibility",
      body: (
        <>
          <p>You are solely responsible for all trading decisions, order placement, and risk management. You should conduct your own due diligence, use appropriate position sizing, and consider consulting a qualified, SEBI-registered financial advisor or RIA before engaging in trading.</p>
        </>
      ),
    },
    {
      id: "acceptance",
      heading: "6. Acknowledgment of Risk",
      body: (
        <>
          <p>By creating an account and using BullionAI, you acknowledge and accept that:</p>
          <ul>
            <li>You understand the risks of trading commodities and derivatives.</li>
            <li>You have the financial capacity to absorb potential losses.</li>
            <li>You are not relying on BullionAI for investment advice.</li>
            <li>You agree that BullionAI is not liable for any losses incurred from trading decisions based on our signals.</li>
          </ul>
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
            <div className="flex items-center gap-2 text-[12px] font-bold text-rose-700">
              <AlertTriangle className="h-4 w-4" /> Important
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-700">
              This Risk Disclosure is a placeholder and must be reviewed and finalized by your compliance and legal advisor before commercial launch. It does not constitute legal advice.
            </p>
          </div>
        </>
      ),
    },
  ],
};

export const REFUND_DOC: LegalDoc = {
  title: "Refund & Cancellation Policy",
  slug: "refund-policy",
  category: "Legal",
  updated: "August 28, 2026",
  lead: "This Refund & Cancellation Policy explains how refunds and cancellations work for BullionAI subscriptions. Please review it before subscribing.",
  sections: [
    {
      id: "overview",
      heading: "1. Overview",
      body: (
        <>
          <p>BullionAI offers a 14-day free trial and paid subscriptions paid via UPI. This policy sets out the terms under which you may cancel a subscription or request a refund. Because access is activated at the point of service and is granted for a fixed period, we have a limited refund framework.</p>
        </>
      ),
    },
    {
      id: "cancellation",
      heading: "2. Cancellation",
      body: (
        <>
          <p>You may cancel your BullionAI subscription at any time. Cancellation takes effect for future periods; your paid access continues until the end of the currently purchased billing period (Monthly: 1 month, Half-Yearly: 6 months, Annual: 12 months).</p>
          <p>To cancel, contact us via WhatsApp +91 79043 11778 or support@bullionai.in. Provide your registered email. We will confirm cancellation and your access end date. There is no auto-renewal, so cancellation simply means you won't be re-engaged after the period.</p>
        </>
      ),
    },
    {
      id: "refunds",
      heading: "3. Refund Eligibility",
      body: (
        <>
          <p>We offer refunds in the following limited circumstances:</p>
          <ul>
            <li><strong>Duplicate Payment:</strong> If you accidentally pay twice for the same plan, we will refund the duplicate within 5–7 business days.</li>
            <li><strong>Extended Platform Outage:</strong> If the Platform is unavailable for a sustained period (e.g., 72+ hours continuously) due to our fault, we will pro-rate a refund for the affected time.</li>
            <li><strong>Failure to Activate:</strong> If a paid subscription is not activated within 48 hours of verified payment and we fail to resolve it after reasonable attempts.</li>
          </ul>
          <p>No partial refund will be issued for unused time within a billing period, service not being used, or change of mind. All refunds are processed to the original UPI/payment source.</p>
        </>
      ),
    },
    {
      id: "non-refundable",
      heading: "4. Non-Refundable Circumstances",
      body: (
        <>
          <p>Refunds will NOT be provided in the following cases:</p>
          <ul>
            <li>You have used the service for part of the period or have accessed signals.</li>
            <li>Trading losses incurred by acting on signals (BullionAI is not an investment advisor).</li>
            <li>Account termination due to violation of our Terms of Service.</li>
            <li>Change of mind, market conditions, or dissatisfaction with signal performance.</li>
            <li>Partial-use periods (e.g., 3 of 12 months).</li>
          </ul>
        </>
      ),
    },
    {
      id: "process",
      heading: "5. How to Request a Refund",
      body: (
        <>
          <p>To request a refund:</p>
          <ul>
            <li>Contact us via WhatsApp +91 79043 11778 or support@bullionai.in with your registered email.</li>
            <li>Provide your payment reference (UPI transaction ID) and reason for the request.</li>
            <li>Our team will review and respond within 5–7 business days.</li>
            <li>Approved refunds are processed to the original source within 5–10 business days after approval.</li>
          </ul>
        </>
      ),
    },
    {
      id: "trial",
      heading: "6. Trial Period & Refunds",
      body: (
        <>
          <p>The 14-day free trial requires no payment, so no refund applies. The trial is offered as a courtesy to evaluate the Platform at no cost. After the trial ends, you may choose to subscribe to a paid plan.</p>
        </>
      ),
    },
    {
      id: "contact",
      heading: "7. Contact",
      body: (
        <>
          <p>All cancellation and refund requests are handled by our support team:</p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px]">
            <p><strong>BullionAI</strong><br />44, Queen Circle, Mahendrapuri, Chinna Tirupathi, Salem - 636008</p>
            <p className="mt-2">WhatsApp: +91 79043 11778 · Email: support@bullionai.in</p>
          </div>
        </>
      ),
    },
  ],
};