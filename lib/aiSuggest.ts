/**
 * lib/aiSuggest.ts — PQE AI Assistant
 *
 * Client-side fetch wrapper for the secure server-side AI suggestion route.
 *
 * Rules:
 * - Always calls /api/ai/suggest — never calls OpenAI directly from the browser.
 * - Returns a clearly labelled result object.
 * - The caller is responsible for displaying the AI label and disclaimer.
 * - Suggestions must NEVER be written to isApproved, verdict, or any approval field.
 */

export interface AISuggestionResult {
  suggestion: string;
  label: string;
  disclaimer: string;
}

export interface AISuggestionError {
  error: string;
}

export type AISuggestionResponse = AISuggestionResult | AISuggestionError;

export function isAIError(r: AISuggestionResponse): r is AISuggestionError {
  return "error" in r;
}

// ---------------------------------------------------------------------------
// Context types (mirror the server route)
// ---------------------------------------------------------------------------

export interface AuditPrepContext {
  supplierName: string;
  supplierSite: string;
  auditType: string;
  scope: string;
  sections: { title: string; questionCount: number }[];
  previousFindings?: string;
}

export interface VerificationContext {
  questionRef: string;
  questionText: string;
  guidance: string;
  supplierResponse: string;
  supplierStatus: string;
}

export interface FindingContext {
  auditType: string;
  supplierName: string;
  questionRef: string;
  questionText: string;
  auditorNotes: string;
  verdict: string;
}

export interface DailySummaryContext {
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
  keyNotesSnippets: string[];
}

export interface DrawingContext {
  supplierName: string;
  partNumber: string;
  partDescription: string;
  processType: string;
  imageBase64: string;
}

export interface OcrContext {
  supplierName: string;
  documentType: string;
  imageBase64: string;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function callAI(
  mode: "audit_prep" | "verification" | "finding" | "daily_summary" | "drawing" | "ocr",
  context: AuditPrepContext | VerificationContext | FindingContext | DailySummaryContext | DrawingContext | OcrContext
): Promise<AISuggestionResponse> {
  try {
    const res = await fetch("/api/ai/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, context }),
    });
    const data = (await res.json()) as AISuggestionResponse;
    return data;
  } catch {
    return { error: "Network error — could not reach AI service." };
  }
}

export async function getAuditPrepSuggestion(
  ctx: AuditPrepContext
): Promise<AISuggestionResponse> {
  return callAI("audit_prep", ctx);
}

export async function getVerificationSuggestion(
  ctx: VerificationContext
): Promise<AISuggestionResponse> {
  return callAI("verification", ctx);
}

export async function getFindingSuggestion(
  ctx: FindingContext
): Promise<AISuggestionResponse> {
  return callAI("finding", ctx);
}

export async function getDailySummarySuggestion(
  ctx: DailySummaryContext
): Promise<AISuggestionResponse> {
  return callAI("daily_summary", ctx);
}

export async function getDrawingAnalysis(
  ctx: DrawingContext
): Promise<AISuggestionResponse> {
  return callAI("drawing", ctx);
}

export async function getOcrAnalysis(
  ctx: OcrContext
): Promise<AISuggestionResponse> {
  return callAI("ocr", ctx);
}
