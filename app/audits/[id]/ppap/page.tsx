"use client";
/**
 * app/audits/[id]/ppap/page.tsx — PPAP Evidence Review
 *
 * Two tabs:
 *  1. Part Submissions — upload multiple supplier PPAP Excel files (one per
 *     part number), run AI batch review, view per-part summary dashboard,
 *     accept/reject with explicit auditor action. Persisted to IndexedDB.
 *  2. Element Checklist — manual 18-element review for the overall audit
 *     (unchanged from original).
 *
 * AI cannot accept PPAP evidence. Auditor decision is always explicit.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Workbook } from "exceljs";
import { getAudit, getEvidenceByAudit, getPpapReviewsByAudit, savePpapReview, deletePpapReview } from "@/lib/storage/db";
import { getAuditorName } from "@/lib/storage/localStorage";
import { nanoid } from "@/lib/utils/nanoid";
import { getPpapReviewSuggestion, isAIError } from "@/lib/aiSuggest";
import type { Audit, Evidence, PpapPartReview, PpapPartRisk } from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import EvidenceUpload from "@/components/EvidenceUpload";
import LoadingSpinner from "@/components/LoadingSpinner";
import AISuggestionBox from "@/components/AISuggestionBox";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PPAP_ELEMENTS = [
  { id: "1",  title: "Design Records",                    description: "Drawings, CAD data, change notices, and revision levels" },
  { id: "2",  title: "Authorised Engineering Change",     description: "Customer-authorised design change documents" },
  { id: "3",  title: "Customer Engineering Approval",     description: "Engineering sign-off for deviations or changes" },
  { id: "4",  title: "Design FMEA (DFMEA)",              description: "Design failure mode and effects analysis" },
  { id: "5",  title: "Process Flow Diagram",              description: "Documented manufacturing process flow" },
  { id: "6",  title: "Process FMEA (PFMEA)",             description: "Process failure mode and effects analysis with RPN values" },
  { id: "7",  title: "Control Plan",                      description: "Pre-launch and production control plan" },
  { id: "8",  title: "Measurement System Analysis (MSA)", description: "Gage R&R studies for all measuring equipment" },
  { id: "9",  title: "Dimensional Results",               description: "Results from dimensional inspection of all balloon characteristics" },
  { id: "10", title: "Material / Performance Test Results",description: "Material certificates, CoCs, and test reports" },
  { id: "11", title: "Initial Process Studies (SPC/Cpk)", description: "Statistical process capability — Cpk ≥ 1.67 required for CTF" },
  { id: "12", title: "Qualified Laboratory Documentation", description: "Accreditation certificates for all test laboratories" },
  { id: "13", title: "Appearance Approval Report (AAR)",  description: "Approved appearance sample and AAR form" },
  { id: "14", title: "Sample Production Parts",           description: "Sample parts from production tooling and process" },
  { id: "15", title: "Master Sample",                     description: "Retained master sample signed off by customer" },
  { id: "16", title: "Checking Aids",                     description: "Fixture, gauge, and checking aid records" },
  { id: "17", title: "Customer-Specific Requirements",    description: "Additional customer or OEM-specific PPAP requirements" },
  { id: "18", title: "Part Submission Warrant (PSW)",     description: "Signed PSW — the final customer approval document" },
];

type ElementStatus = "NOT_REQUIRED" | "SUBMITTED" | "REVIEWED" | "ACCEPTED" | "REJECTED";

const STATUS_OPTIONS: { value: ElementStatus; label: string; colour: string }[] = [
  { value: "NOT_REQUIRED", label: "Not Required", colour: "text-slate-500" },
  { value: "SUBMITTED",    label: "Submitted",    colour: "text-blue-600" },
  { value: "REVIEWED",     label: "Reviewed",     colour: "text-amber-600" },
  { value: "ACCEPTED",     label: "✓ Accepted",   colour: "text-green-700" },
  { value: "REJECTED",     label: "✕ Rejected",   colour: "text-red-600" },
];

const STATUS_BG: Record<ElementStatus, string> = {
  NOT_REQUIRED: "bg-slate-50 border-slate-200",
  SUBMITTED:    "bg-blue-50 border-blue-200",
  REVIEWED:     "bg-amber-50 border-amber-200",
  ACCEPTED:     "bg-green-50 border-green-200",
  REJECTED:     "bg-red-50 border-red-200",
};

const RISK_CONFIG: Record<PpapPartRisk, { label: string; bg: string; border: string; text: string; dot: string }> = {
  GREEN: { label: "🟢 Complete",   bg: "bg-green-50",  border: "border-green-300",  text: "text-green-800",  dot: "bg-green-500" },
  AMBER: { label: "🟡 Gaps Found", bg: "bg-amber-50",  border: "border-amber-300",  text: "text-amber-800",  dot: "bg-amber-400" },
  RED:   { label: "🔴 Critical",   bg: "bg-red-50",    border: "border-red-300",    text: "text-red-800",    dot: "bg-red-500"   },
};

// ---------------------------------------------------------------------------
// Excel text extractor
// ---------------------------------------------------------------------------

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    // Rich text — join all text runs (handles Chinese unicode correctly)
    if ("richText" in (v as object)) {
      return ((v as { richText: { text: string }[] }).richText)
        .map((r) => r.text ?? "").join("").trim();
    }
    // Formula with result
    if ("result" in (v as object)) {
      const res = (v as { result: unknown }).result;
      return cellToString(res);
    }
    // Shared string / hyperlink
    if ("text" in (v as object)) {
      return String((v as { text: unknown }).text ?? "").trim();
    }
    // Date object
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

async function extractExcelText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const wb = new Workbook();
  await wb.xlsx.load(buffer);

  const lines: string[] = [];

  // List all sheet names first so AI knows what documents exist
  const sheetNames = wb.worksheets.map((ws) => ws.name);
  lines.push(`WORKSHEETS IN THIS FILE: ${sheetNames.join(" | ")}`);
  lines.push("");

  wb.worksheets.forEach((ws) => {
    lines.push(`=== Sheet: ${ws.name} ===`);
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells = (row.values as unknown[])
        .slice(1) // values[0] is always undefined in exceljs
        .map(cellToString)
        .filter((s) => s !== "");
      if (cells.length > 0) lines.push(cells.join(" | "));
    });
    lines.push(""); // blank line between sheets
  });

  return lines.join("\n");
}

/** Derive a part number from the filename (strip extension, normalise) */
function partNumberFromFileName(name: string): string {
  return name.replace(/\.(xlsx?|xls)$/i, "").replace(/[-_]+/g, " ").trim() || name;
}

