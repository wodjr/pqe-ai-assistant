"use client";
/**
 * app/audits/[id]/page.tsx — Audit detail / hub
 * Central navigation page for a specific audit.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getAudit,
  saveAudit,
  getChecklist,
  getSupplierResponsesByAudit,
  getVerificationsByAudit,
  getFindingsByAudit,
  getCARsByAudit,
  deleteAuditCascade,
} from "@/lib/storage/db";
import { setCurrentAuditId } from "@/lib/storage/localStorage";
import { exportAuditToJson } from "@/lib/exportBackup";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { getAuditPrepSuggestion, getDailySummarySuggestion, getAgendaSuggestion, getSupplierReviewSuggestion, isAIError } from "@/lib/aiSuggest";
import { parseSupplierExcel } from "@/lib/parseSupplierExcel";
import type { Audit, ChecklistTemplate } from "@/types/project";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import StatusBadge from "@/components/StatusBadge";
import LoadingSpinner from "@/components/LoadingSpinner";
import AISuggestionBox from "@/components/AISuggestionBox";

export default function AuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [checklist, setChecklist] = useState<ChecklistTemplate | null>(null);
  const [stats, setStats] = useState({ responses: 0, verified: 0, findings: 0, cars: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // AI Audit Prep
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // AI Daily Summary
  const [dailySuggestion, setDailySuggestion] = useState<string | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [auditDay, setAuditDay] = useState(1);
  // AI Agenda
  const [agendaSuggestion, setAgendaSuggestion] = useState<string | null>(null);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaError, setAgendaError] = useState<string | null>(null);
  // AI Supplier Response Review
  const [supplierFile, setSupplierFile] = useState<File | null>(null);
  const [supplierParsing, setSupplierParsing] = useState(false);
  const [supplierParseError, setSupplierParseError] = useState<string | null>(null);
  const [supplierStats, setSupplierStats] = useState<{ total: number; y: number; n: number; na: number; noAnswer: number; highlighted: number } | null>(null);
  const [supplierReviewSuggestion, setSupplierReviewSuggestion] = useState<string | null>(null);
  const [supplierReviewLoading, setSupplierReviewLoading] = useState(false);
  const [supplierReviewError, setSupplierReviewError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const a = await getAudit(id);
      if (!a) { setLoading(false); return; }
      setAudit(a);
      setCurrentAuditId(id);
      const [cl, sr, vr, fi, ca] = await Promise.all([
        getChecklist(a.checklistTemplateId),
        getSupplierResponsesByAudit(id),
        getVerificationsByAudit(id),
        getFindingsByAudit(id),
        getCARsByAudit(id),
      ]);
      setChecklist(cl ?? null);
      setStats({ responses: sr.length, verified: vr.filter((v) => v.isApproved).length, findings: fi.length, cars: ca.length });
      setLoading(false);
    }
    load();
  }, [id]);

  async function updateStatus(status: Audit["status"]) {
    if (!audit) return;
    setSaving(true);
    const updated = { ...audit, status, updatedAt: new Date().toISOString() };
    await saveAudit(updated);
    setAudit(updated);
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Permanently delete this audit and all its data? This cannot be undone.")) return;
    await deleteAuditCascade(id);
    router.push("/audits");
  }

  async function handleExport() {
    try {
      await exportAuditToJson(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Export failed");
    }
  }

  async function handleAuditPrep() {
    if (!audit || !checklist) return;
    setAiLoading(true);
    setAiError(null);
    const result = await getAuditPrepSuggestion({
      supplierName: audit.supplierName,
      supplierSite: audit.supplierSite,
      auditType: audit.auditType.replace(/_/g, " "),
      scope: audit.scope,
      sections: checklist.sections.map((s) => ({
        title: s.title,
        questionCount: s.questions.length,
      })),
    });
    if (isAIError(result)) {
      setAiError(result.error);
    } else {
      setAiSuggestion(result.suggestion);
    }
    setAiLoading(false);
  }

  if (loading) return <LoadingSpinner />;
  if (!audit)
    return (
      <div className="text-center py-16 text-slate-500">
        Audit not found.{" "}
        <Link href="/audits" className="text-blue-600 hover:underline">Back to Audits</Link>
      </div>
    );

  async function handleAgenda() {
    if (!audit || !checklist) return;
    setAgendaLoading(true);
    setAgendaError(null);
    const result = await getAgendaSuggestion({
      supplierName: audit.supplierName,
      supplierSite: audit.supplierSite,
      auditType: audit.auditType.replace(/_/g, " "),
      auditDates: audit.auditDates,
      scope: audit.scope,
      leadAuditor: audit.leadAuditor,
      auditTeam: audit.auditTeam,
      checklistSections: checklist.sections.map((s) => ({
        title: s.title,
        questionCount: s.questions.length,
      })),
      previousFindings: "",
    });
    if (isAIError(result)) {
      setAgendaError(result.error);
    } else {
      setAgendaSuggestion(result.suggestion);
    }
    setAgendaLoading(false);
  }

  async function handleDailySummary() {
    if (!audit || !checklist) return;
    setDailyLoading(true);
    setDailyError(null);
    const totalQ = checklist.sections.reduce((n, s) => n + s.questions.length, 0);
    const result = await getDailySummarySuggestion({
      supplierName: audit.supplierName,
      auditType: audit.auditType.replace(/_/g, " "),
      day: auditDay,
      totalDays: audit.auditDates.length || 1,
      verifiedCount: stats.verified,
      totalQuestions: totalQ,
      majorFindings: 0, // summary context — auditor knows the actual numbers
      minorFindings: 0,
      observations: 0,
      openCARs: stats.cars,
      keyNotesSnippets: [],
    });
    if (isAIError(result)) {
      setDailyError(result.error);
    } else {
      setDailySuggestion(result.suggestion);
    }
    setDailyLoading(false);
  }

  async function handleSupplierFileUpload(file: File) {
    setSupplierFile(file);
    setSupplierParsing(true);
    setSupplierParseError(null);
    setSupplierStats(null);
    setSupplierReviewSuggestion(null);
    setSupplierReviewError(null);
    try {
      const parsed = await parseSupplierExcel(file);
      const total = parsed.rows.length;
      const y = parsed.rows.filter((r) => r.answer === "Y").length;
      const n = parsed.rows.filter((r) => r.answer === "N").length;
      const na = parsed.rows.filter((r) => r.answer === "N/A").length;
      const noAnswer = parsed.rows.filter((r) => r.answer === "").length;
      const highlighted = parsed.rows.filter((r) => r.highlighted).length;
      setSupplierStats({ total, y, n, na, noAnswer, highlighted });

      // Group rows by section for the AI context
      const sectionMap = new Map<string, typeof parsed.rows>();
      for (const row of parsed.rows) {
        const existing = sectionMap.get(row.section) ?? [];
        existing.push(row);
        sectionMap.set(row.section, existing);
      }
      const sections = Array.from(sectionMap.entries()).map(([section, rows]) => ({
        section,
        questions: rows.map((r) => ({
          no: r.questionNo,
          question: r.questionText,
          answer: r.answer,
          comment: r.comment,
          highlighted: r.highlighted,
        })),
      }));

      setSupplierParsing(false);

      // Auto-trigger AI review
      setSupplierReviewLoading(true);
      const result = await getSupplierReviewSuggestion({
        supplierName: audit?.supplierName ?? "",
        supplierSite: audit?.supplierSite ?? "",
        checklistName: file.name.replace(/\.xlsx?$/i, ""),
        sections,
        totalQuestions: total,
        totalY: y,
        totalN: n,
        totalNA: na,
        totalNoAnswer: noAnswer,
        totalHighlighted: highlighted,
      });
      if (isAIError(result)) {
        setSupplierReviewError(result.error);
      } else {
        setSupplierReviewSuggestion(result.suggestion);
      }
      setSupplierReviewLoading(false);
    } catch (e) {
      setSupplierParseError(e instanceof Error ? e.message : "Failed to parse Excel file. Check the file format.");
      setSupplierParsing(false);
    }
  }

  const workflowSteps = [
    { label: "Supplier Self-Assessment", href: `/audits/${id}/supplier`, description: `${stats.responses} responses recorded`, icon: "📝" },
    { label: "Auditor Verification", href: `/audits/${id}/verify`, description: `${stats.verified} items verified`, icon: "✅" },
    { label: "Findings", href: `/findings?auditId=${id}`, description: `${stats.findings} findings`, icon: "🔍" },
    { label: "CARs", href: `/cars?auditId=${id}`, description: `${stats.cars} corrective actions`, icon: "📋" },
    { label: "Generate Report", href: `/audits/${id}/report`, description: "Print-ready HTML report", icon: "📄" },
  ];

  const auditTools = [
    { label: "Voice Recording",    href: `/audits/${id}/voice`,         description: "Record and transcribe conversations", icon: "🎙" },
    { label: "Document OCR",       href: `/audits/${id}/ocr`,           description: "Photograph and analyse documents",   icon: "🔬" },
    { label: "Drawing Analysis",   href: `/audits/${id}/drawing`,       description: "Identify CTF characteristics",       icon: "📐" },
    { label: "PPAP Review",        href: `/audits/${id}/ppap`,          description: "18 PPAP elements checklist",         icon: "📋" },
    { label: "Evidence Trace",     href: `/audits/${id}/trace`,         description: "CTF vertical traceability chain",    icon: "🔗" },
    { label: "Qualification",      href: `/audits/${id}/qualification`, description: "APPROVE / CONDITIONAL / REJECT",     icon: "🏅" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={audit.supplierName}
        subtitle={`${audit.supplierSite} · ${audit.auditType.replace(/_/g, " ")}`}
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Audits", href: "/audits" }, { label: audit.supplierName }]}
        action={
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleExport} className="text-xs border border-slate-300 text-slate-600 px-3 py-1.5 rounded hover:bg-slate-50">
              Export JSON
            </button>
            <button onClick={handleDelete} className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded hover:bg-red-50">
              Delete
            </button>
          </div>
        }
      />

      {/* Audit info */}
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div><span className="text-slate-500">Status:</span> <StatusBadge variant={audit.status} className="ml-1" /></div>
          <div><span className="text-slate-500">Lead Auditor:</span> <span className="font-medium ml-1">{audit.leadAuditor}</span></div>
          <div><span className="text-slate-500">Dates:</span> <span className="font-medium ml-1">{audit.auditDates.map(formatDate).join(", ")}</span></div>
          <div><span className="text-slate-500">Checklist:</span> <span className="font-medium ml-1">{checklist?.name ?? "—"} Rev {audit.checklistRevision}</span></div>
          <div><span className="text-slate-500">Contact:</span> <span className="font-medium ml-1">{audit.supplierContact || "—"}</span></div>
          <div><span className="text-slate-500">Updated:</span> <span className="ml-1 text-slate-400 text-xs">{formatDateTime(audit.updatedAt)}</span></div>
        </div>
        {audit.scope && (
          <div className="mt-3 text-sm text-slate-600">
            <span className="font-medium">Scope:</span> {audit.scope}
          </div>
        )}
      </Card>

      {/* Status controls */}
      <Card title="Audit Status">
        <div className="flex flex-wrap gap-2">
          {(["DRAFT", "IN_PROGRESS", "PENDING_APPROVAL", "CLOSED"] as const).map((s) => (
            <button
              key={s}
              disabled={saving || audit.status === s}
              onClick={() => updateStatus(s)}
              className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${audit.status === s ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"} disabled:opacity-50`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Note: Closing an audit does not prevent further edits. Only the final signed report constitutes an approved quality record.
        </p>
      </Card>

      {/* Workflow steps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {workflowSteps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="block bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className="text-2xl mb-2">{step.icon}</div>
            <div className="font-semibold text-slate-700">{step.label}</div>
            <div className="text-xs text-slate-400 mt-1">{step.description}</div>
          </Link>
        ))}
      </div>

      {/* Agenda */}
      {audit.agenda && (
        <Card title="Agenda">
          <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">{audit.agenda}</pre>
        </Card>
      )}

      {/* AI tools */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-3">Onsite AI Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {auditTools.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="block bg-white border border-amber-200 rounded-lg p-4 hover:shadow-md hover:border-amber-400 transition-all"
            >
              <div className="text-xl mb-1">{t.icon}</div>
              <div className="font-semibold text-slate-700 text-sm">{t.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{t.description}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── AI Supplier Response Review ────────────────────────────────── */}
      <Card title="✦ AI Pre-Audit Briefing — Supplier Response Review">
        <p className="text-xs text-slate-500 mb-3">
          Upload the completed supplier self-assessment Excel. The AI reads every answer across
          all tabs — flags every N and N/A, reviews comments, highlights highlighted rows, and
          produces a prioritised pre-audit briefing with specific questions to ask onsite.
        </p>

        {/* Upload button */}
        {!supplierFile && !supplierParsing && (
          <label className="cursor-pointer inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded">
            📂 Upload Supplier-Completed Checklist (.xlsx)
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleSupplierFileUpload(f);
                if (e.target) e.target.value = "";
              }}
            />
          </label>
        )}

        {/* Parsing spinner */}
        {supplierParsing && (
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Reading Excel file…
          </div>
        )}

        {/* Parse error */}
        {supplierParseError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
            ❌ {supplierParseError}
            <button type="button" onClick={() => { setSupplierFile(null); setSupplierParseError(null); }} className="ml-2 underline text-xs">Try again</button>
          </div>
        )}

        {/* Stats strip after parsing */}
        {supplierStats && supplierFile && (
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-600 font-medium">📄 {supplierFile.name}</p>
              <button type="button" onClick={() => { setSupplierFile(null); setSupplierStats(null); setSupplierReviewSuggestion(null); setSupplierReviewError(null); }} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
              {[
                { label: "Total Q", value: supplierStats.total, colour: "text-slate-700" },
                { label: "✅ Y", value: supplierStats.y, colour: "text-green-600" },
                { label: "🔴 N", value: supplierStats.n, colour: supplierStats.n > 0 ? "text-red-600 font-bold" : "text-slate-400" },
                { label: "⚫ N/A", value: supplierStats.na, colour: supplierStats.na > 0 ? "text-slate-600 font-bold" : "text-slate-400" },
                { label: "⬜ No Ans", value: supplierStats.noAnswer, colour: supplierStats.noAnswer > 0 ? "text-amber-600 font-bold" : "text-slate-400" },
                { label: "🟡 Flagged", value: supplierStats.highlighted, colour: supplierStats.highlighted > 0 ? "text-amber-600 font-bold" : "text-slate-400" },
              ].map((s) => (
                <div key={s.label} className="bg-slate-50 border border-slate-200 rounded p-2">
                  <div className={`text-lg font-bold ${s.colour}`}>{s.value}</div>
                  <div className="text-slate-500 text-xs">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Briefing result */}
        {supplierStats && (
          <AISuggestionBox
            suggestion={supplierReviewSuggestion}
            loading={supplierReviewLoading}
            error={supplierReviewError}
            onRequest={() => {
              if (supplierFile) handleSupplierFileUpload(supplierFile);
            }}
            buttonLabel="✦ Generate Pre-Audit Briefing"
          />
        )}
      </Card>

      {/* AI Audit Preparation */}
      <Card title="✦ AI Audit Preparation">
        <p className="text-xs text-slate-500 mb-3">
          Generate a risk-based preparation plan for this audit — key focus areas, documents to request, and suggested opening questions.
          AI suggestions are advisory only and require auditor review before use.
        </p>
        <AISuggestionBox
          suggestion={aiSuggestion}
          loading={aiLoading}
          error={aiError}
          onRequest={handleAuditPrep}
          buttonLabel="Generate Audit Prep Plan"
        />
      </Card>

      {/* AI Daily Summary */}
      <Card title="✦ AI End-of-Day Summary">
        <p className="text-xs text-slate-500 mb-3">
          Generate a professional end-of-day summary based on current audit progress.
          AI suggestions are advisory only — review before sharing.
        </p>
        <div className="flex items-center gap-3 mb-3">
          <label className="text-xs font-medium text-slate-600">Audit Day:</label>
          <input
            type="number"
            min={1}
            max={audit.auditDates.length || 10}
            value={auditDay}
            onChange={(e) => setAuditDay(Math.max(1, Number(e.target.value)))}
            className="w-16 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-slate-400">of {audit.auditDates.length || 1}</span>
        </div>
        <AISuggestionBox
          suggestion={dailySuggestion}
          loading={dailyLoading}
          error={dailyError}
          onRequest={handleDailySummary}
          buttonLabel="Generate Daily Summary"
        />
      </Card>

      {/* AI Agenda + Opening Presentation */}
      <Card title="✦ AI Audit Agenda &amp; Opening Notes">
        <p className="text-xs text-slate-500 mb-3">
          Generate a day-by-day agenda, opening meeting briefing notes, risk focus areas, and
          pre-arrival document requests. AI suggestions are advisory only.
        </p>
        <AISuggestionBox
          suggestion={agendaSuggestion}
          loading={agendaLoading}
          error={agendaError}
          onRequest={handleAgenda}
          buttonLabel="Generate Agenda &amp; Opening Notes"
        />
      </Card>
    </div>
  );
}
