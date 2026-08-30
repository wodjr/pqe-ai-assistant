"use client";
/**
 * app/findings/page.tsx — Findings log
 * Lists and creates findings for an audit.
 * isAuditorApproved must be set by explicit auditor action — never auto-set.
 */
import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  listAudits,
  getAudit,
  getFindingsByAudit,
  getEvidenceByAudit,
  saveFinding,
  saveCAR,
  deleteFinding,
} from "@/lib/storage/db";
import { getAuditorName } from "@/lib/storage/localStorage";
import { nanoid, generateRef } from "@/lib/utils/nanoid";
import { formatDateTime } from "@/lib/utils/format";
import { getFindingSuggestion, isAIError } from "@/lib/aiSuggest";
import type {
  Audit,
  Finding,
  FindingClass,
  Evidence,
  CAR,
} from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import StatusBadge from "@/components/StatusBadge";
import EvidenceUpload from "@/components/EvidenceUpload";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import AISuggestionBox from "@/components/AISuggestionBox";
import Link from "next/link";

const CLASSIFICATIONS: { value: FindingClass; label: string }[] = [
  { value: "MAJOR",       label: "Major Non-Conformance" },
  { value: "MINOR",       label: "Minor Non-Conformance" },
  { value: "OBSERVATION", label: "Observation" },
  { value: "OFI",         label: "Opportunity for Improvement" },
];

interface FindingForm {
  classification: FindingClass;
  title: string;
  description: string;
  requiresCAR: boolean;
}

