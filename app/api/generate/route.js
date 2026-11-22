import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const FALLBACK_MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.8-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.8-pro",
];

export async function POST(req) {
  try {
    const { prompt, type, language } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "مفتاح Gemini API غير موجود في إعدادات الخادم." },
        { status: 500 }
      );
    }

    const langInstruction =
      language === "ar"
        ? "اكتب النتيجة باللغة العربية الفصحى المهنية."
        : "Write the result in professional corporate English.";

    let systemPrompt = "";
    if (type === "summary") {
      systemPrompt = `أنت خبير توظيف عالمي. قم بصياغة نبذة مهنية (Professional Summary) قوية ومختصرة (3-4 أسطر) للسيرة الذاتية بناءً على المعلومات التالية، مع إبراز القيمة المضافة والمهارات الأساسية بدون مقدمات أو علامات تنسيق إضافية: "${prompt}". ${langInstruction}`;
    } else if (type === "experience") {
      systemPrompt = `أنت خبير كتابة سير ذاتية متوافقة مع أنظمة ATS. حوّل الوصف الوظيفي التالي إلى 3-4 نقاط إنجاز احترافية تبدأ بأفعال قوية وتركز على النتائج القابلة للقياس (استخدم الرمز • لكل نقطة بدون مقدمات): "${prompt}". ${langInstruction}`;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    let lastError = null;

    for (const modelName of FALLBACK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({ result: text.trim() });
      } catch (err) {
        lastError = err;
        const msg = err?.message || "";
        // إذا كان النموذج مزدحمًا (503) أو غير متوفر (404)، انتقل للنموذج التالي تلقائيًا
        if (msg.includes("503") || msg.includes("404") || msg.includes("overloaded")) {
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json(
      { error: error?.message || "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي." },
      { status: 500 }
    );
  }
}
