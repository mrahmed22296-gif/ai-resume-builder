export function generationErrorMessage(code, language) {
  const ar = language === "ar";
  const messages = {
    AI_CONFIGURATION: ar
      ? "خدمة Gemini تحتاج ضبط إعدادات الخادم. إعادة المحاولة لن تصلح الإعدادات. بياناتك لم تتغير."
      : "Gemini needs a server configuration fix. Retrying will not fix the settings. Your data has not changed.",
    AI_RATE_LIMIT: ar
      ? "تم بلوغ حد طلبات Gemini. حاول لاحقاً. بياناتك لم تتغير."
      : "Gemini's request limit was reached. Try later. Your data has not changed.",
    AI_TIMEOUT: ar
      ? "انتهت مهلة Gemini. حاول لاحقاً. بياناتك لم تتغير."
      : "Gemini timed out. Try later. Your data has not changed.",
    AI_INCOMPLETE: ar
      ? "لم يُرجع Gemini نصاً مكتملاً يمكن استخدامه. جرّب وصفاً مختلفاً. بياناتك لم تتغير."
      : "Gemini did not return complete text to use. Try a different description. Your data has not changed."
  };
  return messages[code] || (ar
    ? "تعذّر إنشاء النص. حاول مرة أخرى لاحقاً، بياناتك لم تتغير."
    : "Could not generate text. Try again later. Your data has not changed.");
}
