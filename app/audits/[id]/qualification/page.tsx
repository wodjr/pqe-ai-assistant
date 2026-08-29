"use client";
/**
 * app/audits/[id]/qualification/page.tsx — Supplier Qualification Decision
 *
 * Dedicated page for the formal APPROVE / CONDITIONAL / REJECT decision.
 * The qualification decision requires:
 *   1. A generated and auditor-approved report
 *   2. Explicit auditor sign-off via a confirmation dialog
 *   3. An optional conditions list for CONDITIONAL approvals
 *
 * Key controls:
 * - isAuditorApproved on the report must already be true.
 * - Decision can only be set by explicit auditor action.
 * - AI cannot make or change any qualification decision.
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getAudit,
  saveAudit,
  getReportByAudit,
  getFindingsByAudit,
  getCARsByAudit,
} from "@/lib/storage/db";
import { getAuditorName } from "@/lib/storage/localStorage";
import { formatDateTime } from "@/lib/utils/format";
import type { Audit, AuditReport, Finding, CAR, RecommendationStatus } from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

const DECISION_CONFIG: Record<RecommendationStatus, {
  label: string; colour: string; bg: string; border: string; icon: string; description: string;
}> = {
  APPROVE:     { label: "Approved",              colour: "text-green-700",  bg: "bg-green-50",  border: "border-green-300", icon: "✓", description: "Supplier meets all requirements. Approved for production supply." },
  CONDITIONAL: { label: "Conditionally Approved", colour: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-300", icon: "⚠", description: "Supplier approved subject to conditions below being met and verified." },
  REJECT:      { label: "Rejected",               colour: "text-red-700",    bg: "bg-red-50",    border: "border-red-300",   icon: "✕", description: "Supplier does not meet requirements. Not approved for production supply." },
  DEFER:       { label: "Deferred",               colour: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-300",  icon: "◷", description: "Decision deferred pending further information or re-audit." },
  PENDING:     { label: "Pending",                colour: "text-slate-600",  bg: "bg-slate-50",  border: "border-slate-300", icon: "—", description: "No decision recorded yet." },
};

export default function QualificationPage() {
  const { id: auditId } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [cars, setCars] = useState<CAR[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conditions, setConditions] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("");
  const auditorName = typeof window !== "undefined" ? getAuditorName() : "";

  useEffect(() => {
    async function load() {
      const a = await getAudit(auditId);
      if (!a) { setLoading(false); return; }
      setAudit(a);
      const [rpt, fi, ca] = await Promise.all([
        getReportByAudit(auditId),
        getFindingsByAudit(auditId),
        getCARsByAudit(auditId),
      ]);
      setReport(rpt ?? null);
      setFindings(fi);
      setCars(ca);
      setDecisionNotes(a.scope ?? "");
      setLoading(false);
    }
    load();
  }, [auditId]);

  async function handleDecision(decision: RecommendationStatus) {
    if (!audit || !report) return;
    if (!report.isAuditorApproved) {
      alert("The audit report must be auditor-approved before recording a qualification decision.\n\nGo to Generate Report → Approve Report first.");
      return;
    }

    const cfg = DECISION_CONFIG[decision];
    const confirmed = confirm(
      `QUALIFICATION DECISION — ${audit.supplierName}\n\n` +
      `Decision: ${cfg.label}\n` +
      `Auditor: ${auditorName || audit.leadAuditor}\n` +
      `Date: ${new Date().toLocaleDateString()}\n\n` +
      `${decision === "CONDITIONAL" ? `Conditions:\n${conditions || "(none specified)"}\n\n` : ""}` +
      `This decision will be recorded against this audit. Only an authorised auditor may make this decision.\n\nProceed?`
    );
    if (!confirmed) return;

    setSaving(true);
    // Store decision as audit status and scope addendum
    const updated: Audit = {
      ...audit,
      status: decision === "APPROVE" || decision === "CONDITIONAL" ? "CLOSED" : audit.status,
      scope: decisionNotes,
      updatedAt: new Date().toISOString(),
    };
    await saveAudit(updated);
    setAudit(updated);
    setSaving(false);
  }

  if (loading) return <LoadingSpinner />;
  if (!audit) return (
    <div className="text-center py-16 text-slate-500">
      Audit not found. <Link href="/audits" className="text-blue-600 hover:underline">Back</Link>
    </div>
  );

  const majorFindings = findings.filter((f) => f.classification === "MAJOR" && f.isAuditorApproved);
  const openCARs = cars.filter((c) => !c.isAuditorVerifiedClosed);
  const currentDecision = report?.qualificationRecommendation ?? "PENDING";
  const cfg = DECISION_CONFIG[currentDecision];
  const canDecide = !!report?.isAuditorApproved;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Supplier Qualification Decision"
        subtitle={`${audit.supplierName} — ${audit.supplierSite}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Audits", href: "/audits" },
          { label: audit.supplierName, href: `/audits/${auditId}` },
          { label: "Qualification" },
        ]}
      />

      {/* Human approval notice */}
      <div className="ai-suggestion-block">
        <strong>Mandatory human approval:</strong> The qualification decision can only be made by an
        authorised auditor after the audit report has been approved. AI cannot make, suggest, or
        influence this decision.
      </div>

      {/* Prerequisites check */}
      <Card title="Prerequisites">
        <div className="space-y-2">
          {[
            { label: "Audit report generated", met: !!report, link: `/audits/${auditId}/report` },
            { label: "Report auditor-approved", met: !!report?.isAuditorApproved, link: `/audits/${auditId}/report` },
            { label: "No open major findings", met: majorFindings.length === 0, link: `/findings?auditId=${auditId}` },
            { label: "No open CARs", met: openCARs.length === 0, link: `/cars?auditId=${auditId}` },
          ].map((p) => (
            <div key={p.label} className="flex items-center gap-3 text-sm">
              <span className={`font-bold ${p.met ? "text-green-600" : "text-amber-600"}`}>
                {p.met ? "✓" : "○"}
              </span>
              <span className={p.met ? "text-slate-700" : "text-amber-700"}>{p.label}</span>
              {!p.met && (
                <Link href={p.link} className="text-xs text-blue-600 hover:underline ml-auto">
                  Go →
                </Link>
              )}
            </div>
          ))}
        </div>
        {!canDecide && (
          <p className="text-xs text-amber-700 mt-3 bg-amber-50 border border-amber-200 rounded p-2">
            ⚠ The audit report must be approved before recording a qualification decision.
          </p>
        )}
      </Card>

      {/* Current decision status */}
      <Card title="Current Decision">
        <div className={`rounded-lg border p-4 ${cfg.bg} ${cfg.border}`}>
          <div className={`text-2xl font-bold ${cfg.colour} mb-1`}>
            {cfg.icon} {cfg.label}
          </div>
          <p className={`text-sm ${cfg.colour}`}>{cfg.description}</p>
          {report?.approvedBy && (
            <p className="text-xs text-slate-500 mt-2">
              Report approved by {report.approvedBy} · {formatDateTime(report.approvedAt)}
            </p>
          )}
        </div>
      </Card>

      {/* Audit summary */}
      <Card title="Audit Summary">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-sm">
          {[
            { label: "Score", value: `${report?.totalScore ?? 0} / ${report?.totalMaxScore ?? "?"}`, colour: "text-slate-700" },
            { label: "Major Findings", value: report?.majorFindings ?? findings.filter(f => f.classification === "MAJOR").length, colour: (report?.majorFindings ?? 0) > 0 ? "text-red-600 font-bold" : "text-green-600" },
            { label: "Minor Findings", value: report?.minorFindings ?? findings.filter(f => f.classification === "MINOR").length, colour: "text-amber-600" },
            { label: "Open CARs", value: openCARs.length, colour: openCARs.length > 0 ? "text-red-600 font-bold" : "text-green-600" },
          ].map((s) => (
            <div key={s.label} className="border border-slate-100 rounded p-3">
              <div className={`text-2xl font-bold ${s.colour}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Conditions (for conditional approval) */}
      {canDecide && (
        <Card title="Conditions / Notes">
          <textarea
            rows={4}
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            placeholder="For CONDITIONAL approval: list specific conditions that must be met and verified before full approval. For other decisions: leave blank or add notes."
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Card>
      )}

      {/* Decision buttons */}
      {canDecide && (
        <Card title="Record Decision">
          <p className="text-xs text-slate-500 mb-4">
            Select a decision below. A confirmation dialog will appear before any decision is recorded.
            Only make this decision if you are the authorised lead auditor for this audit.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(["APPROVE", "CONDITIONAL", "REJECT", "DEFER"] as RecommendationStatus[]).map((d) => {
              const c = DECISION_CONFIG[d];
              return (
                <button
                  key={d}
                  type="button"
                  disabled={saving}
                  onClick={() => handleDecision(d)}
                  className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all hover:shadow-md disabled:opacity-50 ${
                    currentDecision === d ? `${c.bg} ${c.border}` : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className={`text-xl font-bold shrink-0 ${c.colour}`}>{c.icon}</span>
                  <div>
                    <div className={`font-semibold text-sm ${c.colour}`}>{c.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{c.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex gap-3">
        <Link href={`/audits/${auditId}/report`} className="text-sm text-blue-600 hover:underline">
          ← Generate / Approve Report
        </Link>
        <Link href={`/audits/${auditId}`} className="text-sm text-slate-600 hover:underline ml-4">
          Back to Audit
        </Link>
      </div>
    </div>
  );
}
