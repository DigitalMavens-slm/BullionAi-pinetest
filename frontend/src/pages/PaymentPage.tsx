import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowLeft,
  CheckCircle,
  Copy,
  MessageCircle,
  Phone,
  QrCode,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useSeo } from "../lib/useSeo";

const UPI_ID = "9842669157@ybl";
const UPI_NAME = "K MOHAMMED SHERIFF";
const WHATSAPP_NUMBER = "79043111778";
const WHATSAPP_DISPLAY = "+91 79043 11778";

const PLANS = [
  { id: "monthly", name: "Monthly", price: 2500, period: "per month", note: "Flexible" },
  { id: "half-yearly", name: "Half-Yearly", price: 10000, period: "per 6 months", note: "Save ₹5,000 vs monthly" },
  { id: "yearly", name: "Annual", price: 18000, period: "per year", note: "Best value — save ₹12,000 vs monthly" },
];

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export function PaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  useSeo({
    title: "Subscribe — BullionAI | Pay via UPI & Activate Your Plan",
    description: "Subscribe to BullionAI via UPI. Scan the QR or pay to 9842669157@ybl, then WhatsApp your payment proof to +91 79043 11778 for instant activation.",
  });
  const planParam = searchParams.get("plan");

  const initialPlan = useMemo(() => {
    if (!planParam) return "yearly";
    const found = PLANS.find(p => p.id === planParam);
    return found ? found.id : "yearly";
  }, [planParam]);

  const [planId, setPlanId] = useState(initialPlan);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);

  const plan = PLANS.find(p => p.id === planId)!;

  const upiLink = useMemo(() => {
    const params = new URLSearchParams({
      pa: UPI_ID,
      pn: UPI_NAME,
      am: String(plan.price),
      cu: "INR",
      tn: `BullionAI ${plan.name} subscription`,
    });
    return `upi://pay?${params.toString()}`;
  }, [plan]);

  const whatsappVerifyLink = useMemo(() => {
    const msg =
      `Hi BullionAI, I've paid for the ${plan.name} plan (${inr(plan.price)}).\n` +
      `UPI ID: ${UPI_ID}\n` +
      `Plan: ${plan.name} — ${plan.period}\n\n` +
      `Here is my payment screenshot & details. My registered email is: `;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  }, [plan]);

  useEffect(() => {
    setCopied(false);
    setPaid(false);
  }, [planId]);

  async function copyUpi() {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-16">
        <button
          onClick={() => navigate(-1)}
          className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
            <Wallet className="h-3.5 w-3.5" /> Secure UPI Payment
          </div>
          <h1 className="font-display mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Pay via UPI to Activate
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-600 max-w-xl mx-auto">
            Scan the QR with any UPI app (PhonePe, GPay, Paytm, BHIM) or pay to the UPI ID below. After payment, share your screenshot on WhatsApp and your plan is activated within minutes.
          </p>
        </div>

        {/* Plan selector */}
        <div className="mx-auto max-w-3xl mb-8">
          <div className="grid gap-3 sm:grid-cols-3">
            {PLANS.map(p => {
              const active = p.id === planId;
              return (
                <button
                  key={p.id}
                  onClick={() => setPlanId(p.id)}
                  className={[
                    "relative rounded-2xl border p-4 text-left transition",
                    active
                      ? "border-accent bg-white shadow-[0_12px_30px_-12px_rgba(29,78,216,0.35)]"
                      : "border-slate-200 bg-white hover:border-slate-300",
                  ].join(" ")}
                >
                  {p.id === "yearly" && (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      Best Value
                    </span>
                  )}
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{p.name}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-display text-[22px] font-bold text-slate-900">{inr(p.price)}</span>
                    <span className="text-[10px] text-slate-400">{p.period}</span>
                  </div>
                  <div className="mt-1 text-[10px] font-medium text-slate-500">{p.note}</div>
                  {active && <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-accent" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* QR + UPI */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-[17px] font-bold text-slate-900">Scan &amp; Pay</h2>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">UPI</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
                <QRCodeCanvas
                  value={upiLink}
                  size={220}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#0A2540"
                  includeMargin={false}
                />
              </div>
              <div className="mt-4 text-center">
                <div className="text-[12px] font-semibold text-slate-500">Pay to</div>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span className="font-mono text-[16px] font-bold text-slate-900">{UPI_ID}</span>
                  <button
                    onClick={copyUpi}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50"
                    aria-label="Copy UPI ID"
                  >
                    {copied ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="mt-1 text-[11px] font-medium text-slate-400">{UPI_NAME}</div>
              </div>
            </div>

            <button
              onClick={() => window.open(upiLink, "_blank", "noopener")}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/5 py-2.5 text-[13px] font-bold text-accent transition hover:bg-accent/10"
            >
              <QrCode className="h-4 w-4" /> Open UPI App
            </button>

            <div className="mt-5 rounded-xl bg-slate-50 p-3.5 text-[11px] leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-700">Amount due:</span>{" "}
              <span className="font-mono font-bold text-slate-900">{inr(plan.price)}</span> · {plan.name} ({plan.period})
              <div className="mt-1">Use any UPI app: PhonePe, Google Pay, Paytm, BHIM, or your bank's app.</div>
            </div>
          </div>

          {/* Steps + WhatsApp */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="font-display text-[17px] font-bold text-slate-900 mb-5">How activation works</h2>
              <ol className="space-y-4">
                {[
                  { title: "Pay the amount", desc: `Scan the QR (or pay to ${UPI_ID}) for ${inr(plan.price)}. Note your UPI transaction ID.` },
                  { title: "Send proof on WhatsApp", desc: `Share your payment screenshot + registered email on WhatsApp ${WHATSAPP_DISPLAY}.` },
                  { title: "Get activated", desc: "Our team verifies and sets your plan validity — usually within minutes (Mon–Sat, 9am–6pm IST)." },
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="brand-gold-dot mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-slate-800">{step.title}</div>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <button
                onClick={() => {
                  setPaid(true);
                  window.open(whatsappVerifyLink, "_blank", "noopener");
                }}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-[13px] font-bold text-white transition hover:brightness-105"
              >
                <MessageCircle className="h-4 w-4" /> I've Paid — Send Details on WhatsApp
              </button>
              <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <Phone className="h-3.5 w-3.5" /> WhatsApp {WHATSAPP_DISPLAY} · {plan.name}
              </div>

              {paid && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] font-medium text-emerald-700">
                  <CheckCircle className="h-4 w-4 shrink-0" /> Payment message opened. Please attach your screenshot &amp; email in WhatsApp.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-[12px] font-bold text-slate-700">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Why this is secure
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
                Payments go directly to our verified UPI account via RBI-regulated UPI rails. BullionAI never stores your card or bank details. Your subscription activates only after manual verification.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
              <p className="text-[12px] text-slate-500">
                Prefer to register first?{" "}
                <Link to="/register" className="font-semibold text-accent hover:underline">Create a free account</Link>{" "}
                or{" "}
                <Link to="/pricing" className="font-semibold text-accent hover:underline">view all plans</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}