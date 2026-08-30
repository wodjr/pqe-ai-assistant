/**
 * app/api/ai/suggest/route.ts — PQE AI Assistant
 *
 * Secure server-side API route for AI suggestions.
 *
 * Security controls:
 * - OPENAI_API_KEY is read server-side only and never sent to the browser.
 * - All requests are POST with a JSON body — no secrets in URLs or query params.
 * - Input is validated and truncated before sending to OpenAI.
 * - Responses are clearly labelled as AI-generated in the returned JSON.
 * - This route never writes to storage — it only returns suggestion text.
 * - Rate limiting should be added before production deployment.
 *
 * Request body: { mode, context }
 *   mode: "audit_prep" | "verification" | "finding"
 *   context: object with relevant audit data (see types below)
 *
 * Response: { suggestion: string; label: string; disclaimer: string }
 */

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditPrepContext {
  supplierName: string;
  supplierSite: string;
  auditType: string;
  scope: string;
  sections: { title: string; questionCount: number }[];
  previousFindings?: string;
}

interface VerificationContext {
  questionRef: string;
  questionText: string;
  guidance: string;
  supplierResponse: string;
  supplierStatus: string;
}

interface FindingContext {
  auditType: string;
  supplierName: string;
  questionRef: string;
  questionText: string;
  auditorNotes: string;
  verdict: string;
}

interface AgendaContext {
  supplierName: string;
  supplierSite: string;
  auditType: string;
  auditDates: string[];
  scope: string;
  leadAuditor: string;
  auditTeam: string[];
  checklistSections: { title: string; questionCount: number }[];
  previousFindings: string;
}

interface DailySummaryContext {
  supplierName: string;
  auditType: string;
  day: number;
  totalDays: number;
  verifiedCount: number;
  totalQuestions: number;
  majorFindings: number;
  minorFindings: number;
  observations: number;
  openCARs: number;
  keyNotesSnippets: string[]; // up to 5 auditor note snippets
}

interface DrawingContext {
  supplierName: string;
  partNumber: string;
  partDescription: string;
  processType: string;
  imageBase64: string; // data:image/...;base64,...
}

interface OcrContext {
  supplierName: string;
  documentType: string; // e.g. "Material Certificate", "Calibration Record"
  imageBase64: string;
}

interface ChecklistReviewContext {
  checklistName: string;
  revision: string;
  sections: { title: string; questions: { ref: string; text: string; guidance: string; isMandatory: boolean }[] }[];
}

type SuggestMode = "audit_prep" | "verification" | "finding" | "daily_summary" | "drawing" | "ocr" | "agenda" | "checklist_review";

