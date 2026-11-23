import "./globals.css";
import { Tajawal } from "next/font/google";

// Unified site design: Tajawal everywhere, matching the end-of-service calculator.
const tajawal = Tajawal({
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata = {
  title: "صانع السيرة الذاتية بالذكاء الاصطناعي | AI Resume Builder",
  description: "أنشئ سيرتك الذاتية الاحترافية باستخدام Gemini AI وحملها بصيغة PDF أو Word",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="bg-[#f0f9ff] text-slate-800 antialiased">
        {children}
      </body>
    </html>
  );
}
