"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Download, FileText, Plus, Trash2, Globe, Loader2 } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import { generationErrorMessage } from "./generation-errors.mjs";
import { AuthGate, useAccess } from "./auth-gate";
import ContactWidget from "./contact-widget";

function ResumeBuilderInner() {
  const access = useAccess();
  const [lang, setLang] = useState("ar");
  const [template, setTemplate] = useState("classic");
  const templateThemes = {
    classic: { ink: "0F172A", accent: "2563EB", centered: true, font: "Arial" },
    modern: { ink: "123C46", accent: "087F8C", centered: false, font: "Arial" },
    executive: { ink: "292536", accent: "6D597A", centered: true, font: "Georgia" }
  };
  const [loadingField, setLoadingField] = useState(null);
  const aiRequestInFlight = useRef(false);
  const generatedFields = useRef(new Set());
  const translationCache = useRef(new Map());
  const labels = {
  "ar": {
    "poweredBy": "مدعوم بواسطة Gemini AI",
    "downloadWord": "تحميل Word",
    "downloadPdf": "تحميل PDF",
    "personal": "المعلومات الشخصية",
    "fullName": "الاسم الكامل",
    "jobTitle": "المسمى الوظيفي",
    "email": "البريد الإلكتروني",
    "phone": "رقم الهاتف",
    "location": "المدينة / الدولة",
    "summary": "النبذة المهنية",
    "draft": "صياغة بـ Gemini",
    "summaryHint": "اكتب نبذة مختصرة أو كلمات مفتاحية وسيقوم Gemini بصياغتها...",
    "experienceHeading": "الخبرات العملية",
    "addExperience": "إضافة خبرة",
    "company": "اسم الشركة",
    "period": "الفترة (مثال: 2021 - 2024)",
    "improve": "تحسين المهام بـ Gemini",
    "descriptionHint": "اكتب مهامك باختصار وسيحولها Gemini إلى نقاط إنجاز احترافية...",
    "educationSkills": "المؤهلات العلمية والمهارات",
    "addEducation": "إضافة مؤهل علمي",
    "removeEducation": "حذف المؤهل",
    "degree": "الدرجة العلمية",
    "institution": "الجامعة / المؤسسة",
    "year": "سنة التخرج",
    "skillsHint": "المهارات (افصل بينها بفاصلة)",
    "experience": "خبرة"
  },
  "en": {
    "poweredBy": "Powered by Gemini AI",
    "downloadWord": "Download Word",
    "downloadPdf": "Download PDF",
    "personal": "Personal information",
    "fullName": "Full name",
    "jobTitle": "Job title",
    "email": "Email address",
    "phone": "Phone number",
    "location": "City / Country",
    "summary": "Professional summary",
    "draft": "Draft with Gemini",
    "summaryHint": "Enter a short summary or keywords for Gemini to refine...",
    "experienceHeading": "Work experience",
    "addExperience": "Add experience",
    "company": "Company name",
    "period": "Period (e.g. 2021 - 2024)",
    "improve": "Improve with Gemini",
    "descriptionHint": "Describe your duties for Gemini to turn into professional achievement points...",
    "educationSkills": "Education and skills",
    "addEducation": "Add educational qualification",
    "removeEducation": "Remove qualification",
    "degree": "Degree",
    "institution": "University / Institution",
    "year": "Graduation year",
    "skillsHint": "Skills (comma separated)",
    "experience": "Experience"
  }
};
  const t = labels[lang];
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);


 const [resume, setResume] = useState({
    fullName: "",
    jobTitle: "",
    email: "",
    phone: "",
    location: "",
    summary: "",
    experiences: [
      {
        id: 1,
        role: "",
        company: "",
        period: "",
        description: ""
      }
    ],
    education: [
      {
        id: 1,
        degree: "",
        institution: "",
        year: ""
      }
    ],
    skills: ""
  });
  const latestForm = useRef({ resume, lang });
  latestForm.current = { resume, lang };

  // استدعاء Gemini AI لتحسين النصوص
  const enhanceWithAI = async (text, type, expId = null) => {
    const isArabic = lang === "ar";
    if (!text.trim()) {
      alert(isArabic ? "اكتب المسمى الوظيفي أو وصفاً مختصراً أولاً." : "Enter a job title or a short description first.");
      return;
    }
    if (text.trim().length > 5000) {
      alert(isArabic ? "اختصر النص إلى 5000 حرف أو أقل ثم حاول مرة أخرى." : "Shorten the text to 5000 characters or fewer, then try again.");
      return;
    }
    if (aiRequestInFlight.current) return;
    if (access && !access.tryConsume()) return;
    aiRequestInFlight.current = true;
    setLoadingField(expId !== null ? `exp-${expId}` : type);

    const requestLanguage = lang;
    const requestPrompt = text.trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 65000);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text.trim(), type, language: lang })
      });
      const data = await res.json();
      if (!res.ok || typeof data.result !== "string" || !data.result.trim()) {
        const error = new Error("Invalid AI response");
        error.code = data?.code;
        throw error;
      }
      const result = data.result.trim();
      const latest = latestForm.current;
      const currentExperience = latest.resume.experiences.find(exp => exp.id === expId);
      const currentPrompt = type === "summary"
        ? [latest.resume.jobTitle, latest.resume.summary]
        : currentExperience ? [currentExperience.role, currentExperience.company, currentExperience.description] : null;
      if (latest.lang !== requestLanguage || !currentPrompt ||
          currentPrompt.map(value => value.trim()).filter(Boolean).join(" - ") !== requestPrompt) {
        alert(latest.lang === "ar"
          ? "لم يُطبّق النص لأنك عدّلت البيانات أو اللغة أثناء الانتظار. تعديلاتك محفوظة؛ يمكنك المحاولة مجدداً."
          : "The result was not applied because you edited the source text or language while waiting. Your edits are safe; you can try again.");
        return;
      }
      generatedFields.current.add(type === "summary" ? "summary" : `exp-${expId}`);
      setResume(current => {
        if (type === "summary") return { ...current, summary: result };
        if (type === "experience" && expId !== null) {
          return { ...current, experiences: current.experiences.map(exp =>
            exp.id === expId ? { ...exp, description: result } : exp
          ) };
        }
        return current;
      });
    } catch (error) {
      alert(generationErrorMessage(error?.name === "AbortError" ? "AI_TIMEOUT" : error?.code, latestForm.current.lang));
    } finally {
      clearTimeout(timeout);
      aiRequestInFlight.current = false;
      setLoadingField(null);
    }
  };

  const switchLanguage = async () => {
    if (aiRequestInFlight.current) return;
    const sourceLanguage = lang;
    const targetLanguage = lang === "ar" ? "en" : "ar";
    const sourceResume = resume;
    const fields = [];
    if (generatedFields.current.has("summary") && resume.summary.trim()) fields.push({ key: "summary", text: resume.summary });
    for (const exp of resume.experiences) {
      if (generatedFields.current.has(`exp-${exp.id}`) && exp.description.trim()) fields.push({ key: `exp-${exp.id}`, text: exp.description });
    }
    if (!fields.length) { setLang(targetLanguage); return; }
    if (access && !access.tryConsume()) return;
    const texts = fields.map(field => field.text);
    const prompt = JSON.stringify(texts);
    if (prompt.length > 12000 || fields.length > 30) {
      alert(lang === "ar" ? "النصوص طويلة للترجمة دفعة واحدة. لم تتغير بياناتك أو اللغة." : "The text is too long to translate in one request. Your content and language have not changed.");
      return;
    }
    const key = JSON.stringify([targetLanguage, texts]);
    aiRequestInFlight.current = true;
    setLoadingField("translation");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 65000);
    try {
      let translated = translationCache.current.get(key);
      if (!translated) {
        const response = await fetch("/api/generate", {
          method: "POST", signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, type: "translation", language: targetLanguage })
        });
        const data = await response.json();
        if (!response.ok) { const error = new Error(); error.code = data?.code; throw error; }
        try { translated = JSON.parse(data.result); } catch { throw new Error(); }
        if (!Array.isArray(translated) || translated.length !== texts.length || translated.some(value => typeof value !== "string" || !value.trim() || value.length > 20000)) throw new Error();
      }
      if (latestForm.current.lang !== sourceLanguage || JSON.stringify(latestForm.current.resume) !== JSON.stringify(sourceResume)) {
        alert(latestForm.current.lang === "ar" ? "لم تُطبّق الترجمة لأنك عدّلت البيانات أثناء الانتظار. تعديلاتك محفوظة." : "Translation was not applied because you edited the resume while waiting. Your edits are safe.");
        return;
      }
      translationCache.current.set(key, translated);
      translationCache.current.set(JSON.stringify([sourceLanguage, translated]), texts);
      const values = Object.fromEntries(fields.map((field, index) => [field.key, translated[index]]));
      setResume(current => ({ ...current, summary: values.summary ?? current.summary,
        experiences: current.experiences.map(exp => ({ ...exp, description: values[`exp-${exp.id}`] ?? exp.description })) }));
      setLang(targetLanguage);
    } catch (error) {
      alert(generationErrorMessage(error?.name === "AbortError" ? "AI_TIMEOUT" : error?.code, latestForm.current.lang));
    } finally {
      clearTimeout(timeout);
      aiRequestInFlight.current = false;
      setLoadingField(null);
    }
  };

  // تحميل كملف Word (.docx)
  const exportToWord = async () => {
    const isRtl = lang === "ar";
    const align = AlignmentType.START;
    const theme = templateThemes[template];
    const headerAlign = theme.centered ? AlignmentType.CENTER : (isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT);

    const doc = new Document({
      styles: { default: { document: { run: { font: theme.font } } } },
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              alignment: headerAlign,
              children: [
                new TextRun({ text: resume.fullName, bold: true, size: 36, color: theme.ink })
              ]
            }),
            new Paragraph({
              alignment: headerAlign,
              spacing: { after: 100 },
              children: [
                new TextRun({ text: resume.jobTitle, size: 24, color: theme.accent })
              ]
            }),
            new Paragraph({
              alignment: headerAlign,
              spacing: { after: 300 },
              children: [
                new TextRun({ text: [resume.email, resume.phone, resume.location].map(value => value.trim()).filter(Boolean).join("  |  "), size: 20, color: "64748B" })
              ]
            }),

            // النبذة المهنية
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              alignment: align,
              bidirectional: isRtl,
              children: [new TextRun({ text: isRtl ? "النبذة المهنية" : "Professional Summary", bold: true, size: 26, color: theme.ink })]
            }),
            new Paragraph({
              alignment: align,
              bidirectional: isRtl,
              spacing: { after: 250 },
              children: [new TextRun({ text: resume.summary, size: 22 })]
            }),

            // الخبرات العملية
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              alignment: align,
              bidirectional: isRtl,
              children: [new TextRun({ text: isRtl ? "الخبرات العملية" : "Work Experience", bold: true, size: 26, color: theme.ink })]
            }),
            ...resume.experiences.filter(exp => [exp.role, exp.company, exp.period, exp.description].some(value => value.trim())).flatMap((exp) => [
              new Paragraph({
                alignment: align,
                bidirectional: isRtl,
                spacing: { before: 100 },
                children: [
                  new TextRun({ text: `${exp.role} - ${exp.company}`, bold: true, size: 23 }),
                  new TextRun({ text: `  (${exp.period})`, italics: true, size: 20, color: "64748B" })
                ]
              }),
              ...exp.description.split("\n").map(
                (line) =>
                  new Paragraph({
                    alignment: align,
                    bidirectional: isRtl,
                    spacing: { after: 80 },
                    children: [new TextRun({ text: line, size: 21 })]
                  })
              )
            ]),

            // التعليم
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              alignment: align,
              bidirectional: isRtl,
              spacing: { before: 200 },
              children: [new TextRun({ text: isRtl ? "المؤهلات العلمية" : "Education", bold: true, size: 26, color: theme.ink })]
            }),
            ...resume.education.filter(edu => [edu.degree, edu.institution, edu.year].some(value => value.trim())).map(
              (edu) =>
                new Paragraph({
                  alignment: align,
                  bidirectional: isRtl,
                  spacing: { after: 120 },
                  children: [
                    new TextRun({ text: `${edu.degree} - ${edu.institution} (${edu.year})`, size: 22 })
                  ]
                })
            ),

            // المهارات
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              alignment: align,
              bidirectional: isRtl,
              spacing: { before: 200 },
              children: [new TextRun({ text: isRtl ? "المهارات" : "Skills", bold: true, size: 26, color: theme.ink })]
            }),
            new Paragraph({
              alignment: align,
              bidirectional: isRtl,
              children: [new TextRun({ text: resume.skills, size: 22 })]
            })
          ]
        }
      ]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${resume.fullName.replace(/\s+/g, "_")}_Resume.docx`);
  };

  // تحميل كملف PDF
  const exportToPDF = () => {
    window.print();
  };

  return (
    <div className="resume-builder min-h-screen flex flex-col">
      {/* الشريط العلوي */}
      <header className="resume-app-header bg-white/90 backdrop-blur-xl border-b border-slate-200 px-4 sm:px-6 py-4 sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-violet-500 text-white p-2 rounded-xl shadow-lg shadow-blue-500/15">
            <Sparkles size={22} />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-900 tracking-tight">AI Resume Pro</h1>
            <p className="text-xs text-slate-500">{t.poweredBy}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={switchLanguage}
            disabled={loadingField !== null}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition"
          >
            <Globe size={16} />
            {loadingField === "translation" ? (lang === "ar" ? "جارٍ الترجمة..." : "Translating...") : (lang === "ar" ? "English" : "العربية")}
          </button>

          <button
            onClick={exportToWord}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition"
          >
            <FileText size={16} />
            {t.downloadWord}
          </button>

          <button
            onClick={exportToPDF}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/15 transition"
          >
            <Download size={16} />
            {t.downloadPdf}
          </button>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="resume-main flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

        {/* قسم إدخال البيانات (يمين) */}
        <div className="resume-editor lg:col-span-6 space-y-6">

          {/* المعلومات الشخصية */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 space-y-4">
            <h2 className="font-bold text-base text-slate-800 border-b border-slate-200 pb-2">{t.personal}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder={t.fullName}
                value={resume.fullName}
                onChange={(e) => setResume({ ...resume, fullName: e.target.value })}
                className="p-2.5 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-zinc-500 rounded-xl text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 outline-none transition"
              />
              <input
                type="text"
                placeholder={t.jobTitle}
                value={resume.jobTitle}
                onChange={(e) => setResume({ ...resume, jobTitle: e.target.value })}
                className="p-2.5 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-zinc-500 rounded-xl text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 outline-none transition"
              />
              <input
                type="email"
                placeholder={t.email}
                value={resume.email}
                onChange={(e) => setResume({ ...resume, email: e.target.value })}
                className="p-2.5 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-zinc-500 rounded-xl text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 outline-none transition"
              />
              <input
                type="text"
                placeholder={t.phone}
                value={resume.phone}
                onChange={(e) => setResume({ ...resume, phone: e.target.value })}
                className="p-2.5 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-zinc-500 rounded-xl text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 outline-none transition"
              />
              <input
                type="text"
                placeholder={t.location}
                value={resume.location}
                onChange={(e) => setResume({ ...resume, location: e.target.value })}
                className="p-2.5 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-zinc-500 rounded-xl text-sm md:col-span-2 focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 outline-none transition"
              />
            </div>
          </section>

          {/* النبذة المهنية */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h2 className="font-bold text-base text-slate-800">{t.summary}</h2>
              <button
                onClick={() => enhanceWithAI([resume.jobTitle, resume.summary].map(value => value.trim()).filter(Boolean).join(" - "), "summary")}
                disabled={loadingField !== null}
                className="flex items-center gap-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingField === "summary" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {t.draft}
              </button>
            </div>
            <textarea
              rows={3}
              placeholder={t.summaryHint}
              value={resume.summary}
              onChange={(e) => setResume({ ...resume, summary: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-zinc-500 rounded-xl text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 outline-none transition"
            />
          </section>

          {/* الخبرات العملية */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h2 className="font-bold text-base text-slate-800">{t.experienceHeading}</h2>
              <button
                onClick={() =>
                  setResume({
                    ...resume,
                    experiences: [
                      ...resume.experiences,
                      { id: Date.now(), role: "", company: "", period: "", description: "" }
                    ]
                  })
                }
                className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-amber-200 transition"
              >
                <Plus size={15} /> {t.addExperience}
              </button>
            </div>

            {resume.experiences.map((exp, index) => (
              <div key={exp.id} className="p-4 bg-white/[0.04] rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-500">{t.experience} #{index + 1}</span>
                  {resume.experiences.length > 1 && (
                    <button
                      onClick={() =>
                        setResume({
                          ...resume,
                          experiences: resume.experiences.filter((item) => item.id !== exp.id)
                        })
                      }
                      className="text-red-400 hover:text-red-300 transition"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder={t.jobTitle}
                    value={exp.role}
                    onChange={(e) => {
                      const updated = [...resume.experiences];
                      updated[index].role = e.target.value;
                      setResume({ ...resume, experiences: updated });
                    }}
                    className="p-2 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-zinc-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 outline-none transition"
                  />
                  <input
                    type="text"
                    placeholder={t.company}
                    value={exp.company}
                    onChange={(e) => {
                      const updated = [...resume.experiences];
                      updated[index].company = e.target.value;
                      setResume({ ...resume, experiences: updated });
                    }}
                    className="p-2 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-zinc-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 outline-none transition"
                  />
                  <input
                    type="text"
                    placeholder={t.period}
                    value={exp.period}
                    onChange={(e) => {
                      const updated = [...resume.experiences];
                      updated[index].period = e.target.value;
                      setResume({ ...resume, experiences: updated });
                    }}
                    className="p-2 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-zinc-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 outline-none transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-end">
                    <button
                      onClick={() => enhanceWithAI([exp.role, exp.company, exp.description].map(value => value.trim()).filter(Boolean).join(" - "), "experience", exp.id)}
                      disabled={loadingField !== null}
                      className="flex items-center gap-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingField === `exp-${exp.id}` ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      {t.improve}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    placeholder={t.descriptionHint}
                    value={exp.description}
                    onChange={(e) => {
                      const updated = [...resume.experiences];
                      updated[index].description = e.target.value;
                      setResume({ ...resume, experiences: updated });
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-zinc-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 outline-none transition"
                  />
                </div>
              </div>
            ))}
          </section>

          {/* التعليم والمهارات */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <h2 className="font-bold text-base text-slate-800">{t.educationSkills}</h2>
              <button onClick={() => setResume(current => ({ ...current, education: [...current.education, { id: crypto.randomUUID(), degree: "", institution: "", year: "" }] }))}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800">
                <Plus size={15} /> {t.addEducation}
              </button>
            </div>
            {resume.education.map((edu, idx) => (
              <div key={edu.id} className="border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex justify-end">
                  <button aria-label={t.removeEducation} onClick={() => setResume(current => ({ ...current, education: current.education.filter(item => item.id !== edu.id) }))}
                    className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder={t.degree}
                  value={edu.degree}
                  onChange={(e) => {
                    const updated = [...resume.education];
                    updated[idx].degree = e.target.value;
                    setResume({ ...resume, education: updated });
                  }}
                  className="p-2 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-zinc-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 outline-none transition"
                />
                <input
                  type="text"
                  placeholder={t.institution}
                  value={edu.institution}
                  onChange={(e) => {
                    const updated = [...resume.education];
                    updated[idx].institution = e.target.value;
                    setResume({ ...resume, education: updated });
                  }}
                  className="p-2 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-zinc-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 outline-none transition"
                />
                <input
                  type="text"
                  placeholder={t.year}
                  value={edu.year}
                  onChange={(e) => {
                    const updated = [...resume.education];
                    updated[idx].year = e.target.value;
                    setResume({ ...resume, education: updated });
                  }}
                  className="p-2 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-zinc-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 outline-none transition"
                />
                </div>
              </div>
            ))}

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t.skillsHint}</label>
              <input
                type="text"
                value={resume.skills}
                onChange={(e) => setResume({ ...resume, skills: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-zinc-500 rounded-xl text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 outline-none transition"
              />
            </div>
          </section>
        </div>

        {/* قسم المعاينة الحية A4 (يسار) */}
        <div className="resume-preview-container lg:col-span-6">
          <section className="resume-template-picker bg-white border border-slate-200 rounded-2xl p-4 mb-5" aria-label={lang === "ar" ? "تصميم السيرة الذاتية" : "Resume design"}>
            <h2 className="font-bold text-sm text-slate-800 mb-3">{lang === "ar" ? "اختر تصميم السيرة الذاتية" : "Choose your resume design"}</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "classic", ar: "كلاسيكي", en: "Classic", color: "#2563eb" },
                { id: "modern", ar: "عصري", en: "Modern", color: "#087f8c" },
                { id: "executive", ar: "تنفيذي", en: "Executive", color: "#6d597a" }
              ].map(item => (
                <button key={item.id} type="button" aria-pressed={template === item.id} onClick={() => setTemplate(item.id)}
                  className={`rounded-xl border-2 p-2 text-xs font-semibold transition ${template === item.id ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`}>
                  <span aria-hidden="true" className={`template-thumbnail template-thumbnail-${item.id}`} style={{ "--template-color": item.color }}><i /><i /><i /><i /></span>
                  {lang === "ar" ? item.ar : item.en}
                </button>
              ))}
            </div>
          </section>
          <div className="resume-preview-sticky sticky top-24">
            <div
              id="resume-preview"
              data-template={template}
              dir={lang === "ar" ? "rtl" : "ltr"}
              className="bg-white shadow-2xl rounded-lg ring-1 ring-black/20 p-10 min-h-[842px] text-slate-800"
            >
              {/* رأس السيرة الذاتية */}
              <div className="resume-document-header border-b-2 border-slate-800 pb-4 mb-6 text-center">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{resume.fullName}</h1>
                <p className="text-blue-600 font-semibold text-base mt-1">{resume.jobTitle}</p>
                <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-500 mt-2">
                  {[resume.email, resume.phone, resume.location].map(value => value.trim()).filter(Boolean).map((value, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && <span aria-hidden="true">•</span>}
                      <span dir="auto">{value}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* النبذة */}
              {resume.summary && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                    {lang === "ar" ? "النبذة المهنية" : "Professional Summary"}
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{resume.summary}</p>
                </div>
              )}

              {/* الخبرات */}
              <div className="mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-3">
                  {lang === "ar" ? "الخبرات العملية" : "Work Experience"}
                </h3>
                <div className="space-y-4">
                  {resume.experiences.filter(exp => [exp.role, exp.company, exp.period, exp.description].some(value => value.trim())).map((exp) => (
                    <div key={exp.id}>
                      <div className="flex justify-between items-baseline">
                        <h4 className="font-bold text-sm text-slate-900">
                          {exp.role} <span className="font-normal text-slate-600">| {exp.company}</span>
                        </h4>
                        <span className="text-xs text-slate-500 font-medium">{exp.period}</span>
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-line mt-1.5 leading-relaxed">
                        {exp.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* التعليم */}
              <div className="mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                  {lang === "ar" ? "المؤهلات العلمية" : "Education"}
                </h3>
                {resume.education.filter(edu => [edu.degree, edu.institution, edu.year].some(value => value.trim())).map((edu) => (
                  <div key={edu.id} className="flex justify-between text-sm">
                    <div>
                      <span className="font-bold text-slate-800">{edu.degree}</span>
                      <span className="text-slate-600"> - {edu.institution}</span>
                    </div>
                    <span className="text-xs text-slate-500">{edu.year}</span>
                  </div>
                ))}
              </div>

              {/* المهارات */}
              {resume.skills && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                    {lang === "ar" ? "المهارات" : "Skills"}
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {resume.skills.split(/[,،]/).filter(skill => skill.trim()).map((skill, i) => (
                      <span
                        key={i}
                        className="bg-slate-100 text-slate-800 text-xs px-2.5 py-1 rounded font-medium border border-slate-200"
                      >
                        {skill.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </main>

      {/* Owner attribution/contact footer; never printed or exported. */}
      <footer className="site-contact-footer" aria-label="التواصل" style={{ background: "none", border: "none", padding: "0 16px 40px" }}>
        <div style={{ maxWidth: 430, margin: "0 auto", background: "#0d1226", borderRadius: 24, padding: "28px 20px", textAlign: "center", color: "#fff", boxShadow: "0 16px 40px rgba(12, 41, 66, 0.25)" }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>أ. أحمد عبدالكريم</div>
          <div dir="ltr" style={{ marginTop: 12, fontSize: 14, color: "#cbd5e1" }}>✉️ <a href="mailto:mr.ahmed22296@gmail.com" style={{ color: "#cbd5e1", textDecoration: "none" }}>mr.ahmed22296@gmail.com</a></div>
          <div dir="ltr" style={{ marginTop: 8, fontSize: 14, color: "#cbd5e1" }}>📱 <a href="tel:+96560085043" style={{ color: "#cbd5e1", textDecoration: "none" }}>60085043</a> / <a href="tel:+201201487209" style={{ color: "#cbd5e1", textDecoration: "none" }}>01201487209</a></div>
          <div style={{ marginTop: 14, fontSize: 12, color: "#94a3b8" }}>© 2026 جميع الحقوق محفوظة — صانع السيرة الذاتية بالذكاء الاصطناعي</div>
        </div>
      </footer>
      <ContactWidget />
    </div>
  );
                  }

export default function ResumeBuilder() {
  // عداد الزوار المباشر
  useEffect(() => {
    if (window.__vcLoaded) return;
    window.__vcLoaded = true;
    var SITE_ID = 'my-cv-ai';
    var ROOT = 'https://firestore.googleapis.com/v1/projects/resume-builder-access/databases/(default)/documents';
    var st = document.createElement('style');
    st.textContent = '.vc-badge{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99800;background:#ffffff;border:1px solid #bae6fd;border-radius:999px;padding:6px 16px;display:flex;align-items:center;gap:8px;font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;color:#0c2942;box-shadow:0 4px 14px rgba(12,41,66,.12);direction:rtl;box-sizing:border-box}.vc-badge .vc-dot{width:8px;height:8px;border-radius:50%;background:#0ea5e9;flex-shrink:0}.vc-badge .vc-num{color:#0369a1;font-weight:900;min-width:22px;text-align:center}';
    document.head.appendChild(st);
    var el = document.createElement('div');
    el.className = 'vc-badge';
    el.innerHTML = '<span class="vc-dot"></span><span>عدد الزوار</span><span class="vc-num" id="vcNum">…</span>';
    document.body.appendChild(el);
    function setNum(v) { var n = document.getElementById('vcNum'); if (n) n.textContent = v; }
    function read() {
      fetch(ROOT + '/counters/' + SITE_ID)
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var c = j && j.fields && j.fields.count ? Number(j.fields.count.integerValue) : 0;
          setNum(c);
        })
        .catch(function () { setNum('–'); });
    }
    function bump() {
      fetch(ROOT + ':commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes: [{ transform: { document: 'projects/resume-builder-access/databases/(default)/documents/counters/' + SITE_ID, fieldTransforms: [{ fieldPath: 'count', increment: { integerValue: '1' } }] } }] })
      }).then(read).catch(read);
    }
    try {
      if (!sessionStorage.getItem('vc_counted_' + SITE_ID)) {
        sessionStorage.setItem('vc_counted_' + SITE_ID, '1');
        bump();
      } else { read(); }
    } catch (e) { read(); }
    var timer = setInterval(read, 60000);
    return function () { clearInterval(timer); };
  }, []);

  return (
    <AuthGate>
      <ResumeBuilderInner />
    </AuthGate>
  );
}
