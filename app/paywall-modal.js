"use client";

import React, { useState } from "react";
import { X, Loader2 } from "lucide-react";

// Paywall shown when the free generation is used. Mirrors the owner's
// existing Masar/calculator flow: one-time 1 KWD via WAMD, receipt over
// WhatsApp, then a single-use activation code. Validation is server-side.

const WHATSAPP_NUMBER = "96560085043";
const WAMD_QR_URL = "https://i.ibb.co/1GvzKs8r/Whats-App-Image-2026-08-06-at-4-44-31-PM-1.jpg";

const strings = {
  ar: {
    title: "انتهت المحاولة المجانية",
    body: "أول توليد ناجح كان مجانياً. للمتابعة بلا حدود، فعّل الاشتراك مقابل 1 دينار كويتي (دفعة واحدة، بدون تجديد).",
    paySteps: "1. ادفع 1 دينار عبر ومض (WAMD).\n2. أرسل صورة الإيصال عبر واتساب.\n3. ستصلك رسالة بكود التفعيل.",
    whatsapp: "إرسال الإيصال عبر واتساب",
    codePlaceholder: "أدخل كود التفعيل",
    activate: "تفعيل الاشتراك",
    activating: "جاري التفعيل...",
    invalid: "كود التفعيل غير صحيح.",
    used: "تم استخدام هذا الكود مسبقاً.",
    unavailable: "التفعيل غير متاح مؤقتاً. حاول لاحقاً.",
    success: "تم تفعيل الاشتراك بنجاح. يمكنك التوليد بلا حدود.",
    close: "إغلاق",
    receiptNote: "الدفع عبر ومض (WAMD) — امسح الرمز من تطبيقك البنكي.",
    receiptMessage: name =>
      `السلام عليكم،\nأريد تفعيل الاشتراك في موقع السيرة الذاتية.\nالمبلغ: 1 دينار\nالاسم: ${name}\n\nمرفق إيصال الدفع عبر ومض.`,
  },
  en: {
    title: "Free trial finished",
    body: "Your first successful generation was free. Continue without limits with a one-time 1 KWD activation (no renewal).",
    paySteps: "1. Pay 1 KWD via WAMD.\n2. Send the receipt photo on WhatsApp.\n3. You will receive an activation code.",
    whatsapp: "Send the receipt on WhatsApp",
    codePlaceholder: "Enter activation code",
    activate: "Activate subscription",
    activating: "Activating...",
    invalid: "Invalid activation code.",
    used: "This code was already used.",
    unavailable: "Activation is temporarily unavailable. Try later.",
    success: "Subscription activated. Unlimited generation unlocked.",
    close: "Close",
    receiptNote: "Pay via WAMD — scan the code from your banking app.",
    receiptMessage: name =>
      `Hello,\nI want to activate the resume builder subscription.\nAmount: 1 KWD\nName: ${name}\n\nWAMD payment receipt attached.`,
  },
};

export function PaywallModal({ lang, user, onClose, onRedeem }) {
  const t = strings[lang === "en" ? "en" : "ar"];
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = user?.displayName || user?.email || "";
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t.receiptMessage(name))}`;

  const submit = async () => {
    if (busy) return;
    setError("");
    const trimmed = code.trim();
    if (!trimmed) {
      setError(t.invalid);
      return;
    }
    setBusy(true);
    try {
      await onRedeem(trimmed);
      alert(t.success);
    } catch (err) {
      setError(err?.code === "CODE_USED" ? t.used : err?.code === "INVALID_CODE" ? t.invalid : t.unavailable);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="bg-white text-slate-800 max-w-sm w-full rounded-2xl p-6 shadow-2xl text-center space-y-4">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-lg text-slate-900">{t.title}</h3>
          <button type="button" onClick={onClose} aria-label={t.close} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm leading-7 text-slate-600">{t.body}</p>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
          <p className="text-xs font-bold text-slate-700 mb-2">{t.receiptNote}</p>
          <img src={WAMD_QR_URL} alt="WAMD payment QR" className="w-44 max-w-full mx-auto rounded-lg border border-slate-200" />
        </div>
        <p className="text-[11px] leading-6 text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 whitespace-pre-line text-start">
          {t.paySteps}
        </p>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-[#25D366] hover:bg-[#1ebc58] text-white rounded-xl py-3 text-sm font-bold transition"
        >
          {t.whatsapp}
        </a>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder={t.codePlaceholder}
          autoComplete="off"
          autoCapitalize="characters"
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-base tracking-widest focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 outline-none"
          dir="ltr"
        />
        {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-bold transition flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {busy ? t.activating : t.activate}
        </button>
      </div>
    </div>
  );
}

export function SignInPrompt({ lang, onSignIn, onSignInRedirect, onClose }) {
  const isArabic = lang !== "en";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="bg-white text-slate-800 max-w-sm w-full rounded-2xl p-6 shadow-2xl text-center space-y-4">
        <h3 className="font-bold text-lg text-slate-900">{isArabic ? "سجّل الدخول أولاً" : "Sign in first"}</h3>
        <p className="text-sm leading-7 text-slate-600">
          {isArabic
            ? "تسجّل الدخول بحساب Google أولاً، ثم تتوفر لك محاولة توليد مجانية قبل الاشتراك."
            : "Sign in with Google first, then you get one free generation before subscribing."}
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-bold transition"
        >
          {isArabic ? "تسجيل الدخول بحساب Google" : "Sign in with Google"}
        </button>
        {onSignInRedirect ? (
          <button type="button" onClick={onSignInRedirect} className="text-xs text-slate-500 underline">
            {isArabic
              ? "النافذة المنبثقة لا تفتح؟ أكمل تسجيل الدخول من هذه الصفحة"
              : "Popup not opening? Continue sign-in from this page"}
          </button>
        ) : null}
        <button type="button" onClick={onClose} className="text-xs text-slate-500 underline block mx-auto">
          {isArabic ? "إغلاق" : "Close"}
        </button>
      </div>
    </div>
  );
}
