"use client";
/**
 * app/audits/[id]/supplier/page.tsx
 * Supplier self-assessment form.
 * The supplier fills a response, conformance status, score and notes for each checklist item.
 * Evidence can be attached to any item.
 */
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  getAudit,
  getChecklist,
  getSupplierResponsesByAudit,
  getEvidenceByAudit,
  saveSupplierResponse,
} from "@/lib/storage/db";
import { nanoid } from "@/lib/utils/nanoid";
import type {
  Audit,
  ChecklistTemplate,
  ChecklistQuestion,
  SupplierResponse,
  ResponseStatus,
  Evidence,
} from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import StatusBadge from "@/components/StatusBadge";
import EvidenceUpload from "@/components/EvidenceUpload";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

const RESPONSE_STATUSES: { value: ResponseStatus; label: string }[] = [
  { value: "NOT_ASSESSED", label: "Not Assessed" },
  { value: "CONFORMING",   label: "Conforming" },
  { value: "MINOR_NC",     label: "Minor Non-Conformance" },
  { value: "MAJOR_NC",     label: "Major Non-Conformance" },
  { value: "NOT_APPLICABLE", label: "Not Applicable" },
];

interface ResponseDraft {
  status: ResponseStatus;
  response: string;
  comments: string;
  score: string;
}

