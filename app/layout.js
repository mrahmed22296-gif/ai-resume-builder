import "./globals.css";
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata = {
  title: "صانع السيرة الذاتية بالذكاء الاصطناعي | AI Resume Builder",
  description: "أنشئ سيرتك الذاتية الاحترافية باستخدام Gemini AI وحملها بصيغة PDF أو Word",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={`${inter.variable} ${plexArabic.variable}`}>
      <body className="bg-[#0a0a0c] text-zinc-200 antialiased">
        {children}
      </body>
    </html>
  );
}
