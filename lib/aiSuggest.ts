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

export interface AgendaContext {
  supplierName: string;
  supplierSite: string;
  auditType: string;
  auditDates: string[];
  scope: string;
  leadAuditor: string;
  auditTeam: string[];
  checklistSections: { title: string; questionCount: number }[];
  previousFindings: string;
  /** Optional draft agenda text uploaded by the auditor — AI will refine and expand it */
  draftAgenda?: string;
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

export interface SupplierReviewContext {
  supplierName: string;
  supplierSite: string;
  checklistName: string;
  sections: {
    section: string;
    questions: {
      no: string;
      question: string;
      answer: string;
      comment: string;
      highlighted: boolean;
    }[];
  }[];
  totalQuestions: number;
  totalY: number;
  totalN: number;
  totalNA: number;
  totalNoAnswer: number;
  totalHighlighted: number;
}

export interface PpapReviewContext {
  supplierName: string;
  partNumber: string;
  fileName: string;
  extractedText: string;
}

export interface ChecklistReviewContext {
  checklistName: string;
  revision: string;
  sections: { title: string; questions: { ref: string; text: string; guidance: string; isMandatory: boolean }[] }[];
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

export interface SmartNotesContext {
  supplierName: string;
  auditType: string;
  scope?: string;
  transcript: string;
  recentMarkers?: { type: string; text: string; timestamp: string }[];
}

export interface SmartPhotoContext {
  supplierName: string;
  processType?: string;
  scope?: string;
  auditorNote?: string;
  nearestTranscript?: string;
  imageBase64?: string;
}

export interface SmartQuestionsContext {
  supplierName: string;
  auditType: string;
  scope?: string;
  checklistHighlights?: string;
  transcript: string;
}

export interface SmartCoverageContext {
  supplierName: string;
  auditType: string;
  transcript: string;
  checklistQuestions: { id: string; reference: string; text: string }[];
}

export interface SmartSummaryContext {
  supplierName: string;
  supplierSite?: string;
  auditType: string;
  scope?: string;
  durationSec: number;
  transcript: string;
  markers: { type: string; text: string; timestamp: string }[];
  photos: { caption: string; auditorNote?: string; process?: string }[];
  checklistCoverage?: string;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function callAI(
  mode:
    | "audit_prep"
    | "verification"
    | "finding"
    | "daily_summary"
    | "drawing"
    | "ocr"
    | "agenda"
    | "checklist_review"
    | "supplier_review"
    | "ppap_review"
    | "smart_notes"
    | "smart_photo_analysis"
    | "smart_questions"
    | "smart_coverage"
    | "smart_session_summary",
  context:
    | AuditPrepContext
    | VerificationContext
    | FindingContext
    | DailySummaryContext
    | DrawingContext
    | OcrContext
    | AgendaContext
    | ChecklistReviewContext
    | SupplierReviewContext
    | PpapReviewContext
    | SmartNotesContext
    | SmartPhotoContext
    | SmartQuestionsContext
    | SmartCoverageContext
    | SmartSummaryContext
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

export async function getAgendaSuggestion(
  ctx: AgendaContext
): Promise<AISuggestionResponse> {
  return callAI("agenda", ctx);
}

export async function getSupplierReviewSuggestion(
  ctx: SupplierReviewContext
): Promise<AISuggestionResponse> {
  return callAI("supplier_review", ctx);
}

export async function getChecklistReviewSuggestion(
  ctx: ChecklistReviewContext
): Promise<AISuggestionResponse> {
  return callAI("checklist_review", ctx);
}

export async function getPpapReviewSuggestion(
  ctx: PpapReviewContext
): Promise<AISuggestionResponse> {
  return callAI("ppap_review", ctx);
}

export async function getSmartNotesSuggestion(
  ctx: SmartNotesContext
): Promise<AISuggestionResponse> {
  return callAI("smart_notes", ctx);
}

export async function getSmartPhotoSuggestion(
  ctx: SmartPhotoContext
): Promise<AISuggestionResponse> {
  return callAI("smart_photo_analysis", ctx);
}

export async function getSmartQuestionsSuggestion(
  ctx: SmartQuestionsContext
): Promise<AISuggestionResponse> {
  return callAI("smart_questions", ctx);
}

export async function getSmartCoverageSuggestion(
  ctx: SmartCoverageContext
): Promise<AISuggestionResponse> {
  return callAI("smart_coverage", ctx);
}

export async function getSmartSessionSummarySuggestion(
  ctx: SmartSummaryContext
): Promise<AISuggestionResponse> {
  return callAI("smart_session_summary", ctx);
}
