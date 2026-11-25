"use client";

import React, { useState } from "react";

const WA_LINK =
  "https://wa.me/96560085043?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%20%D8%A3.%20%D8%A3%D8%AD%D9%85%D8%AF%20%D8%A3%D8%B1%D8%BA%D8%A8%20%D9%81%D9%8A%20%D8%A7%D8%B3%D8%AA%D8%B4%D8%A7%D8%B1%D8%A9%20%D9%85%D8%A7%D9%84%D9%8A%D8%A9";

const itemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #dbeafe",
  background: "#f8fafc",
  textDecoration: "none",
  color: "#0c2942",
  marginTop: 10
};

export default function ContactWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <style>{`
        @keyframes cw-pulse {
          0% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.5); }
          70% { box-shadow: 0 0 0 16px rgba(37, 211, 102, 0); }
          100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0); }
        }
        .cw-float-btn:hover { transform: scale(1.08); }
        .cw-tooltip { opacity: 0; transition: opacity 0.2s ease; }
        .cw-float-wrap:hover .cw-tooltip { opacity: 1; }
        .cw-item:hover { background: #f0f9ff; border-color: #7dd3fc; }
      `}</style>

      <div
        className="cw-float-wrap"
        dir="rtl"
        style={{
          position: "fixed",
          bottom: 30,
          left: 30,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          fontFamily: "Tajawal, sans-serif"
        }}
      >
        <button
          type="button"
          className="cw-float-btn"
          aria-label="تواصل معنا"
          onClick={() => setOpen(true)}
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #25D366, #128C7E)",
            color: "#fff",
            border: "none",
            boxShadow: "0 8px 24px rgba(37, 211, 102, 0.45)",
            cursor: "pointer",
            fontSize: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "cw-pulse 2.5s infinite"
          }}
        >
          💬
        </button>
        <span
          className="cw-tooltip"
          style={{ fontSize: 12, fontWeight: 700, color: "#0c2942", background: "#fff", border: "1px solid #dbeafe", borderRadius: 8, padding: "2px 10px" }}
        >
          تواصل معنا
        </span>
      </div>

      {open && (
        <div
          dir="rtl"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(13, 18, 38, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            fontFamily: "Tajawal, sans-serif"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 380,
              background: "#fff",
              borderRadius: 24,
              padding: 24,
              border: "1px solid #dbeafe",
              boxShadow: "0 24px 60px rgba(12, 41, 66, 0.2)",
              position: "relative"
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق"
              style={{ position: "absolute", top: 14, left: 14, background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#5b7285" }}
            >
              ✕
            </button>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0c2942" }}>📞 تواصل معنا</h3>
            <p style={{ margin: "6px 0 8px", fontSize: 12, color: "#5b7285" }}>أهلاً بك! يمكنك التواصل معنا عبر أي من القنوات التالية:</p>

            <a href={WA_LINK} target="_blank" rel="noreferrer" className="cw-item" style={itemStyle}>
              <span style={{ fontSize: 22 }}>💬</span>
              <span>
                <span style={{ display: "block", fontSize: 12, color: "#5b7285" }}>واتساب</span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }} dir="ltr">+965 60085043</span>
              </span>
            </a>

            <a href="tel:+96560085043" className="cw-item" style={itemStyle}>
              <span style={{ fontSize: 22 }}>📱</span>
              <span>
                <span style={{ display: "block", fontSize: 12, color: "#5b7285" }}>اتصال</span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }} dir="ltr">+965 60085043</span>
              </span>
            </a>

            <a href="mailto:mr.ahmed22296@gmail.com" className="cw-item" style={itemStyle}>
              <span style={{ fontSize: 22 }}>✉️</span>
              <span>
                <span style={{ display: "block", fontSize: 12, color: "#5b7285" }}>البريد الإلكتروني</span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }} dir="ltr">mr.ahmed22296@gmail.com</span>
              </span>
            </a>

            <a href="tel:+201201487209" className="cw-item" style={itemStyle}>
              <span style={{ fontSize: 22 }}>📞</span>
              <span>
                <span style={{ display: "block", fontSize: 12, color: "#5b7285" }}>اتصال (مصر)</span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }} dir="ltr">+20 1201487209</span>
              </span>
            </a>
          </div>
        </div>
      )}
    </>
  );
}
