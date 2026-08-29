"use client";
/**
 * app/audits/[id]/report/page.tsx
 * Generate a print-ready HTML audit report.
 *
 * Key controls:
 * - isAuditorApproved must be set by explicit auditor action.
 * - AI cannot approve the report.
 * - The report is rendered in a hidden iframe for printing.
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getAudit,
  getChecklist,
  getSupplierResponsesByAudit,
  getVerificationsByAudit,
  getEvidenceByAudit,
  getFindingsByAudit,
  getCARsByAudit,
  getReportByAudit,
  saveReport,
  getBlob,
} from "@/lib/storage/db";
import { getAuditorName } from "@/lib/storage/localStorage";
import { nanoid } from "@/lib/utils/nanoid";
import { generateReportHtml } from "@/lib/generateReport";
import type {
  Audit,
  ChecklistTemplate,
  SupplierResponse,
  AuditorVerification,
  Evidence,
  Finding,
  CAR,
  AuditReport,
  RecommendationStatus,
} from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

const RECOMMENDATIONS: { value: RecommendationStatus; label: string }[] = [
  { value: "APPROVE",      label: "✓ Approve Supplier" },
  { value: "CONDITIONAL",  label: "⚠ Conditional Approval" },
  { value: "REJECT",       label: "✕ Reject Supplier" },
  { value: "DEFER",        label: "◷ Defer Decision" },
  { value: "PENDING",      label: "— Pending" },
];

export default function AuditReportPage() {
  const { id: auditId } = useParams<{ id: string }>();
  const auditorName = typeof window !== "undefined" ? getAuditorName() : "";

  const [audit, setAudit] = useState<Audit | null>(null);
  const [checklist, setChecklist] = useState<ChecklistTemplate | null>(null);
  const [supplierResponses, setSupplierResponses] = useState<SupplierResponse[]>([]);
  const [verifications, setVerifications] = useState<AuditorVerification[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [cars, setCars] = useState<CAR[]>([]);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formRecommendation, setFormRecommendation] = useState<RecommendationStatus>("PENDING");
  const [formConclusion, setFormConclusion] = useState("");
  const [formConfidentiality, setFormConfidentiality] = useState(
    "CONFIDENTIAL — This document contains proprietary supplier quality information. Reproduction or disclosure outside the intended recipients is prohibited."
  );

  useEffect(() => {
    async function load() {
      const a = await getAudit(auditId);
      if (!a) { setLoading(false); return; }
      setAudit(a);
      const [cl, sr, vr, ev, fi, ca, rpt] = await Promise.all([
        getChecklist(a.checklistTemplateId),
        getSupplierResponsesByAudit(auditId),
        getVerificationsByAudit(auditId),
        getEvidenceByAudit(auditId),
        getFindingsByAudit(auditId),
        getCARsByAudit(auditId),
        getReportByAudit(auditId),
      ]);
      setChecklist(cl ?? null);
      setSupplierResponses(sr);
      setVerifications(vr);
      setEvidence(ev);
      setFindings(fi);
      setCars(ca);
      if (rpt) {
        setReport(rpt);
        setFormRecommendation(rpt.qualificationRecommendation);
        setFormConclusion(rpt.conclusion);
        setFormConfidentiality(rpt.confidentialityNotice);
      }
      setLoading(false);
    }
    load();
  }, [auditId]);

  async function handleGenerate() {
    if (!audit || !checklist) return;
    setGenerating(true);
    setError(null);

    try {
      // Build photo data URIs for embedded images
      const photoDataUris: Record<string, string> = {};
      const photos = evidence.filter((e) => e.type === "PHOTO");
      await Promise.all(
        photos.map(async (e) => {
          const blob = await getBlob(e.blobKey);
          if (blob) {
            const url = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            photoDataUris[e.id] = url;
          }
        })
      );

      const approvedVerifications = verifications.filter((v) => v.isApproved);
      const totalScore = approvedVerifications.reduce((sum, v) => sum + (v.score ?? 0), 0);
      const majorFindings = findings.filter((f) => f.classification === "MAJOR").length;
      const minorFindings = findings.filter((f) => f.classification === "MINOR").length;
      const observations = findings.filter((f) => f.classification === "OBSERVATION" || f.classification === "OFI").length;
      const openCARs = cars.filter((c) => !c.isAuditorVerifiedClosed).length;

      const newReport: AuditReport = {
        id: report?.id ?? nanoid(),
        auditId,
        generatedAt: new Date().toISOString(),
        generatedBy: auditorName || audit.leadAuditor,
        qualificationRecommendation: formRecommendation,
        conclusion: formConclusion,
        isAuditorApproved: report?.isAuditorApproved ?? false, // never auto-approved
        approvedAt: report?.approvedAt ?? null,
        approvedBy: report?.approvedBy ?? null,
        confidentialityNotice: formConfidentiality,
        totalScore,
        totalMaxScore: checklist.totalMaxScore,
        majorFindings,
        minorFindings,
        observations,
        openCARs,
      };

      await saveReport(newReport);
      setReport(newReport);

      const html = generateReportHtml({
        audit,
        checklist,
        supplierResponses,
        verifications,
        evidence,
        findings,
        cars,
        report: newReport,
        photoDataUris,
      });

      // Open report in new tab for printing
      const tab = window.open("", "_blank");
      if (tab) {
        tab.document.write(html);
        tab.document.close();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove() {
    if (!report) { alert("Generate the report first."); return; }
    const confirmed = confirm(
      `You are about to approve this audit report.\n\n` +
      `Auditor: ${auditorName || audit?.leadAuditor}\n\n` +
      `This confirms the report reflects your professional judgement and auditor-approved findings.\n\n` +
      `AI suggestions in this report are clearly labelled and do not constitute your approval.\n\nProceed?`
    );
    if (!confirmed) return;

    setSaving(true);
    const updated: AuditReport = {
      ...report,
      qualificationRecommendation: formRecommendation,
      conclusion: formConclusion,
      confidentialityNotice: formConfidentiality,
      isAuditorApproved: true,
      approvedAt: new Date().toISOString(),
      approvedBy: auditorName || audit?.leadAuditor || "Auditor",
    };
    await saveReport(updated);
    setReport(updated);
    setSaving(false);
  }

  async function handleRevokeApproval() {
    if (!report) return;
    if (!confirm("Revoke report approval? The report will return to Draft status.")) return;
    const updated: AuditReport = {
      ...report,
      isAuditorApproved: false,
      approvedAt: null,
      approvedBy: null,
    };
    await saveReport(updated);
    setReport(updated);
  }

  if (loading) return <LoadingSpinner />;
  if (!audit || !checklist)
    return (
      <div className="text-center py-16 text-slate-500">
        Audit not found.{" "}
        <Link href="/audits" className="text-blue-600 hover:underline">Back</Link>
      </div>
    );

  const approvedCount = verifications.filter((v) => v.isApproved).length;
  const totalQ = checklist.sections.reduce((n, s) => n + s.questions.length, 0);
  const majorCount = findings.filter((f) => f.classification === "MAJOR").length;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Generate Audit Report"
        subtitle={`${audit.supplierName} — ${audit.supplierSite}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Audits", href: "/audits" },
          { label: audit.supplierName, href: `/audits/${auditId}` },
          { label: "Report" },
        ]}
      />

      {/* AI / human distinction notice */}
      <div className="ai-suggestion-block">
        <strong>Human approval required:</strong> AI suggestions are labelled throughout the report.
        Only your explicit approval below makes this report official. AI cannot approve the report,
        approve a supplier, or close a CAR.
      </div>

      {/* Audit readiness summary */}
      <Card title="Audit Readiness">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xl font-bold text-blue-600">{approvedCount} / {totalQ}</div>
            <div className="text-xs text-slate-500">Items auditor-approved</div>
          </div>
          <div>
            <div className={`text-xl font-bold ${majorCount > 0 ? "text-red-600" : "text-green-600"}`}>
              {majorCount}
            </div>
            <div className="text-xs text-slate-500">Major findings</div>
          </div>
          <div>
            <div className={`text-xl font-bold ${cars.filter((c) => !c.isAuditorVerifiedClosed).length > 0 ? "text-amber-600" : "text-green-600"}`}>
              {cars.filter((c) => !c.isAuditorVerifiedClosed).length}
            </div>
            <div className="text-xs text-slate-500">Open CARs</div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-700">{evidence.length}</div>
            <div className="text-xs text-slate-500">Evidence items</div>
          </div>
        </div>
      </Card>

      {/* Report form */}
      <Card title="Report Settings">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Qualification Recommendation <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {RECOMMENDATIONS.map((r) => (
                <label key={r.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="recommendation"
                    value={r.value}
                    checked={formRecommendation === r.value}
                    onChange={() => setFormRecommendation(r.value)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm">{r.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              This is your professional recommendation. It requires mandatory human approval before any qualification decision is recorded.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Conclusion</label>
            <textarea
              rows={5}
              value={formConclusion}
              onChange={(e) => setFormConclusion(e.target.value)}
              placeholder="Summarise the audit findings, supplier capability assessment, and basis for recommendation…"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confidentiality Notice</label>
            <textarea
              rows={2}
              value={formConfidentiality}
              onChange={(e) => setFormConfidentiality(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">❌ {error}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={generating}
              onClick={handleGenerate}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded disabled:opacity-50 transition-colors"
            >
              {generating ? "Generating…" : "📄 Generate &amp; Preview Report"}
            </button>

            {report && !report.isAuditorApproved && (
              <button
                type="button"
                disabled={saving}
                onClick={handleApprove}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-5 py-2 rounded disabled:opacity-50"
              >
                ✓ Approve Report (Auditor)
              </button>
            )}

            {report?.isAuditorApproved && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-green-700 font-semibold">
                  ✓ Approved by {report.approvedBy}
                </span>
                <button
                  type="button"
                  onClick={handleRevokeApproval}
                  className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-3 py-1 rounded"
                >
                  Revoke
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Existing report status */}
      {report && (
        <Card title="Report Status">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-slate-500">Status</dt>
              <dd>{report.isAuditorApproved
                ? <span className="text-green-700 font-semibold">✓ Approved</span>
                : <span className="text-amber-700">Draft</span>}
              </dd>
            </div>
            <div><dt className="text-xs text-slate-500">Approved By</dt><dd>{report.approvedBy ?? "—"}</dd></div>
            <div><dt className="text-xs text-slate-500">Recommendation</dt><dd>{report.qualificationRecommendation}</dd></div>
            <div><dt className="text-xs text-slate-500">Score</dt><dd>{report.totalScore} / {report.totalMaxScore}</dd></div>
          </dl>
        </Card>
      )}

      <div className="flex gap-3">
        <Link href={`/audits/${auditId}`} className="text-sm text-slate-600 hover:underline">
          ← Back to Audit
        </Link>
      </div>
    </div>
  );
}