/** Parse overall risk from AI suggestion text */
function parseRiskFromSuggestion(text: string): PpapPartRisk {
  if (/🔴\s*RED|RED —|critical elements missing/i.test(text)) return "RED";
  if (/🟡\s*AMBER|AMBER —|gaps found/i.test(text)) return "AMBER";
  if (/🟢\s*GREEN|GREEN —|appears complete/i.test(text)) return "GREEN";
  return "AMBER"; // default to amber if unclear
}

/** Parse PSW status from suggestion */
function parsePswFromSuggestion(text: string): string {
  const m = text.match(/PSW STATUS[\s\S]{0,200}/i);
  if (!m) return "Unknown";
  const line = m[0].split("\n").slice(0, 3).join(" ");
  return line.replace(/PSW STATUS\s*/i, "").slice(0, 80).trim() || "Unknown";
}

/** Parse Cpk summary from suggestion */
function parseCpkFromSuggestion(text: string): string {
  const m = text.match(/CP[Kk][\s/]CAPABILITY SUMMARY[\s\S]{0,300}/i);
  if (!m) return "";
  return m[0].split("\n").slice(1, 4).join(" ").trim().slice(0, 120);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ElementState { status: ElementStatus; notes: string; }

export default function PPAPPage() {
  const { id: auditId } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"parts" | "elements">("parts");

  // ── Part Submissions state ─────────────────────────────────────────────
  const [partReviews, setPartReviews] = useState<PpapPartReview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [expandedPart, setExpandedPart] = useState<string | null>(null);
  const [reviewingAll, setReviewingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Manual element checklist state ────────────────────────────────────
  const [elements, setElements] = useState<Map<string, ElementState>>(
    new Map(PPAP_ELEMENTS.map((e) => [e.id, { status: "NOT_REQUIRED", notes: "" }]))
  );
  const [expandedElement, setExpandedElement] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const a = await getAudit(auditId);
      if (!a) { setLoading(false); return; }
      setAudit(a);
      const [ev, reviews] = await Promise.all([
        getEvidenceByAudit(auditId),
        getPpapReviewsByAudit(auditId),
      ]);
      setEvidence(ev);
      setPartReviews(reviews.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)));
      setLoading(false);
    }
    load();
  }, [auditId]);

  // ── File upload handler ────────────────────────────────────────────────

  async function handleFilesSelected(files: FileList) {
    if (!audit || files.length === 0) return;
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Reading ${i + 1} of ${files.length}: ${file.name}…`);

      try {
        const extractedText = await extractExcelText(file);
        const partNumber = partNumberFromFileName(file.name);
        const review: PpapPartReview = {
          id: nanoid(),
          auditId,
          partNumber,
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          extractedText,
          aiSuggestion: null,
          aiGeneratedAt: null,
          elementResults: [],
          overallRisk: "AMBER",
          cpkValues: "",
          pswStatus: "",
          auditorDecision: "PENDING",
          auditorNotes: "",
          decidedAt: null,
          decidedBy: "",
        };
        await savePpapReview(review);
        setPartReviews((prev) => [...prev, review]);
      } catch (e) {
        console.error(`Failed to read ${file.name}:`, e);
      }
    }

    setUploadProgress("");
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── AI review — single part ────────────────────────────────────────────

  async function runAiReview(review: PpapPartReview) {
    if (!audit) return;
    // Optimistically mark as in-progress
    setPartReviews((prev) => prev.map((r) =>
      r.id === review.id ? { ...r, aiSuggestion: null } : r
    ));

    const result = await getPpapReviewSuggestion({
      supplierName: audit.supplierName,
      partNumber: review.partNumber,
      fileName: review.fileName,
      extractedText: review.extractedText,
    });

    const updated: PpapPartReview = isAIError(result)
      ? { ...review, aiSuggestion: `Error: ${result.error}`, aiGeneratedAt: new Date().toISOString(), overallRisk: "AMBER" }
      : {
          ...review,
          aiSuggestion: result.suggestion,
          aiGeneratedAt: new Date().toISOString(),
          overallRisk: parseRiskFromSuggestion(result.suggestion),
          pswStatus: parsePswFromSuggestion(result.suggestion),
          cpkValues: parseCpkFromSuggestion(result.suggestion),
        };

    await savePpapReview(updated);
    setPartReviews((prev) => prev.map((r) => r.id === updated.id ? updated : r));
  }

  // ── AI review — all pending parts ─────────────────────────────────────

  async function runAllAiReviews() {
    const pending = partReviews.filter((r) => !r.aiSuggestion);
    if (pending.length === 0) return;
    setReviewingAll(true);
    for (const r of pending) {
      await runAiReview(r);
    }
    setReviewingAll(false);
  }

  // ── Auditor decision ───────────────────────────────────────────────────

  async function handleDecision(review: PpapPartReview, decision: "ACCEPTED" | "REJECTED") {
    const label = decision === "ACCEPTED" ? "Accept" : "Reject";
    const msg = decision === "ACCEPTED"
      ? `Accept PPAP submission for:\n${review.partNumber}\n\nThis confirms you have reviewed the AI analysis and all evidence meets requirements.`
      : `Reject PPAP submission for:\n${review.partNumber}\n\nThe supplier will need to re-submit with corrections.`;
    if (!confirm(`${label} PPAP?\n\n${msg}`)) return;

    const auditorName = getAuditorName();
    const updated: PpapPartReview = {
      ...review,
      auditorDecision: decision,
      decidedAt: new Date().toISOString(),
      decidedBy: auditorName,
    };
    await savePpapReview(updated);
    setPartReviews((prev) => prev.map((r) => r.id === updated.id ? updated : r));
  }

  async function updatePartNotes(review: PpapPartReview, notes: string) {
    const updated = { ...review, auditorNotes: notes };
    setPartReviews((prev) => prev.map((r) => r.id === updated.id ? updated : r));
    await savePpapReview(updated);
  }

  async function handleReExtract(review: PpapPartReview, file: File) {
    try {
      const extractedText = await extractExcelText(file);
      const updated: PpapPartReview = {
        ...review,
        extractedText,
        // Clear old AI result so it gets re-reviewed with new text
        aiSuggestion: null,
        aiGeneratedAt: null,
        overallRisk: "AMBER",
        cpkValues: "",
        pswStatus: "",
      };
      await savePpapReview(updated);
      setPartReviews((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      // Auto-run AI review with fresh text
      await runAiReview(updated);
    } catch (e) {
      console.error("Re-extract failed:", e);
    }
  }

  async function handleDeletePart(id: string) {
    if (!confirm("Remove this part submission?")) return;
    await deletePpapReview(id);
    setPartReviews((prev) => prev.filter((r) => r.id !== id));
  }

  // ── Manual element checklist helpers ──────────────────────────────────

  function updateElement(id: string, field: keyof ElementState, value: string) {
    setElements((prev) => {
      const next = new Map(prev);
      next.set(id, { ...prev.get(id)!, [field]: value });
      return next;
    });
  }

  const handleEvidenceAdded = useCallback((ev: Evidence) => {
    setEvidence((prev) => [...prev, ev]);
  }, []);

  // ── Summary stats ──────────────────────────────────────────────────────

  const accepted  = [...elements.values()].filter((e) => e.status === "ACCEPTED").length;
  const rejected  = [...elements.values()].filter((e) => e.status === "REJECTED").length;
  const required  = PPAP_ELEMENTS.length - [...elements.values()].filter((e) => e.status === "NOT_REQUIRED").length;
  const partsGreen = partReviews.filter((r) => r.overallRisk === "GREEN").length;
  const partsAmber = partReviews.filter((r) => r.overallRisk === "AMBER").length;
  const partsRed   = partReviews.filter((r) => r.overallRisk === "RED").length;
  const partsReviewed = partReviews.filter((r) => !!r.aiSuggestion).length;

  if (loading) return <LoadingSpinner />;
  if (!audit) return <div className="text-center py-16 text-slate-500">Audit not found. <Link href="/audits" className="text-blue-600 hover:underline">Back</Link></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="PPAP Evidence Review"
        subtitle={`${audit.supplierName} — 18 PPAP Elements`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Audits", href: "/audits" },
          { label: audit.supplierName, href: `/audits/${auditId}` },
          { label: "PPAP" },
        ]}
      />

      <div className="ai-suggestion-block">
        <strong>Human approval required:</strong> Each PPAP element and every part submission must be
        individually reviewed and accepted by the auditor. AI analysis is advisory only — it cannot
        accept PPAP evidence or approve production parts.
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-slate-200">
        {([["parts", "📦 Part Submissions"], ["elements", "☑ 18-Element Checklist"]] as const).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-600 text-blue-700 bg-blue-50"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — PART SUBMISSIONS                                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "parts" && (
        <div className="space-y-5">

          {/* Summary strip */}
          {partReviews.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Parts uploaded",  value: partReviews.length,  colour: "text-slate-700" },
                { label: "AI reviewed",     value: partsReviewed,       colour: "text-blue-600"  },
                { label: "🟢 Complete",     value: partsGreen,          colour: "text-green-700" },
                { label: "🟡 Gaps",         value: partsAmber,          colour: "text-amber-600" },
                { label: "🔴 Critical",     value: partsRed,            colour: "text-red-600"   },
              ].map((s) => (
                <Card key={s.label} className="text-center py-3">
                  <div className={`text-2xl font-bold ${s.colour}`}>{s.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                </Card>
              ))}
            </div>
          )}

          {/* Upload + batch review controls */}
          <Card title="Upload Supplier PPAP Files">
            <p className="text-xs text-slate-500 mb-3">
              Upload one Excel file per part number. You can select multiple files at once.
              The app reads all worksheets, then AI reviews each against all 18 PPAP elements.
              Results are saved so you can close the browser and continue later.
            </p>
            <div className="flex flex-wrap gap-2">
              <label className={`cursor-pointer inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded text-white ${uploading ? "bg-slate-400" : "bg-blue-600 hover:bg-blue-700"}`}>
                {uploading ? `⏳ ${uploadProgress || "Reading files…"}` : "📂 Upload PPAP Excel Files"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { if (e.target.files?.length) handleFilesSelected(e.target.files); }}
                />
              </label>

              {partReviews.some((r) => !r.aiSuggestion) && !reviewingAll && (
                <button
                  type="button"
                  onClick={runAllAiReviews}
                  className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded text-white bg-purple-600 hover:bg-purple-700"
                >
                  ✦ AI Review All ({partReviews.filter((r) => !r.aiSuggestion).length} pending)
                </button>
              )}
              {reviewingAll && (
                <span className="inline-flex items-center gap-2 text-sm text-purple-700 px-3 py-2">
                  <span className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin inline-block" />
                  Reviewing parts…
                </span>
              )}
            </div>
          </Card>

          {/* Parts list */}
          {partReviews.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
              No part files uploaded yet. Upload the supplier&apos;s PPAP Excel files above.
            </div>
          )}

          {partReviews.map((review) => {
            const risk = RISK_CONFIG[review.overallRisk];
            const isExpanded = expandedPart === review.id;
            const decisionColour = review.auditorDecision === "ACCEPTED"
              ? "text-green-700 bg-green-50 border-green-300"
              : review.auditorDecision === "REJECTED"
              ? "text-red-700 bg-red-50 border-red-300"
              : "text-slate-600 bg-slate-50 border-slate-200";

            return (
              <div key={review.id} className={`border rounded-lg overflow-hidden ${risk.border} ${risk.bg}`}>
                {/* Part header row */}
                <button
                  type="button"
                  onClick={() => setExpandedPart(isExpanded ? null : review.id)}
                  className="w-full flex items-center justify-between p-3 text-left gap-3 hover:opacity-90"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${risk.dot}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">{review.partNumber}</div>
                      <div className="text-xs text-slate-400">{review.fileName}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {review.aiSuggestion && (
                      <span className={`text-xs font-semibold ${risk.text}`}>{risk.label}</span>
                    )}
                    {!review.aiSuggestion && !reviewingAll && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); runAiReview(review); }}
                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded"
                      >
                        ✦ AI Review
                      </button>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${decisionColour}`}>
                      {review.auditorDecision}
                    </span>
                    <span className="text-slate-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-white p-4 space-y-4">

                    {/* Quick stats if reviewed */}
                    {review.aiSuggestion && (review.pswStatus || review.cpkValues) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {review.pswStatus && (
                          <div className="bg-slate-50 border border-slate-200 rounded p-2 text-xs">
                            <span className="font-medium text-slate-600">PSW: </span>
                            <span className="text-slate-700">{review.pswStatus}</span>
                          </div>
                        )}
                        {review.cpkValues && (
                          <div className="bg-slate-50 border border-slate-200 rounded p-2 text-xs">
                            <span className="font-medium text-slate-600">Cpk: </span>
                            <span className="text-slate-700">{review.cpkValues}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Extracted text preview + re-extract */}
                    <details className="border border-slate-200 rounded">
                      <summary className="text-xs text-slate-500 cursor-pointer px-3 py-2 hover:bg-slate-50 flex items-center justify-between">
                        <span>🔍 View extracted text ({review.extractedText.length} chars) — verify Chinese content is captured</span>
                      </summary>
                      <div className="p-3 space-y-2">
                        <pre className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded p-2 max-h-48 overflow-y-auto border border-slate-200">
                          {review.extractedText.slice(0, 2000)}{review.extractedText.length > 2000 ? "\n…(truncated)" : ""}
                        </pre>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">If Chinese content is missing above, re-extract the file:</span>
                          <label className="cursor-pointer text-xs bg-slate-600 hover:bg-slate-700 text-white px-2 py-1 rounded">
                            🔄 Re-extract & Re-review
                            <input
                              type="file"
                              accept=".xlsx,.xls"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleReExtract(review, f);
                                if (e.target) e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </details>

                    {/* AI review result */}
                    <AISuggestionBox
                      suggestion={review.aiSuggestion}
                      loading={!review.aiSuggestion && reviewingAll}
                      error={null}
                      onRequest={() => runAiReview(review)}
                      buttonLabel="✦ Run AI Review"
                    />

                    {/* Auditor notes */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Auditor Notes</label>
                      <textarea
                        rows={2}
                        value={review.auditorNotes}
                        onChange={(e) => updatePartNotes(review, e.target.value)}
                        placeholder="Record your observations, concerns, or required follow-up…"
                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Decision buttons — explicit auditor action only */}
                    <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-slate-100">
                      <span className="text-xs font-medium text-slate-500 mr-1">Auditor decision:</span>
                      {review.auditorDecision !== "ACCEPTED" && (
                        <button
                          type="button"
                          onClick={() => handleDecision(review, "ACCEPTED")}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded font-medium"
                        >
                          ✓ Accept PPAP
                        </button>
                      )}
                      {review.auditorDecision !== "REJECTED" && (
                        <button
                          type="button"
                          onClick={() => handleDecision(review, "REJECTED")}
                          className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-medium"
                        >
                          ✕ Reject PPAP
                        </button>
                      )}
                      {review.decidedAt && (
                        <span className="text-xs text-slate-400 ml-1">
                          by {review.decidedBy || "auditor"} · {new Date(review.decidedAt).toLocaleDateString()}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeletePart(review.id)}
                        className="text-xs text-red-400 hover:text-red-600 underline ml-auto"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB 2 — 18-ELEMENT CHECKLIST                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "elements" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Accepted", value: accepted, colour: "text-green-600" },
              { label: "Rejected", value: rejected, colour: "text-red-600" },
              { label: "Required", value: required, colour: "text-slate-700" },
            ].map((s) => (
              <Card key={s.label} className="text-center">
                <div className={`text-3xl font-bold ${s.colour}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </Card>
            ))}
          </div>

          {/* PSW banner */}
          {elements.get("18")?.status === "ACCEPTED" && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-4 text-green-800 font-semibold text-sm">
              ✓ Part Submission Warrant (PSW) accepted — PPAP submission complete
            </div>
          )}

          {/* Elements */}
          <div className="space-y-2">
            {PPAP_ELEMENTS.map((el) => {
              const state = elements.get(el.id)!;
              const isExp = expandedElement === el.id;
              const elEvidence = evidence.filter((e) => e.linkedTo.some((l) => l.targetId === `ppap-${auditId}-${el.id}`));

              return (
                <div key={el.id} className={`border rounded-lg overflow-hidden ${STATUS_BG[state.status]}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedElement(isExp ? null : el.id)}
                    className="w-full flex items-center justify-between p-3 text-left hover:opacity-80 gap-3"
                    aria-expanded={isExp}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-slate-400 shrink-0 w-6 font-mono">{el.id}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800">{el.title}</div>
                        <div className="text-xs text-slate-500 hidden sm:block">{el.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {elEvidence.length > 0 && <span className="text-xs text-blue-600">📎 {elEvidence.length}</span>}
                      <span className={`text-xs font-semibold ${STATUS_OPTIONS.find((s) => s.value === state.status)?.colour}`}>
                        {STATUS_OPTIONS.find((s) => s.value === state.status)?.label}
                      </span>
                      <span className="text-slate-400">{isExp ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {isExp && (
                    <div className="border-t border-slate-200 p-4 space-y-3 bg-white">
                      <p className="text-xs text-slate-500 italic">{el.description}</p>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                        <div className="flex flex-wrap gap-2">
                          {STATUS_OPTIONS.map((s) => (
                            <label key={s.value} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`ppap-status-${el.id}`}
                                value={s.value}
                                checked={state.status === s.value}
                                onChange={() => {
                                  if (s.value === "ACCEPTED") {
                                    const elem = PPAP_ELEMENTS.find((e) => e.id === el.id);
                                    if (!confirm(`Accept PPAP element: ${elem?.title}?\n\nConfirms evidence meets requirements.`)) return;
                                  }
                                  updateElement(el.id, "status", s.value);
                                }}
                                className="accent-blue-600"
                              />
                              <span className={`text-xs ${s.colour}`}>{s.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Auditor Notes</label>
                        <textarea
                          rows={2}
                          value={state.notes}
                          onChange={(e) => updateElement(el.id, "notes", e.target.value)}
                          placeholder="Record observations, concerns, or document references…"
                          className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Evidence</label>
                        <EvidenceUpload
                          auditId={auditId}
                          link={{ type: "QUESTION", targetId: `ppap-${auditId}-${el.id}` }}
                          existingEvidence={elEvidence}
                          onAdded={handleEvidenceAdded}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-2">
        <Link href={`/audits/${auditId}`} className="text-sm text-slate-600 hover:underline">← Back to Audit</Link>
      </div>
    </div>
  );
}
