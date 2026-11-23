"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Download, FileText, Plus, Trash2, Globe, Loader2 } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import { generationErrorMessage } from "./generation-errors.mjs";

export default function ResumeBuilder() {
  const [lang, setLang] = useState("ar");
  const [loadingField, setLoadingField] = useState(null);
  const aiRequestInFlight = useRef(false);
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

  // تحميل كملف Word (.docx)
  const exportToWord = async () => {
    const isRtl = lang === "ar";
    const align = AlignmentType.START;

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: resume.fullName, bold: true, size: 36, color: "1E293B" })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
              children: [
                new TextRun({ text: resume.jobTitle, size: 24, color: "2563EB" })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
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
              children: [new TextRun({ text: isRtl ? "النبذة المهنية" : "Professional Summary", bold: true, size: 26, color: "0F172A" })]
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
              children: [new TextRun({ text: isRtl ? "الخبرات العملية" : "Work Experience", bold: true, size: 26, color: "0F172A" })]
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
              children: [new TextRun({ text: isRtl ? "المؤهلات العلمية" : "Education", bold: true, size: 26, color: "0F172A" })]
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
              children: [new TextRun({ text: isRtl ? "المهارات" : "Skills", bold: true, size: 26, color: "0F172A" })]
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
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition"
          >
            <Globe size={16} />
            {lang === "ar" ? "English" : "العربية"}
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
            <h2 className="font-bold text-base text-slate-800 border-b border-slate-200 pb-2">{t.educationSkills}</h2>
            {resume.education.map((edu, idx) => (
              <div key={edu.id} className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
          <div className="resume-preview-sticky sticky top-24">
            <div
              id="resume-preview"
              dir={lang === "ar" ? "rtl" : "ltr"}
              className="bg-white shadow-2xl rounded-lg ring-1 ring-black/20 p-10 min-h-[842px] text-slate-800"
            >
              {/* رأس السيرة الذاتية */}
              <div className="border-b-2 border-slate-800 pb-4 mb-6 text-center">
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
    </div>
  );
                  }