interface SuggestRequest {
  mode: SuggestMode;
  context: AuditPrepContext | VerificationContext | FindingContext | DailySummaryContext | DrawingContext | OcrContext | AgendaContext | ChecklistReviewContext;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildAuditPrepPrompt(ctx: AuditPrepContext): string {
  const sections = ctx.sections
    .map((s) => `- ${s.title} (${s.questionCount} questions)`)
    .join("\n");

  return `You are a procurement quality engineering expert assisting an auditor preparing for a supplier audit.

Supplier: ${ctx.supplierName}
Site: ${ctx.supplierSite}
Audit type: ${ctx.auditType}
Scope: ${ctx.scope || "Not specified"}

Checklist sections:
${sections}

${ctx.previousFindings ? `Previous findings to follow up:\n${ctx.previousFindings}\n` : ""}

Provide a concise risk-based audit preparation plan covering:
1. The top 3-5 risk areas to focus on based on the audit type and scope
2. Key documents and records to request before arrival
3. Suggested opening questions for each major section
4. Any process-specific risks for the manufacturing type indicated in the scope

Keep the response practical and under 400 words. Use bullet points.`;
}

function buildVerificationPrompt(ctx: VerificationContext): string {
  return `You are a procurement quality engineering expert assisting an auditor during an onsite audit.

Checklist question ${ctx.questionRef}: "${ctx.questionText}"
${ctx.guidance ? `Guidance: ${ctx.guidance}` : ""}

The supplier responded: "${ctx.supplierResponse || "No response provided"}"
Supplier self-assessment status: ${ctx.supplierStatus}

Suggest 2-3 specific follow-up questions the auditor should ask onsite to verify this requirement, and identify what objective evidence (documents, records, physical items) should be requested. Be specific and practical.

Keep the response under 150 words. Do not make a verdict — that is the auditor's role.`;
}

function buildFindingPrompt(ctx: FindingContext): string {
  return `You are a procurement quality engineering expert assisting an auditor documenting a finding.

Audit type: ${ctx.auditType}
Supplier: ${ctx.supplierName}
Checklist item ${ctx.questionRef}: "${ctx.questionText}"
Auditor verdict: ${ctx.verdict}
Auditor notes: "${ctx.auditorNotes || "None"}"

Draft a clear, factual finding statement that:
1. States the specific requirement not met (or observation)
2. Describes the objective evidence observed
3. References the applicable standard or requirement if evident from the question text

Keep it under 80 words. Write in the third person. Do not classify the finding — that is the auditor's role.`;
}

function buildDailySummaryPrompt(ctx: DailySummaryContext): string {
  const notes = ctx.keyNotesSnippets.length
    ? ctx.keyNotesSnippets.map((n, i) => `${i + 1}. ${n}`).join("\n")
    : "No notes recorded yet.";
  return `You are a procurement quality engineering expert helping an auditor write an end-of-day audit summary.

Supplier: ${ctx.supplierName}
Audit type: ${ctx.auditType}
Day ${ctx.day} of ${ctx.totalDays}
Progress: ${ctx.verifiedCount} of ${ctx.totalQuestions} checklist items assessed
Findings so far: ${ctx.majorFindings} Major, ${ctx.minorFindings} Minor, ${ctx.observations} Observations
Open CARs: ${ctx.openCARs}

Key auditor notes from today:
${notes}

Write a concise end-of-day summary covering:
1. Progress and overall impression so far
2. Key findings and risk areas identified today
3. Recommended focus areas for the next audit day
4. Any urgent actions (e.g. document requests, containment concerns)

Keep the summary under 250 words. Write in professional third-person audit style.
IMPORTANT: Do not invent specific findings, references, or data not provided above.`;
}

function buildDrawingPrompt(ctx: DrawingContext): string {
  return `You are a procurement quality engineering expert assisting an auditor reviewing a technical drawing.

Supplier: ${ctx.supplierName}
Part number: ${ctx.partNumber || "Not specified"}
Part description: ${ctx.partDescription || "Not specified"}
Manufacturing process: ${ctx.processType || "Not specified"}

The auditor has photographed a technical drawing. Analyse the image and identify:
1. Critical-to-function (CTF) characteristics — dimensions, tolerances, surface finish, material callouts
2. Key quality characteristics that should be controlled in the PFMEA and Control Plan
3. Any GD&T callouts that require specific measurement equipment (CMM, form gauges, etc.)
4. Process-specific risks for the manufacturing type stated
5. Documents and records the auditor should request to verify compliance (inspection reports, CMM printouts, calibration records)

Label each point clearly. Do not speculate about specific numbers not visible in the image.
If the image quality is insufficient for analysis, state that clearly and suggest what to re-photograph.
Keep the response under 350 words.`;
}

function buildOcrPrompt(ctx: OcrContext): string {
  return `You are a procurement quality engineering expert assisting an auditor reviewing a supplier document.

Supplier: ${ctx.supplierName}
Document type: ${ctx.documentType || "Unknown document type"}

The auditor has photographed this document. Please:
1. Extract and summarise the key information visible in the document
2. Identify any missing mandatory fields or information that should be present for this document type
3. Flag any concerns: expired dates, mismatched part numbers, incomplete data, illegible sections
4. Confirm whether this document appears complete and compliant for its stated type
5. List any follow-up questions the auditor should ask based on what is visible

If the image is unclear or cannot be read, state this and suggest what to re-photograph.
Keep the response under 300 words. Do not fabricate values not visible in the image.`;
}

function buildAgendaPrompt(ctx: AgendaContext): string {
  const sections = ctx.checklistSections
    .map((s) => `- ${s.title} (${s.questionCount} questions)`)
    .join("\n");
  const team = ctx.auditTeam.length > 0 ? ctx.auditTeam.join(", ") : "Not specified";
  return `You are a procurement quality engineering expert. Generate a professional supplier audit agenda and opening briefing notes.

Supplier: ${ctx.supplierName}, ${ctx.supplierSite}
Audit type: ${ctx.auditType}
Audit dates: ${ctx.auditDates.join(", ")}
Lead auditor: ${ctx.leadAuditor}
Audit team: ${team}
Scope: ${ctx.scope || "Not specified"}

Checklist sections:
${sections}

${ctx.previousFindings ? `Previous findings to address:\n${ctx.previousFindings}\n` : ""}

Generate:
1. A structured day-by-day agenda with time slots (morning/afternoon) allocating time to each checklist section
2. Opening meeting briefing notes (purpose, scope, logistics, housekeeping)
3. Three supplier-specific risk areas to focus on based on the audit type and scope
4. A list of requested documents to prepare before arrival

Keep the total response under 500 words. Use clear headings and bullet points.`;
}

function buildChecklistReviewPrompt(ctx: ChecklistReviewContext): string {
  const sectionsSummary = ctx.sections
    .map((s) => {
      const questions = s.questions
        .slice(0, 15)
        .map((q) => `  [${q.ref}] ${q.text}${q.isMandatory ? " (MANDATORY)" : ""}${q.guidance ? `\n    Guidance: ${q.guidance}` : ""}`)
        .join("\n");
      return `Section: ${s.title} (${s.questions.length} questions)\n${questions}${s.questions.length > 15 ? `\n  … and ${s.questions.length - 15} more questions` : ""}`;
    })
    .join("\n\n");

  return `You are a procurement quality engineering expert reviewing an audit checklist template.

Checklist: "${ctx.checklistName}" (Revision ${ctx.revision || "unspecified"})

Sections and questions:
${sectionsSummary}

Review this checklist and provide:

1. COVERAGE ASSESSMENT — Which quality management areas are well covered and which are missing or thin (e.g. PFMEA linkage, Control Plan, MSA/Gauge R&R, SPC/Cpk, incoming inspection, traceability, change management, sub-tier supplier controls, customer-specific requirements).

2. CTF / CRITICAL CHARACTERISTICS — Does the checklist adequately address Critical-to-Function (CTF) characteristic identification, measurement system capability, and in-process control of CTF features?

3. GAP ANALYSIS — List the top 3-5 specific questions or topics that are missing and should be added, with a brief rationale for each.

4. QUESTION QUALITY ISSUES — Flag any questions that are vague, un-auditable (cannot be objectively verified), or where the guidance is insufficient.

5. OVERALL RATING — Summarise the checklist quality in one paragraph: coverage breadth, auditability, and suitability for its purpose.

Keep the response under 500 words. Use numbered sections and bullet points. Be specific and practical.
IMPORTANT: Base your review only on the questions shown. Do not invent question references.`;
}

// ---------------------------------------------------------------------------
// Truncation helper — prevent prompt injection via oversized inputs
// ---------------------------------------------------------------------------

function truncate(s: string | undefined, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function sanitiseAuditPrep(ctx: AuditPrepContext): AuditPrepContext {
  return {
    supplierName: truncate(ctx.supplierName, 100),
    supplierSite: truncate(ctx.supplierSite, 100),
    auditType: truncate(ctx.auditType, 50),
    scope: truncate(ctx.scope, 500),
    sections: (ctx.sections ?? []).slice(0, 20).map((s) => ({
      title: truncate(s.title, 80),
      questionCount: Math.max(0, Math.min(999, Number(s.questionCount) || 0)),
    })),
    previousFindings: truncate(ctx.previousFindings, 400),
  };
}

function sanitiseVerification(ctx: VerificationContext): VerificationContext {
  return {
    questionRef: truncate(ctx.questionRef, 20),
    questionText: truncate(ctx.questionText, 300),
    guidance: truncate(ctx.guidance, 200),
    supplierResponse: truncate(ctx.supplierResponse, 400),
    supplierStatus: truncate(ctx.supplierStatus, 30),
  };
}

function sanitiseFinding(ctx: FindingContext): FindingContext {
  return {
    auditType: truncate(ctx.auditType, 50),
    supplierName: truncate(ctx.supplierName, 100),
    questionRef: truncate(ctx.questionRef, 20),
    questionText: truncate(ctx.questionText, 300),
    auditorNotes: truncate(ctx.auditorNotes, 400),
    verdict: truncate(ctx.verdict, 30),
  };
}

function sanitiseDailySummary(ctx: DailySummaryContext): DailySummaryContext {
  return {
    supplierName: truncate(ctx.supplierName, 100),
    auditType: truncate(ctx.auditType, 50),
    day: Math.max(1, Math.min(30, Number(ctx.day) || 1)),
    totalDays: Math.max(1, Math.min(30, Number(ctx.totalDays) || 1)),
    verifiedCount: Math.max(0, Number(ctx.verifiedCount) || 0),
    totalQuestions: Math.max(1, Number(ctx.totalQuestions) || 1),
    majorFindings: Math.max(0, Number(ctx.majorFindings) || 0),
    minorFindings: Math.max(0, Number(ctx.minorFindings) || 0),
    observations: Math.max(0, Number(ctx.observations) || 0),
    openCARs: Math.max(0, Number(ctx.openCARs) || 0),
    keyNotesSnippets: (ctx.keyNotesSnippets ?? []).slice(0, 5).map((n) => truncate(n, 200)),
  };
}

function sanitiseDrawing(ctx: DrawingContext): DrawingContext {
  return {
    supplierName: truncate(ctx.supplierName, 100),
    partNumber: truncate(ctx.partNumber, 50),
    partDescription: truncate(ctx.partDescription, 200),
    processType: truncate(ctx.processType, 100),
    imageBase64: ctx.imageBase64, // passed directly to vision API — size validated below
  };
}

function sanitiseOcr(ctx: OcrContext): OcrContext {
  return {
    supplierName: truncate(ctx.supplierName, 100),
    documentType: truncate(ctx.documentType, 100),
    imageBase64: ctx.imageBase64,
  };
}

function sanitiseAgenda(ctx: AgendaContext): AgendaContext {
  return {
    supplierName: truncate(ctx.supplierName, 100),
    supplierSite: truncate(ctx.supplierSite, 100),
    auditType: truncate(ctx.auditType, 50),
    auditDates: (ctx.auditDates ?? []).slice(0, 10),
    scope: truncate(ctx.scope, 400),
    leadAuditor: truncate(ctx.leadAuditor, 100),
    auditTeam: (ctx.auditTeam ?? []).slice(0, 10).map((n) => truncate(n, 80)),
    checklistSections: (ctx.checklistSections ?? []).slice(0, 20).map((s) => ({
      title: truncate(s.title, 80),
      questionCount: Math.max(0, Math.min(999, Number(s.questionCount) || 0)),
    })),
    previousFindings: truncate(ctx.previousFindings, 400),
  };
}

function sanitiseChecklistReview(ctx: ChecklistReviewContext): ChecklistReviewContext {
  return {
    checklistName: truncate(ctx.checklistName, 120),
    revision: truncate(ctx.revision, 20),
    sections: (ctx.sections ?? []).slice(0, 20).map((s) => ({
      title: truncate(s.title, 80),
      questions: (s.questions ?? []).slice(0, 50).map((q) => ({
        ref: truncate(q.ref, 20),
        text: truncate(q.text, 200),
        guidance: truncate(q.guidance, 150),
        isMandatory: !!q.isMandatory,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Check API key exists
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "your_openai_api_key_here") {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY is not configured. Add it to .env.local to enable AI suggestions.",
        suggestion: null,
      },
      { status: 503 }
    );
  }

  // Parse and validate request body
  let body: SuggestRequest;
  try {
    body = (await req.json()) as SuggestRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.mode || !body.context) {
    return NextResponse.json({ error: "Missing mode or context" }, { status: 400 });
  }

  // Build prompt and messages — vision modes use image content parts
  type MessageContent = string | { type: string; text?: string; image_url?: { url: string; detail: string } }[];
  interface OAIMessage { role: string; content: MessageContent; }
  let messages: OAIMessage[];
  let maxTokens = 600;

  try {
    switch (body.mode) {
      case "audit_prep": {
        const p = buildAuditPrepPrompt(sanitiseAuditPrep(body.context as AuditPrepContext));
        messages = [{ role: "user", content: p }];
        break;
      }
      case "verification": {
        const p = buildVerificationPrompt(sanitiseVerification(body.context as VerificationContext));
        messages = [{ role: "user", content: p }];
        break;
      }
      case "finding": {
        const p = buildFindingPrompt(sanitiseFinding(body.context as FindingContext));
        messages = [{ role: "user", content: p }];
        break;
      }
      case "daily_summary": {
        const p = buildDailySummaryPrompt(sanitiseDailySummary(body.context as DailySummaryContext));
        messages = [{ role: "user", content: p }];
        maxTokens = 500;
        break;
      }
      case "drawing": {
        const ctx = sanitiseDrawing(body.context as DrawingContext);
        if (!ctx.imageBase64 || ctx.imageBase64.length > 5_000_000) {
          return NextResponse.json({ error: "Image missing or too large (max 3 MB)" }, { status: 400 });
        }
        const p = buildDrawingPrompt(ctx);
        messages = [{
          role: "user",
          content: [
            { type: "text", text: p },
            { type: "image_url", image_url: { url: ctx.imageBase64, detail: "high" } },
          ],
        }];
        maxTokens = 700;
        break;
      }
      case "ocr": {
        const ctx = sanitiseOcr(body.context as OcrContext);
        if (!ctx.imageBase64 || ctx.imageBase64.length > 5_000_000) {
          return NextResponse.json({ error: "Image missing or too large (max 3 MB)" }, { status: 400 });
        }
        const p = buildOcrPrompt(ctx);
        messages = [{
          role: "user",
          content: [
            { type: "text", text: p },
            { type: "image_url", image_url: { url: ctx.imageBase64, detail: "high" } },
          ],
        }];
        maxTokens = 600;
        break;
      }
      case "agenda": {
        const p = buildAgendaPrompt(sanitiseAgenda(body.context as AgendaContext));
        messages = [{ role: "user", content: p }];
        maxTokens = 700;
        break;
      }
      case "checklist_review": {
        const p = buildChecklistReviewPrompt(sanitiseChecklistReview(body.context as ChecklistReviewContext));
        messages = [{ role: "user", content: p }];
        maxTokens = 900;
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Failed to build prompt" }, { status: 400 });
  }

  // Choose model — vision modes use gpt-4o, text-only use gpt-4o-mini
  const isVisionMode = body.mode === "drawing" || body.mode === "ocr";
  const model = isVisionMode ? "gpt-4o" : "gpt-4o-mini";

  // Call OpenAI — API key stays server-side
  let suggestion: string;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a concise, practical procurement quality engineering assistant. " +
              "Your suggestions are advisory only. The auditor makes all final decisions. " +
              "Never fabricate specific standards numbers or document references you are not certain of.",
          },
          ...messages,
        ],
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      // Log server-side only — never expose API error details to client
      console.error("OpenAI API error:", response.status, err.slice(0, 200));
      return NextResponse.json(
        { error: "AI service unavailable. Please try again or proceed without AI suggestions." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    suggestion = data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    console.error("OpenAI fetch error:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Failed to reach AI service. Check your internet connection." },
      { status: 502 }
    );
  }

  // Return with mandatory AI labelling
  return NextResponse.json({
    suggestion,
    label: "AI SUGGESTION — NOT AUDITOR APPROVED",
    disclaimer:
      "This text was generated by AI (GPT-4o-mini) and has not been verified. " +
      "It is for reference only. The auditor must independently assess all evidence and conclusions. " +
      "AI suggestions have no effect on any approval, finding, or qualification decision.",
  });
}