export default function SupplierAssessmentPage() {
  const { id: auditId } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [checklist, setChecklist] = useState<ChecklistTemplate | null>(null);
  const [saved, setSaved] = useState<Map<string, SupplierResponse>>(new Map());
  const [drafts, setDrafts] = useState<Map<string, ResponseDraft>>(new Map());
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null); // questionId being saved
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const a = await getAudit(auditId);
      if (!a) { setLoading(false); return; }
      setAudit(a);
      const [cl, sr, ev] = await Promise.all([
        getChecklist(a.checklistTemplateId),
        getSupplierResponsesByAudit(auditId),
        getEvidenceByAudit(auditId),
      ]);
      setChecklist(cl ?? null);
      setSaved(new Map(sr.map((r) => [r.questionId, r])));
      setEvidence(ev);
      setLoading(false);
    }
    load();
  }, [auditId]);

  function getDraft(qId: string): ResponseDraft {
    if (drafts.has(qId)) return drafts.get(qId)!;
    const s = saved.get(qId);
    return {
      status: s?.status ?? "NOT_ASSESSED",
      response: s?.response ?? "",
      comments: s?.comments ?? "",
      score: s?.score != null ? String(s.score) : "",
    };
  }

  function updateDraft(qId: string, field: keyof ResponseDraft, value: string) {
    setDrafts((prev) => {
      const next = new Map(prev);
      next.set(qId, { ...getDraft(qId), [field]: value });
      return next;
    });
  }

  async function saveResponse(q: ChecklistQuestion) {
    if (!audit) return;
    setSaving(q.id);
    const draft = getDraft(q.id);
    const existing = saved.get(q.id);
    const evIds = evidence.filter((e) => e.linkedTo.some((l) => l.targetId === q.id)).map((e) => e.id);
    const scoreVal = draft.score !== "" ? Number(draft.score) : null;

    const resp: SupplierResponse = {
      id: existing?.id ?? nanoid(),
      auditId,
      questionId: q.id,
      status: draft.status,
      score: scoreVal,
      response: draft.response,
      comments: draft.comments,
      evidenceIds: evIds,
      submittedAt: new Date().toISOString(),
      submittedBy: audit.supplierContact || "Supplier",
    };

    await saveSupplierResponse(resp);
    setSaved((prev) => new Map(prev).set(q.id, resp));
    setDrafts((prev) => { const n = new Map(prev); n.delete(q.id); return n; });
    setSaving(null);
  }

  const handleEvidenceAdded = useCallback((ev: Evidence) => {
    setEvidence((prev) => [...prev, ev]);
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!audit || !checklist)
    return (
      <div className="text-center py-16 text-slate-500">
        Audit or checklist not found.{" "}
        <Link href="/audits" className="text-blue-600 hover:underline">Back</Link>
      </div>
    );

  const totalQ = checklist.sections.reduce((n, s) => n + s.questions.length, 0);
  const answeredQ = saved.size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Self-Assessment"
        subtitle={`${audit.supplierName} — ${checklist.name}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Audits", href: "/audits" },
          { label: audit.supplierName, href: `/audits/${auditId}` },
          { label: "Supplier Assessment" },
        ]}
      />

      {/* Progress */}
      <Card>
        <div className="flex items-center gap-4">
          <div>
            <div className="text-2xl font-bold text-blue-600">{answeredQ} / {totalQ}</div>
            <div className="text-xs text-slate-500">Questions responded</div>
          </div>
          <div className="flex-1 bg-slate-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all"
              style={{ width: totalQ > 0 ? `${(answeredQ / totalQ) * 100}%` : "0%" }}
            />
          </div>
          <div className="text-sm text-slate-500">{totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0}%</div>
        </div>
      </Card>

      {/* Per-section questions */}
      {checklist.sections.map((section) => (
        <Card key={section.id} title={section.title}>
          <div className="space-y-3">
            {section.questions.map((q) => {
              const draft = getDraft(q.id);
              const isSaved = saved.has(q.id);
              const isExpanded = expandedQ === q.id;
              const qEvidence = evidence.filter((e) => e.linkedTo.some((l) => l.targetId === q.id));

              return (
                <div
                  key={q.id}
                  className="border border-slate-200 rounded-lg overflow-hidden"
                >
                  {/* Question header */}
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
                      {isSaved && <StatusBadge variant={saved.get(q.id)!.status} />}
                      {qEvidence.length > 0 && (
                        <span className="text-xs text-blue-600">📎 {qEvidence.length}</span>
                      )}
                      <span className="text-slate-400">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {/* Expanded response form */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50">
                      {q.guidance && (
                        <p className="text-xs text-slate-500 italic">{q.guidance}</p>
                      )}

                      {/* Status */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Conformance Status</label>
                        <div className="flex flex-wrap gap-2">
                          {RESPONSE_STATUSES.map((s) => (
                            <label key={s.value} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`status-${q.id}`}
                                value={s.value}
                                checked={draft.status === s.value}
                                onChange={() => updateDraft(q.id, "status", s.value)}
                                className="accent-blue-600"
                              />
                              <span className="text-xs">{s.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Score */}
                      {q.maxScore !== null && (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Score {q.scoringBasis && <span className="text-slate-400">({q.scoringBasis})</span>}
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

                      {/* Response text */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Response</label>
                        <textarea
                          rows={3}
                          value={draft.response}
                          onChange={(e) => updateDraft(q.id, "response", e.target.value)}
                          placeholder="Describe how this requirement is met…"
                          className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Comments */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Additional Comments</label>
                        <textarea
                          rows={2}
                          value={draft.comments}
                          onChange={(e) => updateDraft(q.id, "comments", e.target.value)}
                          placeholder="Any additional comments or clarifications…"
                          className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Evidence */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Supporting Evidence
                        </label>
                        <EvidenceUpload
                          auditId={auditId}
                          link={{ type: "QUESTION", targetId: q.id }}
                          existingEvidence={qEvidence}
                          onAdded={handleEvidenceAdded}
                        />
                      </div>

                      {/* Save */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={saving === q.id}
                          onClick={() => saveResponse(q)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded disabled:opacity-50 transition-colors"
                        >
                          {saving === q.id ? "Saving…" : "Save Response"}
                        </button>
                        {isSaved && (
                          <span className="text-xs text-green-600">✓ Saved</span>
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
        <Link
          href={`/audits/${auditId}/verify`}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-6 py-2 rounded"
        >
          Proceed to Auditor Verification →
        </Link>
        <Link href={`/audits/${auditId}`} className="text-sm text-slate-600 hover:underline px-4 py-2">
          Back to Audit
        </Link>
      </div>
    </div>
  );
}
