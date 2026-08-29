"use client";
/**
 * app/audits/[id]/voice/page.tsx — Voice Recording + Whisper Transcription
 *
 * Records audit conversations using the browser MediaRecorder API.
 * Transcription is sent to the secure /api/ai/transcribe server route.
 *
 * Consent: recording only starts after explicit auditor consent acknowledgement.
 * Transcripts are stored as Evidence records in IndexedDB (type: TRANSCRIPT).
 */
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getAudit, saveEvidence, saveBlob } from "@/lib/storage/db";
import { nanoid } from "@/lib/utils/nanoid";
import { formatDateTime } from "@/lib/utils/format";
import type { Audit, Evidence } from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

interface TranscriptRecord {
  id: string;
  startedAt: string;
  durationSec: number;
  transcript: string;
  status: "pending" | "transcribing" | "done" | "error";
  error?: string;
}

export default function VoicePage() {
  const { id: auditId } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [consentGiven, setConsentGiven] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([]);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<string>("");

  useEffect(() => {
    getAudit(auditId).then((a) => { setAudit(a ?? null); setLoading(false); });
  }, [auditId]);

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Your browser does not support microphone access.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      startTimeRef.current = new Date().toISOString();

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); handleTranscribe(); };
      mr.start(1000);
      mediaRef.current = mr;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      alert("Could not access microphone. Please check browser permissions.");
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }

  async function handleTranscribe() {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size < 1000) return; // too short
    const recId = nanoid();
    const startedAt = startTimeRef.current;
    const durationSec = elapsed;

    setTranscripts((prev) => [
      { id: recId, startedAt, durationSec, transcript: "", status: "transcribing" },
      ...prev,
    ]);

    try {
      const formData = new FormData();
      formData.append("file", blob, "recording.webm");
      formData.append("auditId", auditId);

      const res = await fetch("/api/ai/transcribe", { method: "POST", body: formData });
      const data = (await res.json()) as { transcript?: string; error?: string };

      if (!res.ok || data.error) {
        setTranscripts((prev) =>
          prev.map((t) => t.id === recId ? { ...t, status: "error", error: data.error ?? "Transcription failed" } : t)
        );
        return;
      }

      const transcript = data.transcript ?? "";
      // Save as evidence
      const evId = nanoid();
      const blobKey = `evidence_blob_${evId}`;
      await saveBlob(blobKey, blob);
      const ev: Evidence = {
        id: evId,
        auditId,
        type: "TRANSCRIPT",
        fileName: `transcript_${new Date(startedAt).toISOString().slice(0, 10)}.txt`,
        mimeType: "text/plain",
        caption: `Voice transcript — ${formatDateTime(startedAt)}`,
        takenAt: startedAt,
        linkedTo: [],
        dataClassification: "PROTOTYPE_ONLY",
        blobKey,
      };
      await saveEvidence(ev);

      setTranscripts((prev) =>
        prev.map((t) => t.id === recId ? { ...t, status: "done", transcript, durationSec } : t)
      );
    } catch {
      setTranscripts((prev) =>
        prev.map((t) => t.id === recId ? { ...t, status: "error", error: "Network error during transcription." } : t)
      );
    }
  }

  function formatElapsed(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  }

  if (loading) return <LoadingSpinner />;
  if (!audit) return <div className="text-center py-16 text-slate-500">Audit not found. <Link href="/audits" className="text-blue-600 hover:underline">Back</Link></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice Recording"
        subtitle={`${audit.supplierName} — Capture and transcribe audit conversations`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Audits", href: "/audits" },
          { label: audit.supplierName, href: `/audits/${auditId}` },
          { label: "Voice" },
        ]}
      />

      {/* Consent gate */}
      {!consentGiven ? (
        <Card title="Recording Consent Required">
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-800">
              <p className="font-semibold mb-2">⚠ Before recording, you must confirm:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>All participants have been informed that the conversation will be recorded and transcribed.</li>
                <li>Consent has been obtained from all parties present.</li>
                <li>Recording is permitted under applicable local laws and company policy.</li>
                <li>Transcripts will be stored locally in this browser (prototype — not encrypted).</li>
                <li>AI transcription may not be perfectly accurate — auditor must review all transcripts.</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setConsentGiven(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-6 py-2 rounded"
            >
              I confirm consent has been obtained — Enable Recording
            </button>
          </div>
        </Card>
      ) : (
        <>
          {/* Recording controls */}
          <Card title="Recording Controls">
            <div className="flex items-center gap-6">
              {recording ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                    <span className="text-red-600 font-bold text-sm">RECORDING</span>
                    <span className="font-mono text-lg text-slate-700">{formatElapsed(elapsed)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-5 py-2 rounded"
                  >
                    ⏹ Stop &amp; Transcribe
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-6 py-2 rounded flex items-center gap-2"
                >
                  <span>🎙</span> Start Recording
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Transcription uses OpenAI Whisper via a secure server-side route. Audio is not stored by OpenAI
              after transcription. Transcripts are saved as evidence in this audit.
            </p>
          </Card>

          {/* Transcripts */}
          {transcripts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">Transcripts ({transcripts.length})</h2>
              {transcripts.map((t) => (
                <Card key={t.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-slate-500">
                      {formatDateTime(t.startedAt)} · {formatElapsed(t.durationSec)}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      t.status === "done" ? "bg-green-100 text-green-700" :
                      t.status === "transcribing" ? "bg-blue-100 text-blue-700" :
                      t.status === "error" ? "bg-red-100 text-red-700" :
                      "bg-slate-100 text-slate-500"
                    }`}>
                      {t.status === "transcribing" ? "Transcribing…" : t.status.toUpperCase()}
                    </span>
                  </div>
                  {t.status === "transcribing" && (
                    <div className="flex items-center gap-2 text-xs text-blue-700">
                      <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Sending to Whisper…
                    </div>
                  )}
                  {t.status === "error" && (
                    <p className="text-xs text-red-600">⚠ {t.error}</p>
                  )}
                  {t.status === "done" && (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{t.transcript}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <div className="pt-2">
        <Link href={`/audits/${auditId}`} className="text-sm text-slate-600 hover:underline">
          ← Back to Audit
        </Link>
      </div>
    </div>
  );
}
