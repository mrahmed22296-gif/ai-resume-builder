"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb, getGoogleProvider } from "./firebase-client";

const SITE_ID = "ai-resume-builder";
const FREE_USES = 1;
const WA_NUMBER = "96560085043";
const QR_URL = "https://i.ibb.co/1GvzKs8r/Whats-App-Image-2026-08-06-at-4-44-31-PM-1.jpg";
const VALID_CODES = [
  "RESUME-2026-A1B2",
  "RESUME-2026-C3D4",
  "RESUME-2026-E5F6",
  "RESUME-2026-G7H8",
  "RESUME-2026-I9J0",
  "WAMD-1001",
  "WAMD-1002",
  "WAMD-1003",
  "WAMD-1004",
  "WAMD-1005"
];

const AccessContext = createContext(null);

export function useAccess() {
  return useContext(AccessContext);
}

function subKey(uid) {
  return `resume_subscribed_${uid}`;
}
function countKey(uid) {
  return `resume_use_count_${uid}`;
}
function phoneSkipKey(uid) {
  return `resume_phone_skip_${uid}`;
}

const colors = {
  ink: "#0c2942",
  primary: "#0ea5e9",
  primaryDark: "#0369a1",
  deep: "#1e3a8a",
  accent: "#f97316",
  paper: "#f0f9ff",
  line: "#dbeafe",
  muted: "#5b7285"
};

const cardStyle = {
  width: "100%",
  maxWidth: 430,
  background: "#ffffff",
  border: `1px solid ${colors.line}`,
  borderRadius: 28,
  padding: 28,
  boxShadow: "0 24px 60px rgba(12, 41, 66, 0.12)",
  textAlign: "center"
};

const primaryButton = {
  width: "100%",
  minHeight: 48,
  borderRadius: 14,
  border: `1px solid ${colors.line}`,
  background: "#ffffff",
  color: "#374151",
  fontWeight: 700,
  fontSize: 14,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
  cursor: "pointer",
  fontFamily: "inherit"
};

