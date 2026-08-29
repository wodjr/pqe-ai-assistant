"use client";
/**
 * app/audits/[id]/ocr/page.tsx — OCR Document Analysis
 *
 * Auditor photographs or uploads a supplier document.
 * The image is sent to GPT-4o vision via the secure /api/ai/suggest route
 * for extraction, completeness check, and compliance notes.
 *
 * AI output is advisory only — the auditor must independently assess.
 */
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getAudit, saveEvidence, saveBlob } from "@/lib/storage/db";
import { nanoid } from "@/lib/utils/nanoid";
import { formatDateTime } from "@/lib/utils/format";
import { getOcrAnalysis, isAIError } from "@/lib/aiSuggest";
import type { Audit, Evidence } from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import AISuggestionBox from "@/components/AISuggestionBox";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

const DOC_TYPES = [
  "Material Certificate",
  "Certificate of Conformance",
  "First Article Inspection Report",
  "Dimensional Report",
  "Calibration Record",
  "Control Plan",
  "PFMEA",
  "Work Instruction",
  "Inspection Record",
  "Gage R&R / MSA Report",
  "SPC Chart",
  "PPAP Document",
  "Other",
];

export default function OcrPage() {
  const { id: auditId } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAudit(auditId).then((a) => { setAudit(a ?? null); setLoading(false); });
  }, [auditId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10_000_000) { alert("Image too large — maximum 10 MB."); return; }
    setImageFile(file);
    setAiSuggestion(null);
    setAiError(null);
    setSaved(false);
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleAnalyse() {
    if (!imageDataUrl || !audit) return;
    setAiLoading(true);
    setAiError(null);
    const result = await getOcrAnalysis({
      supplierName: audit.supplierName,
      documentType: docType,
      imageBase64: imageDataUrl,
    });
    if (isAIError(result)) {
      setAiError(result.error);
    } else {
      setAiSuggestion(result.suggestion);
    }
    setAiLoading(false);
  }

  async function handleSaveEvidence() {
    if (!imageFile || !imageDataUrl) return;
    const evId = nanoid();
    const blobKey = `evidence_blob_${evId}`;
    const blob = imageFile;
    await saveBlob(blobKey, blob);
    const ev: Evidence = {
      id: evId,
      auditId,
      type: "DOCUMENT",
      fileName: imageFile.name,
      mimeType: imageFile.type,
      caption: `${docType} — ${formatDateTime(new Date().toISOString())}`,
      takenAt: new Date().toISOString(),
      linkedTo: [],
      dataClassification: "PROTOTYPE_ONLY",
      blobKey,
    };
    await saveEvidence(ev);
    setSaved(true);
  }

  function clearImage() {
    setImageDataUrl(null);
    setImageFile(null);
    setAiSuggestion(null);
    setAiError(null);
    setSaved(false);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  if (loading) return <LoadingSpinner />;
  if (!audit) return <div className="text-center py-16 text-slate-500">Audit not found. <Link href="/audits" className="text-blue-600 hover:underline">Back</Link></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document OCR Analysis"
        subtitle={`${audit.supplierName} — Photograph and analyse supplier documents`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Audits", href: "/audits" },
          { label: audit.supplierName, href: `/audits/${auditId}` },
          { label: "Document OCR" },
        ]}
      />

      <div className="ai-suggestion-block">
        <strong>AI advisory:</strong> Document analysis is AI-generated and for reference only.
        The auditor must independently verify all document content. AI cannot approve documents.
      </div>

      {/* Document type + capture */}
      <Card title="Capture Document">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full max-w-sm border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DOC_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Camera capture (mobile) */}
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded flex items-center gap-2">
              <span>📷</span> Take Photo
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            {/* File upload (desktop) */}
            <label className="cursor-pointer border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded hover:bg-slate-50 flex items-center gap-2">
              <span>📁</span> Upload Image
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
        </div>
      </Card>

      {/* Image preview + analysis */}
      {imageDataUrl && (
        <Card title={`Preview: ${docType}`}>
          <div className="space-y-4">
            {/* Image */}
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageDataUrl}
                alt="Document preview"
                className="w-full max-h-80 object-contain rounded border border-slate-200 bg-slate-50"
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-2 right-2 bg-white border border-slate-300 text-slate-600 text-xs px-2 py-1 rounded hover:bg-slate-50"
              >
                ✕ Clear
              </button>
            </div>

            {/* AI analysis */}
            <AISuggestionBox
              suggestion={aiSuggestion}
              loading={aiLoading}
              error={aiError}
              onRequest={handleAnalyse}
              buttonLabel="✦ Analyse Document with AI"
            />

            {/* Save as evidence */}
            <div className="flex items-center gap-3 pt-2">
              {!saved ? (
                <button
                  type="button"
                  onClick={handleSaveEvidence}
                  className="border border-slate-300 text-slate-600 text-sm px-4 py-1.5 rounded hover:bg-slate-50"
                >
                  Save as Evidence
                </button>
              ) : (
                <span className="text-xs text-green-600 font-medium">✓ Saved as evidence</span>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="pt-2">
        <Link href={`/audits/${auditId}`} className="text-sm text-slate-600 hover:underline">
          ← Back to Audit
        </Link>
      </div>
    </div>
  );
}
