"use client";
/**
 * app/audits/[id]/verify/page.tsx
 * Auditor onsite verification panel.
 *
 * Key controls:
 * - Auditor verdict is SEPARATE from supplier response — never auto-populated.
 * - AI suggestions are displayed but NEVER written to verdict or isApproved.
 * - isApproved requires explicit auditor checkbox action.
 */
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  getAudit,
  getChecklist,
  getSupplierResponsesByAudit,
  getVerificationsByAudit,
  getEvidenceByAudit,
  saveVerification,
} from "@/lib/storage/db";
import { getAuditorName } from "@/lib/storage/localStorage";
import { nanoid } from "@/lib/utils/nanoid";
import { getVerificationSuggestion, isAIError } from "@/lib/aiSuggest";
import type {
  Audit,
  ChecklistTemplate,
  ChecklistQuestion,
  SupplierResponse,
  AuditorVerification,
  VerificationVerdict,
  Evidence,
} from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import StatusBadge from "@/components/StatusBadge";
import EvidenceUpload from "@/components/EvidenceUpload";
import AISuggestionBox from "@/components/AISuggestionBox";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

const VERDICTS: { value: VerificationVerdict; label: string }[] = [
  { value: "CONFORMS",       label: "Conforms" },
  { value: "MINOR_NC",       label: "Minor NC" },
  { value: "MAJOR_NC",       label: "Major NC" },
  { value: "NOT_VERIFIABLE", label: "Not Verifiable" },
  { value: "NOT_APPLICABLE", label: "Not Applicable" },
];

interface VerifyDraft {
  verdict: VerificationVerdict | "";
  score: string;
  notes: string;
  isApproved: boolean;
}

