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
import { getAuditPrepSuggestion, getDailySummarySuggestion, isAIError } from "@/lib/aiSuggest";
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

  const workflowSteps = [
    { label: "Supplier Self-Assessment", href: `/audits/${id}/supplier`, description: `${stats.responses} responses recorded`, icon: "📝" },
    { label: "Auditor Verification", href: `/audits/${id}/verify`, description: `${stats.verified} items verified`, icon: "✅" },
    { label: "Findings", href: `/findings?auditId=${id}`, description: `${stats.findings} findings`, icon: "🔍" },
    { label: "CARs", href: `/cars?auditId=${id}`, description: `${stats.cars} corrective actions`, icon: "📋" },
    { label: "Generate Report", href: `/audits/${id}/report`, description: "Print-ready HTML report", icon: "📄" },
  ];

  const auditTools = [
    { label: "Voice Recording", href: `/audits/${id}/voice`, description: "Record and transcribe conversations", icon: "🎙" },
    { label: "Document OCR", href: `/audits/${id}/ocr`, description: "Photograph and analyse documents", icon: "🔬" },
    { label: "Drawing Analysis", href: `/audits/${id}/drawing`, description: "Identify CTF characteristics", icon: "📐" },
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
    </div>
  );
}