function FindingsPageInner() {
  const searchParams = useSearchParams();
  const presetAuditId = searchParams.get("auditId") ?? "";

  const [audits, setAudits] = useState<Audit[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState(presetAuditId);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const auditorName = typeof window !== "undefined" ? getAuditorName() : "";
  // AI suggestion for the new-finding form
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [form, setForm] = useState<FindingForm>({
    classification: "MINOR",
    title: "",
    description: "",
    requiresCAR: false,
  });

  useEffect(() => {
    listAudits().then(setAudits);
  }, []);

  useEffect(() => {
    if (!selectedAuditId) { setLoading(false); return; }
    setLoading(true);
    async function load() {
      const a = await getAudit(selectedAuditId);
      setAudit(a ?? null);
      if (a) {
        const [fi, ev] = await Promise.all([
          getFindingsByAudit(selectedAuditId),
          getEvidenceByAudit(selectedAuditId),
        ]);
        setFindings(fi);
        setEvidence(ev);
      }
      setLoading(false);
    }
    load();
  }, [selectedAuditId]);

  async function handleFindingAISuggest() {
    if (!audit) return;
    setAiLoading(true);
    setAiError(null);
    const result = await getFindingSuggestion({
      auditType: audit.auditType,
      supplierName: audit.supplierName,
      questionRef: "",
      questionText: form.title,
      auditorNotes: form.description,
      verdict: form.classification,
    });
    if (isAIError(result)) {
      setAiError(result.error);
    } else {
      setAiSuggestion(result.suggestion);
    }
    setAiLoading(false);
  }

  async function handleCreateFinding(e: React.FormEvent) {
    e.preventDefault();
    if (!audit) return;
    setSaving(true);

    const id = nanoid();
    const ref = generateRef("F", findings.length + 1);

    const finding: Finding = {
      id,
      auditId: selectedAuditId,
      reference: ref,
      classification: form.classification,
      title: form.title.trim(),
      description: form.description.trim(),
      questionIds: [],
      evidenceIds: [],
      supplierResponseId: null,
      verificationId: null,
      requiresCAR: form.requiresCAR,
      carId: null,
      raisedAt: new Date().toISOString(),
      raisedBy: auditorName || audit.leadAuditor,
      isAuditorApproved: false, // never auto-approved
    };

    await saveFinding(finding);

    // Auto-create CAR if required
    if (form.requiresCAR) {
      const car: CAR = {
        id: nanoid(),
        auditId: selectedAuditId,
        findingId: id,
        reference: generateRef("CAR", findings.length + 1),
        status: "OPEN",
        owner: "",
        dueDate: "",
        containment: "",
        rootCause: "",
        correctiveAction: "",
        effectivenessEvidence: "",
        effectivenessEvidenceIds: [],
        closedAt: null,
        closedBy: null,
        isAuditorVerifiedClosed: false,
      };
      await saveCAR(car);
      finding.carId = car.id;
      await saveFinding(finding);
    }

    setFindings((prev) => [...prev, finding]);
    setForm({ classification: "MINOR", title: "", description: "", requiresCAR: false });
    setAiSuggestion(null);
    setAiError(null);
    setShowForm(false);
    setSaving(false);
  }

  async function toggleApproval(finding: Finding) {
    const updated = { ...finding, isAuditorApproved: !finding.isAuditorApproved };
    await saveFinding(updated);
    setFindings((prev) => prev.map((f) => (f.id === finding.id ? updated : f)));
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this finding? This cannot be undone.")) return;
    await deleteFinding(id);
    setFindings((prev) => prev.filter((f) => f.id !== id));
  }

  const handleEvidenceAdded = useCallback(
    (ev: Evidence) => setEvidence((prev) => [...prev, ev]),
    []
  );

  if (loading) return <LoadingSpinner />;

  const majorCount = findings.filter((f) => f.classification === "MAJOR").length;
  const minorCount = findings.filter((f) => f.classification === "MINOR").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Findings Log"
        subtitle="Record and classify audit findings"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Findings" }]}
        action={
          selectedAuditId && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded"
            >
              + New Finding
            </button>
          )
        }
      />

      {/* Audit selector */}
      <Card title="Select Audit">
        <select
          aria-label="Select audit"
          value={selectedAuditId}
          onChange={(e) => setSelectedAuditId(e.target.value)}
          className="w-full max-w-sm border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Select an audit —</option>
          {audits.map((a) => (
            <option key={a.id} value={a.id}>{a.supplierName} — {a.supplierSite}</option>
          ))}
        </select>
      </Card>

      {selectedAuditId && audit && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 stats-strip-2col gap-4">
            {[
              { label: "Major", value: majorCount, colour: "text-red-600" },
              { label: "Minor", value: minorCount, colour: "text-amber-600" },
              { label: "Total", value: findings.length, colour: "text-slate-700" },
            ].map((s) => (
              <Card key={s.label} className="text-center">
                <div className={`text-3xl font-bold ${s.colour}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </Card>
            ))}
          </div>

          {/* New finding form */}
          {showForm && (
            <Card title="New Finding">
              <form onSubmit={handleCreateFinding} className="space-y-4">
                {/* Classification */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Classification</label>
                  <div className="flex flex-wrap gap-3">
                    {CLASSIFICATIONS.map((c) => (
                      <label key={c.value} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="classification"
                          value={c.value}
                          checked={form.classification === c.value}
                          onChange={() => setForm((f) => ({ ...f, classification: c.value }))}
                          className="accent-blue-600"
                        />
                        <span className="text-sm">{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Finding Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Brief title for this finding"
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Finding Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the non-conformance, objective evidence observed, and relevant requirement…"
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* AI suggestion */}
                <AISuggestionBox
                  suggestion={aiSuggestion}
                  loading={aiLoading}
                  error={aiError}
                  onRequest={handleFindingAISuggest}
                  buttonLabel="Get AI Finding Suggestion"
                />

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresCAR}
                    onChange={(e) => setForm((f) => ({ ...f, requiresCAR: e.target.checked }))}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-slate-700">
                    Raise a Corrective Action Request (CAR) for this finding
                  </span>
                </label>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Create Finding"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="text-sm text-slate-600 border border-slate-300 px-4 py-2 rounded hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </Card>
          )}

          {/* Findings list */}
          {findings.length === 0 ? (
            <EmptyState
              title="No findings recorded"
              description="Create a finding to record non-conformances, observations or improvement opportunities."
              action={
                <button
                  onClick={() => setShowForm(true)}
                  className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700"
                >
                  + New Finding
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              {findings.map((f) => {
                const fEvidence = evidence.filter((e) => e.linkedTo.some((l) => l.targetId === f.id));
                const isExpanded = expandedId === f.id;
                return (
                  <Card key={f.id}>
                    {/* Finding header */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : f.id)}
                      className="w-full flex items-start justify-between text-left gap-3"
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="font-bold text-slate-400 text-sm shrink-0">{f.reference}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusBadge variant={f.classification} />
                            <span className="font-semibold text-slate-800 text-sm">{f.title}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {formatDateTime(f.raisedAt)} · {f.raisedBy}
                            {f.requiresCAR && <span className="ml-2 text-amber-600 font-medium">CAR required</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {f.isAuditorApproved ? (
                          <span className="text-xs text-green-600 font-bold">✓ Approved</span>
                        ) : (
                          <span className="text-xs text-amber-600">Draft</span>
                        )}
                        <span className="text-slate-400">{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{f.description}</p>

                        {/* Evidence */}
                        <div>
                          <div className="text-xs font-medium text-slate-600 mb-1">Evidence</div>
                          <EvidenceUpload
                            auditId={selectedAuditId}
                            link={{ type: "FINDING", targetId: f.id }}
                            existingEvidence={fEvidence}
                            onAdded={handleEvidenceAdded}
                          />
                        </div>

                        {/* Links */}
                        {f.carId && (
                          <div className="text-sm">
                            <Link
                              href={`/cars?auditId=${selectedAuditId}`}
                              className="text-blue-600 hover:underline text-xs"
                            >
                              → View linked CAR
                            </Link>
                          </div>
                        )}

                        {/* Auditor approval */}
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleApproval(f)}
                            className={`text-sm px-4 py-1.5 rounded border font-medium transition-colors ${
                              f.isAuditorApproved
                                ? "bg-green-600 text-white border-green-600"
                                : "border-slate-300 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {f.isAuditorApproved ? "✓ Auditor Approved" : "Approve Finding"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(f.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>

                        {!f.isAuditorApproved && (
                          <p className="text-xs text-slate-400">
                            This finding is a draft. Click &ldquo;Approve Finding&rdquo; to confirm it as an auditor-approved finding.
                            AI cannot approve findings.
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {findings.length > 0 && (
            <div className="flex gap-3">
              <Link href={`/cars?auditId=${selectedAuditId}`} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-6 py-2 rounded">
                Manage CARs →
              </Link>
              <Link href={`/audits/${selectedAuditId}/report`} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded hover:bg-slate-50">
                Generate Report
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function FindingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading findings…</div>}>
      <FindingsPageInner />
    </Suspense>
  );
}
