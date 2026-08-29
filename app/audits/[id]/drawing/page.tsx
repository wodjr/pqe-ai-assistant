"use client";
/**
 * app/audits/[id]/drawing/page.tsx — Technical Drawing Analysis
 *
 * Auditor photographs a technical drawing.
 * GPT-4o vision (via secure server route) identifies CTF characteristics,
 * GD&T callouts, process risks, and required verification evidence.
 *
 * AI output is advisory only — the auditor makes all decisions.
 */
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getAudit, saveEvidence, saveBlob } from "@/lib/storage/db";
import { nanoid } from "@/lib/utils/nanoid";
import { formatDateTime } from "@/lib/utils/format";
import { getDrawingAnalysis, isAIError } from "@/lib/aiSuggest";
import type { Audit, Evidence } from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import AISuggestionBox from "@/components/AISuggestionBox";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

const PROCESS_TYPES = [
  "CNC Machining",
  "Sheet Metal Stamping",
  "Die Casting / Investment Casting",
  "Plastic Injection Moulding",
  "Welding / Fabrication",
  "Electroplating / Surface Treatment",
  "Painting / Powder Coating",
  "Assembly",
  "Thermal Processing (Heat Treatment)",
  "Other",
];

export default function DrawingPage() {
  const { id: auditId } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [partNumber, setPartNumber] = useState("");
  const [partDescription, setPartDescription] = useState("");
  const [processType, setProcessType] = useState(PROCESS_TYPES[0]);
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
    const result = await getDrawingAnalysis({
      supplierName: audit.supplierName,
      partNumber,
      partDescription,
      processType,
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
    if (!imageFile) return;
    const evId = nanoid();
    const blobKey = `evidence_blob_${evId}`;
    await saveBlob(blobKey, imageFile);
    const ev: Evidence = {
      id: evId,
      auditId,
      type: "DOCUMENT",
      fileName: imageFile.name,
      mimeType: imageFile.type,
      caption: `Drawing: ${partNumber || "unlabelled"} — ${processType} — ${formatDateTime(new Date().toISOString())}`,
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
        title="Drawing Analysis"
        subtitle={`${audit.supplierName} — Identify CTF characteristics and verification requirements`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Audits", href: "/audits" },
          { label: audit.supplierName, href: `/audits/${auditId}` },
          { label: "Drawing Analysis" },
        ]}
      />

      <div className="ai-suggestion-block">
        <strong>AI advisory:</strong> Drawing analysis is AI-generated (GPT-4o vision) and for reference only.
        The auditor must independently assess all characteristics. AI cannot approve or reject any requirement.
      </div>

      {/* Drawing metadata */}
      <Card title="Drawing Details">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Part Number</label>
            <input
              type="text"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              placeholder="e.g. ABC-12345-A"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Part Description</label>
            <input
              type="text"
              value={partDescription}
              onChange={(e) => setPartDescription(e.target.value)}
              placeholder="e.g. Machined housing"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Manufacturing Process</label>
            <select
              value={processType}
              onChange={(e) => setProcessType(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PROCESS_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Photo capture */}
      <Card title="Photograph Drawing">
        <div className="flex flex-wrap gap-3">
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded flex items-center gap-2">
            <span>📷</span> Take Photo
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
          </label>
          <label className="cursor-pointer border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded hover:bg-slate-50 flex items-center gap-2">
            <span>📁</span> Upload Drawing Image
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Ensure the drawing is well-lit and the title block, revision, and key characteristics are visible.
          Use multiple photos for large drawings.
        </p>
      </Card>

      {/* Preview + Analysis */}
      {imageDataUrl && (
        <Card title={`Drawing — ${partNumber || "unlabelled"}`}>
          <div className="space-y-4">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageDataUrl}
                alt="Drawing preview"
                className="w-full max-h-96 object-contain rounded border border-slate-200 bg-slate-50"
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-2 right-2 bg-white border border-slate-300 text-slate-600 text-xs px-2 py-1 rounded hover:bg-slate-50"
              >
                ✕ Clear
              </button>
            </div>

            <AISuggestionBox
              suggestion={aiSuggestion}
              loading={aiLoading}
              error={aiError}
              onRequest={handleAnalyse}
              buttonLabel="✦ Analyse Drawing with AI"
            />

            <div className="flex items-center gap-3 pt-2">
              {!saved ? (
                <button
                  type="button"
                  onClick={handleSaveEvidence}
                  className="border border-slate-300 text-slate-600 text-sm px-4 py-1.5 rounded hover:bg-slate-50"
                >
                  Save Drawing as Evidence
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
