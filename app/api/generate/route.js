import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const langInstruction = language === "ar" 
      ? "اكتب النتيجة باللغة العربية الفصحى المهنية." 
      : "Write the result in professional corporate English.";

    let systemPrompt = "";
    if (type === "summary") {
      systemPrompt = `أنت خبير توظيف عالمي. قم بصياغة نبذة مهنية (Professional Summary) قوية ومختصرة (3-4 أسطر) للسيرة الذاتية بناءً على المعلومات التالية، مع إبراز القيمة المضافة والمهارات الأساسية بدون مقدمات أو علامات تنسيق إضافية: "${prompt}". ${langInstruction}`;
    } else if (type === "experience") {
      systemPrompt = `أنت خبير كتابة سير ذاتية متوافقة مع أنظمة ATS. حوّل الوصف الوظيفي التالي إلى 3-4 نقاط إنجاز احترافية تبدأ بأفعال قوية وتركز على النتائج القابلة للقياس (استخدم الرمز • لكل نقطة بدون مقدمات): "${prompt}". ${langInstruction}`;
    }

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ result: text.trim() });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي." },
      { status: 500 }
    );
  }
}