export function AuthGate({ children }) {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [useCount, setUseCount] = useState(0);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeMessage, setCodeMessage] = useState("");
  const [needsPhone, setNeedsPhone] = useState(false);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const auth = getFirebaseAuth();
    getRedirectResult(auth).catch(() => {});
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setStatus("signedOut");
        return;
      }
      setSubscribed(typeof window !== "undefined" && window.localStorage.getItem(subKey(u.uid)) === "true");
      setUseCount(Number(window.localStorage.getItem(countKey(u.uid)) || 0));
      // Store the visitor record (email, name, optional phone) in Firestore.
      // Fails silently when Firestore is not enabled yet; sign-in still works.
      try {
        const db = getFirebaseDb();
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            email: u.email || "",
            name: u.displayName || "",
            phone: "",
            sites: [SITE_ID],
            createdAt: serverTimestamp()
          });
          if (!window.localStorage.getItem(phoneSkipKey(u.uid))) setNeedsPhone(true);
        } else {
          await setDoc(
            ref,
            { email: u.email || "", name: u.displayName || "", sites: arrayUnion(SITE_ID), lastSeenAt: serverTimestamp() },
            { merge: true }
          );
          const data = snap.data() || {};
          if (!data.phone && !window.localStorage.getItem(phoneSkipKey(u.uid))) setNeedsPhone(true);
        }
      } catch (e) {
        if (!window.localStorage.getItem(phoneSkipKey(u.uid))) setNeedsPhone(true);
      }
      setStatus("signedIn");
    });
    return () => unsub();
  }, []);

  const loginWithGoogle = async () => {
    const auth = getFirebaseAuth();
    const provider = getGoogleProvider();
    setLoginError("");
    setBusy(true);
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      if (error?.code === "auth/popup-blocked") {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (e2) {
          setLoginError("تعذر فتح صفحة تسجيل الدخول. جرّب متصفحاً آخر.");
        }
      } else if (error?.code === "auth/unauthorized-domain") {
        setLoginError("هذا الرابط التجريبي غير مفعّل بعد لتسجيل الدخول. جاري تفعيله.");
      } else if (error?.code !== "auth/popup-closed-by-user" && error?.code !== "auth/cancelled-popup-request") {
        setLoginError("حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.");
      }
    } finally {
      setBusy(false);
    }
  };

  const savePhone = async () => {
    const cleaned = phone.trim();
    if (user && cleaned) {
      try {
        const db = getFirebaseDb();
        await setDoc(doc(db, "users", user.uid), { phone: cleaned }, { merge: true });
      } catch (e) {}
    }
    if (user) window.localStorage.setItem(phoneSkipKey(user.uid), "1");
    setNeedsPhone(false);
  };

  const skipPhone = () => {
    if (user) window.localStorage.setItem(phoneSkipKey(user.uid), "1");
    setNeedsPhone(false);
  };

  const tryConsume = () => {
    if (!user) return false;
    if (subscribed) return true;
    const current = Number(window.localStorage.getItem(countKey(user.uid)) || 0);
    if (current < FREE_USES) {
      window.localStorage.setItem(countKey(user.uid), String(current + 1));
      setUseCount(current + 1);
      return true;
    }
    setPaywallOpen(true);
    return false;
  };

  const activateCode = async () => {
    const value = code.trim().toUpperCase();
    if (!value) {
      setCodeMessage("أدخل كود التفعيل أولاً.");
      return;
    }
    if (!VALID_CODES.includes(value)) {
      setCodeMessage("الكود غير صحيح. تأكد من الكود وأعد المحاولة.");
      return;
    }
    window.localStorage.setItem(subKey(user.uid), "true");
    setSubscribed(true);
    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, "users", user.uid), { subscriptions: arrayUnion(SITE_ID) }, { merge: true });
    } catch (e) {}
    setCodeMessage("تم تفعيل الاشتراك بنجاح.");
    setTimeout(() => setPaywallOpen(false), 1500);
  };

  const contactWhatsApp = () => {
    const name = user?.displayName || "";
    const email = user?.email || "";
    const text = encodeURIComponent(
      `السلام عليكم،\nأريد تفعيل الاشتراك في صانع السيرة الذاتية.\nالمبلغ: 1 دينار\nالاسم: ${name}\nالإيميل: ${email}\n\nمرفق إيصال الدفع عبر ومض.`
    );
    window.open(`https://wa.me/${WA_NUMBER}?text=${text}`, "_blank");
  };

  const value = useMemo(
    () => ({
      user,
      subscribed,
      usesLeft: Math.max(0, FREE_USES - useCount),
      tryConsume,
      openPaywall: () => setPaywallOpen(true),
      signOutUser: () => signOut(getFirebaseAuth())
    }),
    [user, subscribed, useCount]
  );

  if (status === "loading") {
    return (
      <div dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: colors.paper, fontFamily: "Tajawal, sans-serif", color: colors.muted }}>
        جاري التحميل...
      </div>
    );
  }

  if (status === "signedOut") {
    return (
      <div dir="rtl" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: `radial-gradient(ellipse 80% 50% at 50% -20%, rgba(14,165,233,0.12), transparent), ${colors.paper}`, fontFamily: "Tajawal, sans-serif" }}>
        <div style={cardStyle}>
          <div style={{ width: 56, height: 56, margin: "0 auto 12px", background: colors.ink, color: "#fff", borderRadius: 16, display: "grid", placeItems: "center", fontSize: 24, fontWeight: 900 }}>
            س
          </div>
          <p style={{ color: colors.primaryDark, fontSize: 12, fontWeight: 700, margin: 0 }}>مدعوم بواسطة Gemini AI</p>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: "8px 0 12px", color: colors.ink }}>سيرتك الذاتية الاحترافية تبدأ هنا</h1>
          <p style={{ fontSize: 14, color: colors.muted, lineHeight: 1.9, margin: "0 0 24px" }}>
            أنشئ سيرتك الذاتية بالعربية أو الإنجليزية، وحسّن صياغتها بالذكاء الاصطناعي، ثم حمّلها Word أو PDF.
          </p>
          <button type="button" onClick={loginWithGoogle} disabled={busy} style={{ ...primaryButton, opacity: busy ? 0.6 : 1 }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #ef4444 50%, #facc15)" }}></span>
            تسجيل الدخول بواسطة Google
          </button>
          <p style={{ marginTop: 16, fontSize: 12, lineHeight: 1.8, color: colors.muted }}>
            تسجّل الدخول أولاً، ثم تتوفر لك محاولة مجانية قبل الاشتراك.
          </p>
          <p style={{ marginTop: 8, fontSize: 11, lineHeight: 1.8, color: "#94a3b8" }}>
            بتسجيل الدخول توافق على حفظ بياناتك الأساسية (الاسم والإيميل ورقم الهاتف إن أدخلته) لدى مالك الموقع لغرض إدارة الاشتراك والتواصل.
          </p>
          {loginError && <p style={{ marginTop: 12, fontSize: 12, color: "#dc2626", fontWeight: 700 }}>{loginError}</p>}
        </div>
      </div>
    );
  }

  return (
    <AccessContext.Provider value={value}>
      {children}

      {needsPhone && (
        <div dir="rtl" style={{ position: "fixed", inset: 0, background: "rgba(13,18,38,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 99999, fontFamily: "Tajawal, sans-serif" }}>
          <div style={cardStyle}>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px", color: colors.ink }}>رقم هاتفك (اختياري)</h2>
            <p style={{ fontSize: 13, color: colors.muted, lineHeight: 1.9, margin: "0 0 16px" }}>
              يُستخدم فقط للتواصل معك بخصوص تفعيل الاشتراك.
            </p>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="مثال: 60085043"
              style={{ width: "100%", textAlign: "center", border: `1px solid ${colors.line}`, borderRadius: 12, padding: "12px 16px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
            <button type="button" onClick={savePhone} style={{ ...primaryButton, marginTop: 12, background: colors.ink, color: "#fff", border: "none" }}>
              حفظ
            </button>
            <button type="button" onClick={skipPhone} style={{ marginTop: 12, background: "none", border: "none", fontSize: 12, color: colors.muted, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
              تخطي الآن
            </button>
          </div>
        </div>
      )}

      {paywallOpen && (
        <div dir="rtl" style={{ position: "fixed", inset: 0, background: "rgba(13,18,38,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 99999, fontFamily: "Tajawal, sans-serif", overflowY: "auto" }}>
          <div style={{ ...cardStyle, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ width: 56, height: 56, margin: "0 auto 12px", background: colors.accent, color: "#fff", borderRadius: 16, display: "grid", placeItems: "center", fontSize: 20, fontWeight: 900 }}>
              د
            </div>
            <p style={{ color: colors.primaryDark, fontSize: 12, fontWeight: 700, margin: 0 }}>اشتراك صانع السيرة الذاتية</p>
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: "8px 0", color: colors.ink }}>انتهت المحاولة المجانية</h2>
            <p style={{ fontSize: 14, color: colors.muted, lineHeight: 1.9, margin: "0 0 16px" }}>
              اشترك مقابل <strong style={{ color: colors.accent }}>1 دينار فقط</strong> لاستخدام الذكاء الاصطناعي بلا حدود.
            </p>
            <div style={{ background: colors.paper, borderRadius: 16, padding: 16, border: `1px solid ${colors.line}` }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.ink }}>الدفع عبر ومض (WAMD)</p>
              <img src={QR_URL} alt="رمز QR للدفع عبر ومض" style={{ width: 200, maxWidth: "100%", margin: "12px auto", display: "block", borderRadius: 12, border: `1px solid ${colors.line}` }} />
              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.8, color: colors.muted }}>
                امسح رمز QR من تطبيق التمويل أون لاين أو أي تطبيق يدعم ومض.
              </p>
            </div>
            <div style={{ marginTop: 16, textAlign: "right", background: "#ffedd5", border: "1px solid #fdba74", borderRadius: 12, padding: 12, fontSize: 11, lineHeight: 1.9, color: "#9a3412" }}>
              <strong>خطوات التفعيل:</strong>
              <br />1. ادفع 1 دينار عبر ومض.
              <br />2. خذ صورة للإيصال وأرسلها عبر واتساب.
              <br />3. ستصلك رسالة بكود التفعيل.
            </div>
            <button type="button" onClick={contactWhatsApp} style={{ ...primaryButton, marginTop: 16, background: "#25D366", color: "#fff", border: "none" }}>
              إرسال إيصال الدفع على واتساب
            </button>
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${colors.line}` }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.ink }}>لديك كود تفعيل؟</p>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="أدخل كود التفعيل"
                style={{ width: "100%", marginTop: 12, textAlign: "center", textTransform: "uppercase", border: `1px solid ${colors.line}`, borderRadius: 12, padding: "12px 16px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              />
              <button type="button" onClick={activateCode} style={{ ...primaryButton, marginTop: 8, background: colors.ink, color: "#fff", border: "none" }}>
                تفعيل الاشتراك
              </button>
              {codeMessage && <p style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: codeMessage.includes("بنجاح") ? "#15803d" : "#dc2626" }}>{codeMessage}</p>}
            </div>
            <button type="button" onClick={() => setPaywallOpen(false)} style={{ marginTop: 16, background: "none", border: "none", fontSize: 12, color: colors.muted, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
              العودة لاحقاً
            </button>
          </div>
        </div>
      )}
    </AccessContext.Provider>
  );
}
