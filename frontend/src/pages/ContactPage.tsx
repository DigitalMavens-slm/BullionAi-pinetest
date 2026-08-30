import { useState } from "react";
import { Phone, MessageCircle, MapPin, Mail, Clock, Send, CheckCircle, Building2 } from "lucide-react";

const CONTACT_ADDRESS = "44, Queen Circle, Mahendrapuri, Chinna Tirupathi, Salem - 636008";
const WHATSAPP_URL = `https://wa.me/917904311778?text=${encodeURIComponent("Hi! I'd like to know more about BullionAI plans.")}`;

export function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    // Simulate form submission — wire to backend (e.g., email/WhatsApp) in production
    setTimeout(() => {
      setSending(false);
      setSubmitted(true);
    }, 1200);
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
            We're Here to Help
          </div>
          <h1 className="font-display mt-6 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Contact BullionAI
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600 max-w-2xl mx-auto">
            Questions about plans, payment, or activation? Reach out via WhatsApp, phone, email, or the form below. We respond within business hours.
          </p>
        </div>
      </section>

      {/* Quick Contact */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 transition hover:shadow-lg">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="mt-3 font-display text-[15px] font-bold">WhatsApp</div>
            <div className="mt-1 text-[12px] text-slate-600">+91 79043 11778</div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">Fastest response</div>
          </a>
          <a href="tel:+917904311778" className="rounded-2xl border border-accent/20 bg-accent/5 p-6 transition hover:shadow-lg">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white">
              <Phone className="h-5 w-5" />
            </div>
            <div className="mt-3 font-display text-[15px] font-bold">Phone</div>
            <div className="mt-1 text-[12px] text-slate-600">+91 79043 11778</div>
            <div className="text-[11px] text-accent font-semibold mt-1">Mon–Sat, 9am–6pm IST</div>
          </a>
          <a href="mailto:support@bullionai.in" className="rounded-2xl border border-blue-200 bg-blue-50/40 p-6 transition hover:shadow-lg">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Mail className="h-5 w-5" />
            </div>
            <div className="mt-3 font-display text-[15px] font-bold">Email</div>
            <div className="mt-1 text-[12px] text-slate-600">support@bullionai.in</div>
            <div className="text-[11px] text-blue-600 font-semibold mt-1">For payment screenshots</div>
          </a>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-white">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="mt-3 font-display text-[15px] font-bold">Address</div>
            <div className="mt-1 text-[12px] text-slate-600">Salem, Tamil Nadu, India</div>
            <div className="text-[11px] text-slate-400 font-semibold mt-1">View map below</div>
          </div>
        </div>
      </section>

      {/* Contact Form + Info */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold tracking-tight">Send a Message</h2>
            <p className="mt-1 text-[13px] text-slate-500">We'll get back to you within business hours.</p>

            {submitted ? (
              <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center">
                <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <CheckCircle className="h-7 w-7" />
                </div>
                <h3 className="font-display mt-4 text-lg font-bold text-emerald-800">Message Sent!</h3>
                <p className="mt-2 text-[13px] text-slate-600">
                  Thanks for reaching out. Our team will respond shortly. For urgent help, WhatsApp +91 79043 11778.
                </p>
                <button onClick={() => { setSubmitted(false); setForm({ name: "", email: "", phone: "", message: "" }); }} className="mt-4 rounded-xl border border-slate-300 px-5 py-2 text-[12px] font-semibold text-slate-700 hover:border-slate-400">
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-[12px] font-semibold text-slate-700 mb-1">Full Name</label>
                    <input id="name" type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-[12px] font-semibold text-slate-700 mb-1">Phone</label>
                    <input id="phone" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="block text-[12px] font-semibold text-slate-700 mb-1">Email Address</label>
                  <input id="email" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                </div>
                <div>
                  <label htmlFor="message" className="block text-[12px] font-semibold text-slate-700 mb-1">Message</label>
                  <textarea id="message" required rows={4} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="How can we help? For payments, include your registered email & UPI transaction ID." className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                </div>
                <button type="submit" disabled={sending} className="gold-cta flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-bold disabled:opacity-60">
                  {sending ? "Sending..." : <>Send Message <Send className="h-4 w-4" /></>}
                </button>
                <p className="text-[11px] text-slate-400 text-center">For fastest response, use WhatsApp. Include your registered email for payment queries.</p>
              </form>
            )}
          </div>

          {/* Address + Map */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy text-white">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-[17px] font-bold">BullionAI HQ</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                    BullionAI
                    <br />
                    44, Queen Circle, Mahendrapuri,
                    <br />
                    Chinna Tirupathi, Salem - 636008
                    <br />
                    Tamil Nadu, India
                  </p>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(CONTACT_ADDRESS)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-blue-600 hover:underline"
                  >
                    <MapPin className="h-4 w-4" /> Open in Google Maps
                  </a>
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-slate-100">
                <div className="flex items-center gap-2 text-[13px] text-slate-600 mb-2">
                  <Clock className="h-4 w-4 text-slate-400" /> Business Hours
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div className="rounded-lg bg-slate-50 p-2.5"><div className="font-semibold text-slate-700">Monday – Friday</div><div className="text-slate-500">9:00 AM – 6:00 PM IST</div></div>
                  <div className="rounded-lg bg-slate-50 p-2.5"><div className="font-semibold text-slate-700">Saturday</div><div className="text-slate-500">10:00 AM – 4:00 PM IST</div></div>
                  <div className="rounded-lg bg-slate-50 p-2.5"><div className="font-semibold text-slate-700">Sunday</div><div className="text-slate-500">Emergency only</div></div>
                  <div className="rounded-lg bg-slate-50 p-2.5"><div className="font-semibold text-slate-700">Market days</div><div className="text-slate-500">Extended support</div></div>
                </div>
              </div>
            </div>

            {/* Embedded Map */}
            <div className="rounded-3xl border border-slate-200 overflow-hidden">
              <iframe
                title="BullionAI location map"
                src="https://maps.google.com/maps?q=Queen%20Circle%20Mahendrapuri%20Chinna%20Tirupathi%20Salem%20636008&output=embed"
                className="w-full h-[320px] border-0"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}