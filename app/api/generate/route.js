import { NextResponse } from "next/server";
import { generateResumeText } from "./gemini.mjs";

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON request.", code: "INVALID_REQUEST" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request.", code: "INVALID_REQUEST" }, { status: 400 });
  }
  const { prompt, type, language } = body;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 5000 ||
      !["summary", "experience"].includes(type) || !["ar", "en"].includes(language)) {
    return NextResponse.json({ error: "Provide a prompt of 1-5000 characters, a supported type and language.", code: "INVALID_REQUEST" }, { status: 400 });
  }
  const outcome = await generateResumeText({ prompt: prompt.trim(), type, language });
  if (outcome.result) return NextResponse.json({ result: outcome.result });
  return NextResponse.json({ error: "AI generation could not be completed.", code: outcome.code }, { status: outcome.status });
}
