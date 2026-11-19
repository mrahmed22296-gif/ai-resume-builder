import "./globals.css";

export const metadata = {
  title: "صانع السيرة الذاتية بالذكاء الاصطناعي | AI Resume Builder",
  description: "أنشئ سيرتك الذاتية الاحترافية باستخدام Gemini AI وحملها بصيغة PDF أو Word",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-50 text-slate-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
