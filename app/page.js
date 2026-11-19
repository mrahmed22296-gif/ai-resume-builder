"use client";

import React, { useState } from "react";
import { Sparkles, Download, FileText, Plus, Trash2, Globe, Loader2 } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";

export default function ResumeBuilder() {
  const [lang, setLang] = useState("ar");
  const [loadingField, setLoadingField] = useState(null);

  const [resume, setResume] = useState({
    fullName: "أحمد محمد العتيبي",
    jobTitle: "مهندس برمجيات أول | مطور تطبيقات ويب",
    email: "ahmed.dev@example.com",
    phone: "+965 9000 0000",
    location: "الكويت",
    summary: "مطور برمجيات بخبرة تتجاوز 5 سنوات في بناء تطبيقات الويب عالية الأداء باستخدام React و Node.js، مع شغف بتحسين تجربة المستخدم وأتمتة العمليات.",
    experiences: [
      {
        id: 1,
        role: "مطور واجهات أمامية أول",
        company: "شركة التقنية المتقدمة",
        period: "2022 - الحالي",
        description: "• قيادة فريق مكون من 4 مطورين لإعادة بناء المنصة الرئيسية مما رفع سرعة التحميل بنسبة 40%.\n• تطوير مكونات واجهة مستخدم قابلة لإعادة الاستخدام وتقليل الأخطاء البرمجية بنسبة 25%."
      }
    ],
    education: [
      {
        id: 1,
        degree: "بكالوريوس علوم الحاسوب",
        institution: "جامعة الكويت",
        year: "2019"
      }
    ],
    skills: "JavaScript, React, Next.js, Node.js, Tailwind CSS, Git, REST APIs, Agile"
  });

  // استدعاء Gemini AI لتحسين النصوص
  const enhanceWithAI = async (text, type, expId = null) => {
    if (!text.trim()) return alert("يرجى كتابة بعض الكلمات أو المسمى الوظيفي أولاً ليتمكن الذكاء الاصطناعي من صياغته.");
    
    const loadKey = expId ? `exp-${expId}` : type;
    setLoadingField(loadKey);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, type, language: lang })
      });
      const data = await res.json();

      if (data.error) {
        alert(data.error);
      } else if (type === "summary") {
        setResume({ ...resume, summary: data.result });
      } else if (type === "experience" && expId) {
        setResume({
          ...resume,
          experiences: resume.experiences.map((exp) =>
            exp.id === expId ? { ...exp, description: data.result } : exp
          )
        });
      }
    } catch (err) {
      alert("فشل الاتصال بالخادم.");
    } finally {
      setLoadingField(null);
    }
  };

  // تحميل كملف Word (.docx)
  const exportToWord = async () => {
    const isRtl = lang === "ar";
    const align = isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT;

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
                new TextRun({ text: `${resume.email}  |  ${resume.phone}  |  ${resume.location}`, size: 20, color: "64748B" })
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
            ...resume.experiences.flatMap((exp) => [
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
            ...resume.education.map(
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
    <div className="min-h-screen flex flex-col">
      {/* الشريط العلوي */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <Sparkles size={22} />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-800">AI Resume Pro</h1>
            <p className="text-xs text-slate-500">مدعوم بواسطة Gemini AI</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            <Globe size={16} />
            {lang === "ar" ? "English" : "العربية"}
          </button>

          <button
            onClick={exportToWord}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
          >
            <FileText size={16} />
            تحميل Word
          </button>

          <button
            onClick={exportToPDF}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
          >
            <Download size={16} />
            تحميل PDF
          </button>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* قسم إدخال البيانات (يمين) */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* المعلومات الشخصية */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="font-bold text-base text-slate-800 border-b pb-2">المعلومات الشخصية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="الاسم الكامل"
                value={resume.fullName}
                onChange={(e) => setResume({ ...resume, fullName: e.target.value })}
                className="p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="text"
                placeholder="المسمى الوظيفي"
                value={resume.jobTitle}
                onChange={(e) => setResume({ ...resume, jobTitle: e.target.value })}
                className="p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="email"
                placeholder="البريد الإلكتروني"
                value={resume.email}
                onChange={(e) => setResume({ ...resume, email: e.target.value })}
                className="p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="text"
                placeholder="رقم الهاتف"
                value={resume.phone}
                onChange={(e) => setResume({ ...resume, phone: e.target.value })}
                className="p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="text"
                placeholder="المدينة / الدولة"
                value={resume.location}
                onChange={(e) => setResume({ ...resume, location: e.target.value })}
                className="p-2.5 border rounded-lg text-sm md:col-span-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </section>

          {/* النبذة المهنية */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-base text-slate-800">النبذة المهنية</h2>
              <button
                onClick={() => enhanceWithAI(`${resume.jobTitle} - ${resume.summary}`, "summary")}
                disabled={loadingField === "summary"}
                className="flex items-center gap-1.5 text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-full transition"
              >
                {loadingField === "summary" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                صياغة بـ Gemini
              </button>
            </div>
            <textarea
              rows={3}
              placeholder="اكتب نبذة مختصرة أو كلمات مفتاحية وسيقوم Gemini بصياغتها..."
              value={resume.summary}
              onChange={(e) => setResume({ ...resume, summary: e.target.value })}
              className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </section>

          {/* الخبرات العملية */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-base text-slate-800">الخبرات العملية</h2>
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
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                <Plus size={15} /> إضافة خبرة
              </button>
            </div>

            {resume.experiences.map((exp, index) => (
              <div key={exp.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">خبرة #{index + 1}</span>
                  {resume.experiences.length > 1 && (
                    <button
                      onClick={() =>
                        setResume({
                          ...resume,
                          experiences: resume.experiences.filter((item) => item.id !== exp.id)
                        })
                      }
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="المسمى الوظيفي"
                    value={exp.role}
                    onChange={(e) => {
                      const updated = [...resume.experiences];
                      updated[index].role = e.target.value;
                      setResume({ ...resume, experiences: updated });
                    }}
                    className="p-2 border rounded text-sm bg-white"
                  />
                  <input
                    type="text"
                    placeholder="اسم الشركة"
                    value={exp.company}
                    onChange={(e) => {
                      const updated = [...resume.experiences];
                      updated[index].company = e.target.value;
                      setResume({ ...resume, experiences: updated });
                    }}
                    className="p-2 border rounded text-sm bg-white"
                  />
                  <input
                    type="text"
                    placeholder="الفترة (مثال: 2021 - 2024)"
                    value={exp.period}
                    onChange={(e) => {
                      const updated = [...resume.experiences];
                      updated[index].period = e.target.value;
                      setResume({ ...resume, experiences: updated });
                    }}
                    className="p-2 border rounded text-sm bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-end">
                    <button
                      onClick={() => enhanceWithAI(`${exp.role} في ${exp.company}: ${exp.description}`, "experience", exp.id)}
                      disabled={loadingField === `exp-${exp.id}`}
                      className="flex items-center gap-1 text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-full transition"
                    >
                      {loadingField === `exp-${exp.id}` ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      تحسين المهام بـ Gemini
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="اكتب مهامك باختصار وسيحولها Gemini إلى نقاط إنجاز احترافية..."
                    value={exp.description}
                    onChange={(e) => {
                      const updated = [...resume.experiences];
                      updated[index].description = e.target.value;
                      setResume({ ...resume, experiences: updated });
                    }}
                    className="w-full p-2 border rounded text-sm bg-white"
                  />
                </div>
              </div>
            ))}
          </section>

          {/* التعليم والمهارات */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="font-bold text-base text-slate-800 border-b pb-2">المؤهلات العلمية والمهارات</h2>
            {resume.education.map((edu, idx) => (
              <div key={edu.id} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="الدرجة العلمية"
                  value={edu.degree}
                  onChange={(e) => {
                    const updated = [...resume.education];
                    updated[idx].degree = e.target.value;
                    setResume({ ...resume, education: updated });
                  }}
                  className="p-2 border rounded text-sm"
                />
                <input
                  type="text"
                  placeholder="الجامعة / المؤسسة"
                  value={edu.institution}
                  onChange={(e) => {
                    const updated = [...resume.education];
                    updated[idx].institution = e.target.value;
                    setResume({ ...resume, education: updated });
                  }}
                  className="p-2 border rounded text-sm"
                />
                <input
                  type="text"
                  placeholder="سنة التخرج"
                  value={edu.year}
                  onChange={(e) => {
                    const updated = [...resume.education];
                    updated[idx].year = e.target.value;
                    setResume({ ...resume, education: updated });
                  }}
                  className="p-2 border rounded text-sm"
                />
              </div>
            ))}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">المهارات (افصل بينها بفاصلة)</label>
              <input
                type="text"
                value={resume.skills}
                onChange={(e) => setResume({ ...resume, skills: e.target.value })}
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
          </section>
        </div>

        {/* قسم المعاينة الحية A4 (يسار) */}
        <div className="lg:col-span-6">
          <div className="sticky top-24">
            <div
              id="resume-preview"
              dir={lang === "ar" ? "rtl" : "ltr"}
              className="bg-white shadow-lg border border-slate-200 rounded-sm p-10 min-h-[842px] text-slate-800"
            >
              {/* رأس السيرة الذاتية */}
              <div className="border-b-2 border-slate-800 pb-4 mb-6 text-center">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{resume.fullName}</h1>
                <p className="text-blue-600 font-semibold text-base mt-1">{resume.jobTitle}</p>
                <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-500 mt-2">
                  <span>{resume.email}</span>
                  <span>•</span>
                  <span dir="ltr">{resume.phone}</span>
                  <span>•</span>
                  <span>{resume.location}</span>
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
                  {resume.experiences.map((exp) => (
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
                {resume.education.map((edu) => (
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
                    {resume.skills.split(",").map((skill, i) => (
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
