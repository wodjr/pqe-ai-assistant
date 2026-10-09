"use client";
/**
 * app/checklists/page.tsx — Checklist template list + import
 */
import { useEffect, useState, useRef } from "react";
import { listChecklists, saveChecklist, saveBlob, deleteChecklist, getBlob, getCachedChecklists } from "@/lib/storage/db";
import { parseExcelToChecklist } from "@/lib/parseExcel";
import { formatDate } from "@/lib/utils/format";
import type { ChecklistTemplate } from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

interface SheetData {
  name: string;
  rows: string[][];
}

export default function ChecklistsPage() {
  const cached = getCachedChecklists();
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>(() => cached || []);
  const [loading, setLoading] = useState(() => !cached);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [overrideName, setOverrideName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Preview Modal State
  const [previewTemplate, setPreviewTemplate] = useState<ChecklistTemplate | null>(null);
  const [previewSheets, setPreviewSheets] = useState<SheetData[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState<"structured" | "raw">("structured");

  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 2500);

    listChecklists()
      .then((c) => {
        if (isMounted) {
          setChecklists(c || []);
          setLoading(false);
        }
      })
      .catch((e) => {
        console.error("Failed to load checklists:", e);
        if (isMounted) setLoading(false);
      })
      .finally(() => {
        clearTimeout(safetyTimer);
      });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  async function handleImport(file: File) {
    setImporting(true);
    setError(null);
    setSuccess(null);
    try {
      const { template, blob } = await parseExcelToChecklist(file, overrideName || undefined);
      await saveBlob(template.sourceFileBlobKey, blob);
      await saveChecklist(template);
      setChecklists((prev) => [...prev, template]);
      setSuccess(`Imported "${template.name}" — ${template.sections.reduce((n, s) => n + s.questions.length, 0)} questions across ${template.sections.length} sections.`);
      setOverrideName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this checklist template? Audits that reference it will keep their data but the template will no longer be available.")) return;
    await deleteChecklist(id);
    setChecklists((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleDownloadOriginal(template: ChecklistTemplate) {
    const blob = await getBlob(template.sourceFileBlobKey);
    if (!blob) { alert("Original file not found in storage."); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = template.sourceFileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleOpenPreview(template: ChecklistTemplate) {
    setPreviewTemplate(template);
    setPreviewMode("structured");
    setPreviewSheets([]);
    setActiveSheetIdx(0);
    setPreviewLoading(true);

    try {
      const blob = await getBlob(template.sourceFileBlobKey);
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
        setPreviewSheets(sheets);
      }
    } catch (err) {
      console.warn("Could not load raw Excel sheets:", err);
    } finally {
      setPreviewLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  const totalQuestions = checklists.reduce(
    (n, c) => n + c.sections.reduce((m, s) => m + s.questions.length, 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checklist Templates"
        subtitle="Import Excel audit questionnaires and manage controlled templates"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Checklists" }]}
      />

      {/* Import card */}
      <Card title="Import New Checklist">
        <div className="space-y-3 max-w-lg">
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
            <strong>📋 This is the blank IBM checklist template</strong> — the standard questionnaire you send <em>to</em> the supplier before the audit.
            Import it once here and it becomes available for all audits. You do <strong>not</strong> upload the supplier&apos;s completed responses here.
          </div>
          <p className="text-sm text-slate-600">
            Upload an existing <strong>.xlsx</strong> audit questionnaire. The original workbook is
            preserved as a read-only source file. Columns A–F are parsed: Reference, Question,
            Guidance, Max Score, Scoring Basis, Mandatory (Y/N).
          </p>
          <p className="text-xs text-slate-500 italic">
            * Please use modern <strong>.xlsx</strong> format. If your template is in legacy Excel 97–2003 (.xls), open it in Excel and Save As (.xlsx).
          </p>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={overrideName}
              onChange={(e) => setOverrideName(e.target.value)}
              placeholder="Template name (optional — defaults to filename)"
              className="flex-1 min-w-[200px] border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded disabled:opacity-50 transition-colors"
            >
              {importing ? "Importing…" : "📂 Choose .xlsx File"}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
          />
          {error && <p className="text-sm text-red-600">❌ {error}</p>}
          {success && <p className="text-sm text-green-600">✓ {success}</p>}
        </div>
      </Card>

      {/* Stats */}
      {checklists.length > 0 && (
        <div className="flex gap-6 text-sm text-slate-600">
          <span><strong>{checklists.length}</strong> template{checklists.length !== 1 ? "s" : ""}</span>
          <span><strong>{totalQuestions}</strong> total questions</span>
        </div>
      )}

      {/* Template list */}
      {checklists.length === 0 ? (
        <EmptyState
          title="No checklist templates"
          description="Import an Excel workbook to create your first controlled checklist template."
        />
      ) : (
        <div className="space-y-3">
          {checklists.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-800">{c.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Rev {c.revision} · Imported {formatDate(c.importedAt)} · {c.sourceFileName}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {c.sections.length} section{c.sections.length !== 1 ? "s" : ""} ·{" "}
                    {c.sections.reduce((n, s) => n + s.questions.length, 0)} questions ·{" "}
                    Max score: {c.totalMaxScore || "N/A"}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(c)}
                    className="text-xs bg-blue-50 border border-blue-200 text-blue-700 font-semibold px-3 py-1 rounded hover:bg-blue-100 flex items-center gap-1 transition"
                  >
                    <span>👁</span>
                    <span>Quick Preview</span>
                  </button>
                  <Link
                    href={`/checklists/${c.id}`}
                    className="text-xs border border-slate-300 text-slate-600 px-3 py-1 rounded hover:bg-slate-50"
                  >
                    Full Detail
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDownloadOriginal(c)}
                    className="text-xs border border-slate-300 text-slate-600 px-3 py-1 rounded hover:bg-slate-50"
                  >
                    Download Original
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="text-xs border border-red-200 text-red-600 px-3 py-1 rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {/* ── Document Preview Modal ────────────────────────────────────── */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📊</span>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    {previewTemplate.name}
                    <span className="bg-blue-500/30 text-blue-300 text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                      Rev {previewTemplate.revision}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Source: {previewTemplate.sourceFileName} · Imported {formatDate(previewTemplate.importedAt)}
                  </p>
                </div>
              </div>

              {/* View Switcher & Close */}
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-0.5 rounded-lg border border-slate-700 flex text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("structured")}
                    className={`px-3 py-1 rounded font-medium transition ${
                      previewMode === "structured"
                        ? "bg-blue-600 text-white"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    Structured Template ({previewTemplate.sections.reduce((n, s) => n + s.questions.length, 0)} Qs)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("raw")}
                    className={`px-3 py-1 rounded font-medium transition ${
                      previewMode === "raw"
                        ? "bg-blue-600 text-white"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    Raw Excel Grid {previewSheets.length > 0 ? `(${previewSheets.length} Sheets)` : ""}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewTemplate(null)}
                  className="text-slate-400 hover:text-white text-lg p-1"
                  aria-label="Close Preview"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
              {previewLoading && (
                <div className="h-full flex items-center justify-center">
                  <LoadingSpinner text="Loading workbook preview..." />
                </div>
              )}

              {/* 1. STRUCTURED CHECKLIST PREVIEW MODE */}
              {!previewLoading && previewMode === "structured" && (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 font-medium">Total Sections</div>
                      <div className="text-lg font-bold text-slate-800">{previewTemplate.sections.length}</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 font-medium">Total Questions</div>
                      <div className="text-lg font-bold text-blue-600">
                        {previewTemplate.sections.reduce((n, s) => n + s.questions.length, 0)}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 font-medium">Mandatory Items</div>
                      <div className="text-lg font-bold text-amber-600">
                        {previewTemplate.sections.flatMap((s) => s.questions).filter((q) => q.isMandatory).length}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 font-medium">Max Score</div>
                      <div className="text-lg font-bold text-green-600">{previewTemplate.totalMaxScore || "N/A"}</div>
                    </div>
                  </div>

                  {/* Sections List */}
                  <div className="space-y-3">
                    {previewTemplate.sections.map((sec, idx) => (
                      <div key={sec.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                        <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                          <span className="font-semibold text-xs text-slate-800 uppercase tracking-wide">
                            Section {idx + 1}: {sec.title}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium bg-white px-2 py-0.5 rounded border border-slate-200">
                            {sec.questions.length} question{sec.questions.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {sec.questions.map((q) => (
                            <div key={q.id} className="p-3 text-xs hover:bg-slate-50/70 transition flex gap-3">
                              <span className="font-mono font-bold text-blue-600 w-16 shrink-0 pt-0.5">
                                {q.reference || "—"}
                              </span>
                              <div className="flex-1 space-y-1">
                                <p className="font-medium text-slate-800 leading-snug">{q.text}</p>
                                {q.guidance && (
                                  <p className="text-slate-500 text-[11px] leading-relaxed">
                                    <span className="font-semibold text-slate-600">Guidance:</span> {q.guidance}
                                  </p>
                                )}
                              </div>
                              <div className="shrink-0 flex items-center gap-2">
                                {q.isMandatory && (
                                  <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    MANDATORY
                                  </span>
                                )}
                                {q.scoringBasis && (
                                  <span className="bg-slate-50 text-slate-600 border border-slate-200 text-[10px] font-mono px-1.5 py-0.5 rounded">
                                    {q.scoringBasis}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. RAW EXCEL GRID PREVIEW MODE */}
              {!previewLoading && previewMode === "raw" && (
                <div className="space-y-3">
                  {/* Sheet Tabs */}
                  {previewSheets.length > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
                      {previewSheets.map((sh, sIdx) => (
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

                  {/* Sheet Table */}
                  {previewSheets[activeSheetIdx] ? (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm max-h-[62vh] scrollbar-thin">
                      <table className="min-w-full divide-y divide-slate-200 text-xs">
                        <tbody>
                          {previewSheets[activeSheetIdx].rows.map((row, rIdx) => (
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
                  ) : (
                    <div className="text-center py-12 text-slate-400 text-sm">
                      No raw sheet data found in stored file.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Original file preserved read-only in IndexedDB
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadOriginal(previewTemplate)}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded hover:bg-slate-50 transition"
                >
                  Download .xlsx
                </button>
                <Link
                  href={`/checklists/${previewTemplate.id}`}
                  className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition"
                >
                  Open Full Detail Page →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
