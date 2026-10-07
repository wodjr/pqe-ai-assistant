"use client";
/**
 * app/checklists/[id]/page.tsx — Checklist template viewer
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getChecklist, getBlob } from "@/lib/storage/db";
import { getChecklistReviewSuggestion, isAIError } from "@/lib/aiSuggest";
import type { ChecklistTemplate } from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import AISuggestionBox from "@/components/AISuggestionBox";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

interface SheetData {
  name: string;
  rows: string[][];
}

export default function ChecklistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [checklist, setChecklist] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Raw Excel Sheet Preview
  const [viewMode, setViewMode] = useState<"questions" | "raw_excel">("questions");
  const [rawSheets, setRawSheets] = useState<SheetData[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [rawLoading, setRawLoading] = useState(false);

  useEffect(() => {
    getChecklist(id).then((c) => {
      if (c) {
        setChecklist(c);
        // Expand first section by default
        if (c.sections.length > 0) {
          setExpandedSections(new Set([c.sections[0].id]));
        }
        loadRawExcel(c.sourceFileBlobKey);
      } else {
        setLoading(false);
      }
    });
  }, [id]);

  async function loadRawExcel(blobKey: string) {
    try {
      const blob = await getBlob(blobKey);
      if (blob) {
        const { Workbook } = await import("exceljs");
        const workbook = new Workbook();
        const buffer = await blob.arrayBuffer();
        await workbook.xlsx.load(buffer);

        const sheets: SheetData[] = [];
        workbook.eachSheet((worksheet) => {
          const rows: string[][] = [];
          worksheet.eachRow({ includeEmpty: false }, (row) => {
            const rowValues: string[] = [];
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
              while (rowValues.length < colNumber - 1) {
                rowValues.push("");
              }
              const v = cell.value;
              let str = "";
              if (v !== null && v !== undefined) {
                if (typeof v === "object" && "richText" in v) {
                  str = v.richText.map((r: { text: string }) => r.text).join("").trim();
                } else if (typeof v === "object" && "result" in v) {
                  str = String(v.result ?? "").trim();
                } else {
                  str = String(v).trim();
                }
              }
              rowValues.push(str);
            });
            if (rowValues.some((c) => c !== "")) {
              rows.push(rowValues);
            }
          });
          sheets.push({ name: worksheet.name, rows });
        });
        setRawSheets(sheets);
      }
    } catch (err) {
      console.warn("Could not load raw Excel in detail page:", err);
    } finally {
      setLoading(false);
    }
  }

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
          <div className="flex gap-2">
            <Link
              href="/audits/new"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded"
            >
              Use in Audit
            </Link>
          </div>
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

      {/* View Switcher: Parsed Questions vs Original Excel Grid */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setViewMode("questions")}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs transition flex items-center gap-1.5 ${
              viewMode === "questions"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>📋 Parsed Questions</span>
            <span className="opacity-80">({totalQuestions})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("raw_excel")}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs transition flex items-center gap-1.5 ${
              viewMode === "raw_excel"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>📊 Original Excel Spreadsheet</span>
            {rawSheets.length > 0 && <span className="opacity-80">({rawSheets.length} sheets)</span>}
          </button>
        </div>

        {viewMode === "questions" && (
          <div className="flex gap-2 text-xs">
            <button onClick={expandAll} className="text-blue-600 hover:underline">Expand All</button>
            <span className="text-slate-300">|</span>
            <button onClick={collapseAll} className="text-blue-600 hover:underline">Collapse All</button>
          </div>
        )}
      </div>

      {/* Raw Excel Spreadsheet View */}
      {viewMode === "raw_excel" && (
        <Card title={`Original File: ${checklist.sourceFileName}`}>
          {rawSheets.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No spreadsheet sheet data found.</p>
          ) : (
            <div className="space-y-3">
              {rawSheets.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
                  {rawSheets.map((sh, sIdx) => (
                    <button
                      key={sh.name}
                      type="button"
                      onClick={() => setActiveSheetIdx(sIdx)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition border ${
                        activeSheetIdx === sIdx
                          ? "bg-white text-blue-700 border-slate-200 border-b-transparent shadow-sm font-semibold"
                          : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200/70"
                      }`}
                    >
                      📄 {sh.name} ({sh.rows.length} rows)
                    </button>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm max-h-[65vh] scrollbar-thin">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <tbody>
                    {rawSheets[activeSheetIdx]?.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={
                          rIdx === 0
                            ? "bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-300 shadow-sm"
                            : "hover:bg-blue-50/40 even:bg-slate-50/50"
                        }
                      >
                        <td className="px-2.5 py-1.5 font-mono text-slate-400 text-[10px] bg-slate-100/80 border-r border-slate-200 select-none text-center w-8">
                          {rIdx + 1}
                        </td>
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`px-3 py-2 border-r border-slate-100 text-slate-700 max-w-sm whitespace-pre-wrap ${
                              rIdx === 0 ? "font-bold text-slate-800" : ""
                            }`}
                          >
                            {cell || <span className="text-slate-300 italic">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Questions List (Only shown when in questions view mode) */}
      {viewMode === "questions" && (
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
      )}
    </div>
  );
}
