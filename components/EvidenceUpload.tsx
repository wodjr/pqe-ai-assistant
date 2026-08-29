"use client";
/**
 * components/EvidenceUpload.tsx
 * File + camera-capture input. Stores blobs in IndexedDB.
 * Supports linking evidence to questions, findings, or CARs.
 */

import { useRef, useState } from "react";
import { nanoid } from "@/lib/utils/nanoid";
import { saveEvidence, saveBlob } from "@/lib/storage/db";
import { formatDateTime } from "@/lib/utils/format";
import type { Evidence, EvidenceLink, EvidenceType } from "@/types/project";

interface Props {
  auditId: string;
  link: EvidenceLink;
  existingEvidence: Evidence[];
  onAdded: (ev: Evidence) => void;
  onRemove?: (evId: string) => void;
}

export default function EvidenceUpload({
  auditId,
  link,
  existingEvidence,
  onAdded,
  onRemove,
}: Props) {
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File, type: EvidenceType) {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const id = nanoid();
      const blobKey = `evidence_blob_${id}`;
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });

      const ev: Evidence = {
        id,
        auditId,
        type,
        fileName: file.name,
        mimeType: file.type,
        caption: caption || file.name,
        takenAt: new Date().toISOString(),
        linkedTo: [link],
        dataClassification: "PROTOTYPE_ONLY",
        blobKey,
      };

      await saveBlob(blobKey, blob);
      await saveEvidence(ev);
      onAdded(ev);
      setCaption("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save evidence");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Caption field */}
      <input
        type="text"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Caption / description (optional)"
        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="flex flex-wrap gap-2">
        {/* Camera capture */}
        <button
          type="button"
          disabled={saving}
          onClick={() => photoRef.current?.click()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
        >
          📷 Take Photo
        </button>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f, "PHOTO");
            e.target.value = "";
          }}
        />

        {/* File upload */}
        <button
          type="button"
          disabled={saving}
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
        >
          📎 Attach File
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xlsx,.xls,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f, f.type.startsWith("image/") ? "PHOTO" : "DOCUMENT");
            e.target.value = "";
          }}
        />
      </div>

      {saving && <p className="text-sm text-slate-500">Saving evidence…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Existing evidence list */}
      {existingEvidence.length > 0 && (
        <ul className="space-y-1 mt-2">
          {existingEvidence.map((ev) => (
            <li
              key={ev.id}
              className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm"
            >
              <div>
                <span className="font-medium">{ev.caption || ev.fileName}</span>
                <span className="ml-2 text-slate-400 text-xs">{ev.type}</span>
                <span className="ml-2 text-slate-400 text-xs">{formatDateTime(ev.takenAt)}</span>
              </div>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(ev.id)}
                  className="text-red-500 hover:text-red-700 text-xs ml-2"
                  aria-label={`Remove ${ev.fileName}`}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