export default function AuditorVerificationPage() {
  const { id: auditId } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [checklist, setChecklist] = useState<ChecklistTemplate | null>(null);
  const [supplierMap, setSupplierMap] = useState<Map<string, SupplierResponse>>(new Map());
  const [savedMap, setSavedMap] = useState<Map<string, AuditorVerification>>(new Map());
  const [drafts, setDrafts] = useState<Map<string, VerifyDraft>>(new Map());
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const auditorName = typeof window !== "undefined" ? getAuditorName() : "";
  // AI suggestions: keyed by questionId
  const [aiSuggestions, setAiSuggestions] = useState<Map<string, string>>(new Map());
  const [aiLoading, setAiLoading] = useState<string | null>(null); // questionId loading
  const [aiErrors, setAiErrors] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    async function load() {
      const a = await getAudit(auditId);
      if (!a) { setLoading(false); return; }
      setAudit(a);
      const [cl, sr, vr, ev] = await Promise.all([
        getChecklist(a.checklistTemplateId),
        getSupplierResponsesByAudit(auditId),
        getVerificationsByAudit(auditId),
        getEvidenceByAudit(auditId),
      ]);
      setChecklist(cl ?? null);
      setSupplierMap(new Map(sr.map((r) => [r.questionId, r])));
      setSavedMap(new Map(vr.map((v) => [v.questionId, v])));
      setEvidence(ev);
      setLoading(false);
    }
    load();
  }, [auditId]);

  function getDraft(qId: string): VerifyDraft {
    if (drafts.has(qId)) return drafts.get(qId)!;
    const v = savedMap.get(qId);
    return {
      verdict: v?.verdict ?? "",
      score: v?.score != null ? String(v.score) : "",
      notes: v?.notes ?? "",
      isApproved: v?.isApproved ?? false,
    };
  }

  function updateDraft(qId: string, field: keyof VerifyDraft, value: string | boolean) {
    setDrafts((prev) => {
      const next = new Map(prev);
      next.set(qId, { ...getDraft(qId), [field]: value });
      return next;
    });
  }

  async function saveVerif(q: ChecklistQuestion) {
    if (!audit) return;
    const draft = getDraft(q.id);
    if (!draft.verdict) { alert("Please select a verdict before saving."); return; }

    setSaving(q.id);
    const existing = savedMap.get(q.id);
    const evIds = evidence.filter((e) => e.linkedTo.some((l) => l.targetId === q.id)).map((e) => e.id);

    const verif: AuditorVerification = {
      id: existing?.id ?? nanoid(),
      auditId,
      questionId: q.id,
      verdict: draft.verdict as VerificationVerdict,
      score: draft.score !== "" ? Number(draft.score) : null,
      notes: draft.notes,
      evidenceIds: evIds,
      aiSuggestion: existing?.aiSuggestion ?? null, // preserve any AI suggestion — display only
      verifiedAt: new Date().toISOString(),
      verifiedBy: auditorName || audit.leadAuditor,
      isApproved: draft.isApproved, // auditor must explicitly check this box
    };

    await saveVerification(verif);
    setSavedMap((prev) => new Map(prev).set(q.id, verif));
    setDrafts((prev) => { const n = new Map(prev); n.delete(q.id); return n; });
    setSaving(null);
  }

  const handleEvidenceAdded = useCallback((ev: Evidence) => {
    setEvidence((prev) => [...prev, ev]);
  }, []);

  async function handleAISuggest(q: ChecklistQuestion) {
    if (!audit) return;
    setAiLoading(q.id);
    setAiErrors((prev) => { const n = new Map(prev); n.delete(q.id); return n; });
    const supplierResp = supplierMap.get(q.id);
    const result = await getVerificationSuggestion({
      questionRef: q.reference,
      questionText: q.text,
      guidance: q.guidance,
      supplierResponse: supplierResp?.response ?? "",
      supplierStatus: supplierResp?.status ?? "NOT_ASSESSED",
    });
    if (isAIError(result)) {
      setAiErrors((prev) => new Map(prev).set(q.id, result.error));
    } else {
      setAiSuggestions((prev) => new Map(prev).set(q.id, result.suggestion));
    }
    setAiLoading(null);
  }

  if (loading) return <LoadingSpinner />;
  if (!audit || !checklist)
    return (
      <div className="text-center py-16 text-slate-500">
        Audit or checklist not found.{" "}
        <Link href="/audits" className="text-blue-600 hover:underline">Back</Link>
      </div>
    );

  const totalQ = checklist.sections.reduce((n, s) => n + s.questions.length, 0);
  const verifiedQ = [...savedMap.values()].filter((v) => v.isApproved).length;
  const totalScore = [...savedMap.values()].reduce((sum, v) => sum + (v.score ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditor Onsite Verification"
        subtitle={`${audit.supplierName} — ${checklist.name}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Audits", href: "/audits" },
          { label: audit.supplierName, href: `/audits/${auditId}` },
          { label: "Verification" },
        ]}
      />

      {/* AI disclaimer */}
      <div className="ai-suggestion-block">
        <strong>Auditor controls:</strong> AI suggestions are shown for reference only and are clearly labelled.
        Only your explicit verdict and approval checkbox update the audit record.
        AI cannot approve evidence, finalize findings, or close CARs.
      </div>

      {/* Progress */}
      <Card>
        <div className="grid grid-cols-3 stats-strip-2col gap-4 text-center text-sm">
          <div>
            <div className="text-2xl font-bold text-blue-600">{savedMap.size} / {totalQ}</div>
            <div className="text-xs text-slate-500">Items assessed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{verifiedQ}</div>
            <div className="text-xs text-slate-500">Auditor approved</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-700">{totalScore} / {checklist.totalMaxScore || "?"}</div>
            <div className="text-xs text-slate-500">Score</div>
          </div>
        </div>
      </Card>

      {/* Per-section */}
      {checklist.sections.map((section) => (
        <Card key={section.id} title={section.title}>
          <div className="space-y-3">
            {section.questions.map((q) => {
              const draft = getDraft(q.id);
              const saved = savedMap.get(q.id);
              const supplierResp = supplierMap.get(q.id);
              const isExpanded = expandedQ === q.id;
              const qEvidence = evidence.filter((e) => e.linkedTo.some((l) => l.targetId === q.id));

              return (
                <div key={q.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Header */}
                  <button
                    type="button"
                    onClick={() => setExpandedQ(isExpanded ? null : q.id)}
                    className="w-full flex items-start justify-between p-3 text-left hover:bg-slate-50 gap-3"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-xs text-slate-400 shrink-0 mt-0.5 w-12">{q.reference}</span>
                      <div className="min-w-0">
                        <span className="text-sm text-slate-700">{q.text}</span>
                        {q.isMandatory && <span className="ml-2 text-xs text-red-500 font-bold">MANDATORY</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {saved?.verdict && <StatusBadge variant={saved.verdict} />}
                      {saved?.isApproved && <span className="text-xs text-green-600 font-bold">✓ Approved</span>}
                      {qEvidence.length > 0 && <span className="text-xs text-blue-600">📎 {qEvidence.length}</span>}
                      <span className="text-slate-400">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50">

                      {/* Supplier response (read-only reference) */}
                      {supplierResp && (
                        <div className="bg-blue-50 border border-blue-100 rounded p-3 text-sm">
                          <div className="font-medium text-blue-700 text-xs mb-1">SUPPLIER RESPONSE (read-only)</div>
                          <StatusBadge variant={supplierResp.status} />
                          {supplierResp.response && (
                            <p className="mt-1 text-slate-700 text-xs">{supplierResp.response}</p>
                          )}
                          {supplierResp.comments && (
                            <p className="mt-1 text-slate-500 text-xs italic">{supplierResp.comments}</p>
                          )}
                          {supplierResp.score != null && (
                            <p className="mt-1 text-xs text-slate-500">
                              Supplier score: {supplierResp.score} / {q.maxScore}
                            </p>
                          )}
                        </div>
                      )}

                      {/* AI suggestion */}
                      <AISuggestionBox
                        suggestion={aiSuggestions.get(q.id) ?? null}
                        loading={aiLoading === q.id}
                        error={aiErrors.get(q.id) ?? null}
                        onRequest={() => handleAISuggest(q)}
                        buttonLabel="Get AI Verification Guidance"
                      />

                      {/* Auditor verdict */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Auditor Verdict <span className="text-red-500">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {VERDICTS.map((v) => (
                            <label key={v.value} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`verdict-${q.id}`}
                                value={v.value}
                                checked={draft.verdict === v.value}
                                onChange={() => updateDraft(q.id, "verdict", v.value)}
                                className="accent-blue-600"
                              />
                              <span className="text-xs">{v.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Score */}
                      {q.maxScore !== null && (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Auditor Score {q.scoringBasis && <span className="text-slate-400">({q.scoringBasis})</span>}
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={q.maxScore}
                            value={draft.score}
                            onChange={(e) => updateDraft(q.id, "score", e.target.value)}
                            className="w-24 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-xs text-slate-400 ml-2">/ {q.maxScore}</span>
                        </div>
                      )}

                      {/* Notes */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Auditor Notes / Objective Evidence</label>
                        <textarea
                          rows={3}
                          value={draft.notes}
                          onChange={(e) => updateDraft(q.id, "notes", e.target.value)}
                          placeholder="Record objective evidence observed, document references, observations…"
                          className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Evidence upload */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Evidence (Photos / Documents)</label>
                        <EvidenceUpload
                          auditId={auditId}
                          link={{ type: "QUESTION", targetId: q.id }}
                          existingEvidence={qEvidence}
                          onAdded={handleEvidenceAdded}
                        />
                      </div>

                      {/* Approval checkbox — explicit auditor action required */}
                      <label className="flex items-start gap-2 cursor-pointer bg-green-50 border border-green-200 rounded p-3">
                        <input
                          type="checkbox"
                          checked={draft.isApproved}
                          onChange={(e) => updateDraft(q.id, "isApproved", e.target.checked)}
                          className="accent-green-600 mt-0.5"
                        />
                        <span className="text-sm text-green-800">
                          <strong>I confirm</strong> this verdict is based on objective evidence I have reviewed
                          onsite. Checking this box constitutes my auditor approval of this item.
                          AI suggestions have no effect on this approval.
                        </span>
                      </label>

                      {/* Save */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={saving === q.id || !draft.verdict}
                          onClick={() => saveVerif(q)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded disabled:opacity-50 transition-colors"
                        >
                          {saving === q.id ? "Saving…" : "Save Verification"}
                        </button>
                        {saved?.isApproved && (
                          <span className="text-xs text-green-600">✓ Approved by {saved.verifiedBy}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <div className="flex gap-3">
        <Link href={`/findings?auditId=${auditId}`} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-6 py-2 rounded">
          Proceed to Findings →
        </Link>
        <Link href={`/audits/${auditId}`} className="text-sm text-slate-600 hover:underline px-4 py-2">
          Back to Audit
        </Link>
      </div>
    </div>
  );
}
