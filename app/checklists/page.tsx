"use client";
/**
 * app/checklists/page.tsx — Checklist template list + import
 */
import { useEffect, useState, useRef } from "react";
import { listChecklists, saveChecklist, saveBlob, deleteChecklist, getBlob } from "@/lib/storage/db";
import { parseExcelToChecklist } from "@/lib/parseExcel";
import { formatDate } from "@/lib/utils/format";
import type { ChecklistTemplate } from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

export default function ChecklistsPage() {
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [overrideName, setOverrideName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listChecklists().then((c) => { setChecklists(c); setLoading(false); });
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
          <p className="text-sm text-slate-600">
            Upload an existing <strong>.xlsx</strong> audit questionnaire. The original workbook is
            preserved as a read-only source file. Columns A–F are parsed: Reference, Question,
            Guidance, Max Score, Scoring Basis, Mandatory (Y/N).
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
                  <Link
                    href={`/checklists/${c.id}`}
                    className="text-xs border border-slate-300 text-slate-600 px-3 py-1 rounded hover:bg-slate-50"
                  >
                    View
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
    </div>
  );
}
