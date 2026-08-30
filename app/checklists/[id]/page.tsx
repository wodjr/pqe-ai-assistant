"use client";
/**
 * app/checklists/[id]/page.tsx — Checklist template viewer
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getChecklist } from "@/lib/storage/db";
import { getChecklistReviewSuggestion, isAIError } from "@/lib/aiSuggest";
import type { ChecklistTemplate } from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import AISuggestionBox from "@/components/AISuggestionBox";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

export default function ChecklistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [checklist, setChecklist] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    getChecklist(id).then((c) => {
      if (c) {
        setChecklist(c);
        // Expand first section by default
        if (c.sections.length > 0) {
          setExpandedSections(new Set([c.sections[0].id]));
        }
      }
      setLoading(false);
    });
  }, [id]);

  function toggleSection(sectionId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function expandAll() {
    if (checklist) setExpandedSections(new Set(checklist.sections.map((s) => s.id)));
  }
  function collapseAll() {
    setExpandedSections(new Set());
  }

  async function handleAIReview() {
    if (!checklist) return;
    setAiLoading(true);
    setAiError(null);
    const result = await getChecklistReviewSuggestion({
      checklistName: checklist.name,
      revision: checklist.revision,
      sections: checklist.sections.map((s) => ({
        title: s.title,
        questions: s.questions.map((q) => ({
          ref: q.reference,
          text: q.text,
          guidance: q.guidance ?? "",
          isMandatory: q.isMandatory,
        })),
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
  if (!checklist)
    return (
      <div className="text-center py-16 text-slate-500">
        Checklist not found.{" "}
        <Link href="/checklists" className="text-blue-600 hover:underline">Back to Checklists</Link>
      </div>
    );

  const totalQuestions = checklist.sections.reduce((n, s) => n + s.questions.length, 0);
  const mandatoryCount = checklist.sections.flatMap((s) => s.questions).filter((q) => q.isMandatory).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={checklist.name}
        subtitle={`Revision ${checklist.revision} · ${checklist.sourceFileName}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Checklists", href: "/checklists" },
          { label: checklist.name },
        ]}
        action={
          <Link
            href="/audits/new"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded"
          >
            Use in Audit
          </Link>
        }
      />

      {/* Metadata */}
      <Card>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {[
            { label: "Sections", value: checklist.sections.length },
            { label: "Questions", value: totalQuestions },
            { label: "Mandatory", value: mandatoryCount },
            { label: "Max Score", value: checklist.totalMaxScore || "N/A" },
          ].map((d) => (
            <div key={d.label}>
              <dt className="text-xs text-slate-500 font-medium">{d.label}</dt>
              <dd className="text-xl font-bold text-slate-800">{d.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* AI Review */}
      <Card title="✦ AI Checklist Review">
        <p className="text-xs text-slate-500 mb-3">
          Analyses question coverage, identifies gaps (PFMEA, CTF, MSA, SPC, traceability, etc.),
          flags un-auditable questions, and suggests improvements. AI suggestions are advisory only
          — the auditor is responsible for checklist quality and scope decisions.
        </p>
        <AISuggestionBox
          suggestion={aiSuggestion}
          loading={aiLoading}
          error={aiError}
          onRequest={handleAIReview}
          buttonLabel="✦ Review Checklist Coverage with AI"
        />
      </Card>

      {/* Controls */}
      <div className="flex gap-2 text-sm">
        <button onClick={expandAll} className="text-blue-600 hover:underline">Expand All</button>
        <span className="text-slate-300">|</span>
        <button onClick={collapseAll} className="text-blue-600 hover:underline">Collapse All</button>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {checklist.sections.map((section) => {
          const isOpen = expandedSections.has(section.id);
          return (
            <Card key={section.id}>
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between text-left"
                aria-expanded={isOpen}
              >
                <div>
                  <span className="font-semibold text-slate-700">{section.title}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {section.questions.length} question{section.questions.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <span className="text-slate-400">{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 bg-slate-50">
                        <th className="p-2 border border-slate-200 font-semibold w-20">Ref</th>
                        <th className="p-2 border border-slate-200 font-semibold">Question</th>
                        <th className="p-2 border border-slate-200 font-semibold hidden md:table-cell">Guidance</th>
                        <th className="p-2 border border-slate-200 font-semibold w-20 text-right">Max</th>
                        <th className="p-2 border border-slate-200 font-semibold w-16 text-center">Mand.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.questions.map((q) => (
                        <tr key={q.id} className="hover:bg-slate-50">
                          <td className="p-2 border border-slate-200 text-slate-500 text-xs">{q.reference}</td>
                          <td className="p-2 border border-slate-200">
                            {q.text}
                            {q.scoringBasis && (
                              <div className="text-xs text-slate-400 mt-0.5">Scoring: {q.scoringBasis}</div>
                            )}
                          </td>
                          <td className="p-2 border border-slate-200 text-slate-500 text-xs hidden md:table-cell">
                            {q.guidance || "—"}
                          </td>
                          <td className="p-2 border border-slate-200 text-right">{q.maxScore ?? "—"}</td>
                          <td className="p-2 border border-slate-200 text-center">
                            {q.isMandatory ? (
                              <span className="text-red-600 font-bold">Y</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
