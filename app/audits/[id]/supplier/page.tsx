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

interface ResponseDraft {
  status: ResponseStatus;
  response: string;
  comments: string;
  score: string;
}

// Minimal translations for multilingual supplier form
const TRANSLATIONS: Record<string, {
  conforming: string; notAssessed: string; minorNC: string; majorNC: string; notApplicable: string;
  response: string; comments: string; score: string; saveResponse: string; evidence: string;
}> = {
  en: { conforming: "Conforming", notAssessed: "Not Assessed", minorNC: "Minor Non-Conformance", majorNC: "Major Non-Conformance", notApplicable: "Not Applicable", response: "Supplier Response", comments: "Comments / Supporting Information", score: "Self-Assessment Score", saveResponse: "Save Response", evidence: "Upload Evidence" },
  es: { conforming: "Conforme", notAssessed: "No Evaluado", minorNC: "No Conformidad Menor", majorNC: "No Conformidad Mayor", notApplicable: "No Aplicable", response: "Respuesta del Proveedor", comments: "Comentarios / Información de Soporte", score: "Puntuación de Autoevaluación", saveResponse: "Guardar Respuesta", evidence: "Subir Evidencia" },
  de: { conforming: "Konform", notAssessed: "Nicht Bewertet", minorNC: "Geringfügige NC", majorNC: "Wesentliche NC", notApplicable: "Nicht Anwendbar", response: "Lieferantenantwort", comments: "Kommentare / Nachweise", score: "Selbstbewertungspunktzahl", saveResponse: "Antwort Speichern", evidence: "Nachweise Hochladen" },
  fr: { conforming: "Conforme", notAssessed: "Non Évalué", minorNC: "Non-Conformité Mineure", majorNC: "Non-Conformité Majeure", notApplicable: "Non Applicable", response: "Réponse Fournisseur", comments: "Commentaires / Informations de Soutien", score: "Score d'Auto-Évaluation", saveResponse: "Enregistrer la Réponse", evidence: "Téléverser les Preuves" },
  zh: { conforming: "符合", notAssessed: "未评估", minorNC: "轻微不符合", majorNC: "严重不符合", notApplicable: "不适用", response: "供应商回复", comments: "意见/支持信息", score: "自我评估分数", saveResponse: "保存回复", evidence: "上传证据" },
};

const LANG_LABELS: Record<string, string> = { en: "English", es: "Español", de: "Deutsch", fr: "Français", zh: "中文" };

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
  const [lang, setLang] = useState<keyof typeof TRANSLATIONS>("en");

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
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;

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

      {/* Language selector */}
      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-slate-600">Form Language:</span>
          {Object.entries(LANG_LABELS).map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code as keyof typeof TRANSLATIONS)}
              className={`text-xs px-3 py-1 rounded border font-medium transition-colors ${lang === code ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

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
                          {([
                            { value: "NOT_ASSESSED",  label: t.notAssessed },
                            { value: "CONFORMING",    label: t.conforming },
                            { value: "MINOR_NC",      label: t.minorNC },
                            { value: "MAJOR_NC",      label: t.majorNC },
                            { value: "NOT_APPLICABLE",label: t.notApplicable },
                          ] as { value: ResponseStatus; label: string }[]).map((s) => (
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
                            {t.score} {q.scoringBasis && <span className="text-slate-400">({q.scoringBasis})</span>}
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
                        <label className="block text-xs font-medium text-slate-600 mb-1">{t.response}</label>
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
                        <label className="block text-xs font-medium text-slate-600 mb-1">{t.comments}</label>
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
                          {t.evidence}
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
                          {saving === q.id ? "Saving…" : t.saveResponse}
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
