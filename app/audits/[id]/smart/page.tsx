"use client";
/**
 * app/audits/[id]/smart/page.tsx — Smart Audit Note Taker (v0.5.0)
 *
 * Plaud-style live meeting recorder and AI note-taking experience designed
 * specifically for PQE/SQE supplier audits and manufacturing line walkthroughs.
 *
 * Mobile-first, one-handed operation.
 * Human-in-the-loop: AI suggestions are strictly advisory and never auto-set approvals.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getAudit,
  getChecklist,
  getSmartSessionsByAudit,
  saveSmartSession,
  saveBlob,
  saveEvidence,
} from "@/lib/storage/db";
import { nanoid } from "@/lib/utils/nanoid";
import { getSupportedAudioMimeType } from "@/lib/utils/format";
import {
  getSmartNotesSuggestion,
  getSmartPhotoSuggestion,
  isAIError,
} from "@/lib/aiSuggest";
import type {
  Audit,
  ChecklistTemplate,
  SmartAuditSession,
  TranscriptSegment,
  VoiceMarker,
  VoiceMarkerType,
  SessionPhoto,
  Evidence,
  SmartAuditorPrompt,
  SmartQuestionPriority,
  SmartChecklistCoverageItem,
  ChecklistCoverageStatus,
  SpeakerProfile,
} from "@/types/project";
import {
  getSmartQuestionsSuggestion,
  getSmartCoverageSuggestion,
  getSmartSessionSummarySuggestion,
} from "@/lib/aiSuggest";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import LoadingSpinner from "@/components/LoadingSpinner";
import AISuggestionBox from "@/components/AISuggestionBox";

// Helper to format seconds as MM:SS or HH:MM:SS
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const MARKER_CONFIG: Record<
  VoiceMarkerType,
  { label: string; emoji: string; color: string; border: string; bg: string }
> = {
  POTENTIAL_FINDING: {
    label: "Potential Finding",
    emoji: "🔴",
    color: "text-red-700",
    border: "border-red-300",
    bg: "bg-red-50",
  },
  PQE_NOTE: {
    label: "PQE Note",
    emoji: "📝",
    color: "text-blue-700",
    border: "border-blue-300",
    bg: "bg-blue-50",
  },
  TAKE_ACTION: {
    label: "Take Action",
    emoji: "⚡",
    color: "text-amber-700",
    border: "border-amber-300",
    bg: "bg-amber-50",
  },
  FOLLOW_UP: {
    label: "Follow Up",
    emoji: "🔄",
    color: "text-purple-700",
    border: "border-purple-300",
    bg: "bg-purple-50",
  },
  GOOD_PRACTICE: {
    label: "Good Practice",
    emoji: "⭐",
    color: "text-green-700",
    border: "border-green-300",
    bg: "bg-green-50",
  },
  NEED_EVIDENCE: {
    label: "Need Evidence",
    emoji: "🔍",
    color: "text-indigo-700",
    border: "border-indigo-300",
    bg: "bg-indigo-50",
  },
};

export default function SmartAuditPage() {
  const { id: auditId } = useParams<{ id: string }>();

  // Core audit state
  const [audit, setAudit] = useState<Audit | null>(null);
  const [checklist, setChecklist] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  // Consent & setup
  const [consentGiven, setConsentGiven] = useState(false);
  const [session, setSession] = useState<SmartAuditSession | null>(null);

  // Live recording state
  const [recordingState, setRecordingState] = useState<"IDLE" | "RECORDING" | "PAUSED" | "COMPLETED">("IDLE");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [activeTab, setActiveTab] = useState<"transcript" | "smart_notes" | "markers_photos" | "checklist_matrix" | "session_summary">("transcript");

  // AI analysis state
  const [aiNotesText, setAiNotesText] = useState<string | null>(null);
  const [aiNotesLoading, setAiNotesLoading] = useState(false);
  const [aiNotesError, setAiNotesError] = useState<string | null>(null);

  // AI Prompts state (v0.5B Real-time suggested questions)
  const [prompts, setPrompts] = useState<SmartAuditorPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptsError, setPromptsError] = useState<string | null>(null);

  // AI Checklist Awareness & End Session Summary (v0.5C)
  const [coverage, setCoverage] = useState<SmartChecklistCoverageItem[]>([]);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageError, setCoverageError] = useState<string | null>(null);

  const [sessionSummary, setSessionSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Photo capture modal state
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState("");
  const [photoProcess, setPhotoProcess] = useState("");
  const [photoQuestionId, setPhotoQuestionId] = useState("");
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoAiAnalysis, setPhotoAiAnalysis] = useState<string | null>(null);
  const [photoAiLoading, setPhotoAiLoading] = useState(false);

  // Text marker manual input
  const [customMarkerText, setCustomMarkerText] = useState("");
  const [customMarkerType, setCustomMarkerType] = useState<VoiceMarkerType>("PQE_NOTE");
  const [showMarkerInput, setShowMarkerInput] = useState(false);

  // Speaker Diarization & Playback State
  const [speakers, setSpeakers] = useState<SpeakerProfile[]>([
    { id: "speaker_1", name: "Speaker 1", role: "Unassigned", color: "blue" },
    { id: "speaker_2", name: "Speaker 2", role: "Unassigned", color: "emerald" },
    { id: "speaker_3", name: "Speaker 3", role: "Unassigned", color: "purple" },
    { id: "speaker_4", name: "Speaker 4", role: "Unassigned", color: "amber" },
    { id: "speaker_5", name: "Speaker 5", role: "Unassigned", color: "rose" },
    { id: "speaker_6", name: "Speaker 6", role: "Unassigned", color: "cyan" },
  ]);
  const [editingSpeaker, setEditingSpeaker] = useState<{ segmentId: string; speakerId: string; currentName: string; currentRole: string } | null>(null);
  const [newSpeakerName, setNewSpeakerName] = useState("");
  const [newSpeakerRole, setNewSpeakerRole] = useState("Unassigned");
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recordedAudioChunksRef = useRef<Blob[]>([]);
  const lastSpeakerIdRef = useRef<string>("speaker_1");
  const lastUtteranceTimeRef = useRef<number>(0);
  const isRecordingRef = useRef<boolean>(false);
  const recognitionWatchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs for audio & speech recognition
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecognitionRef = useRef<any>(null);
  const sessionRef = useRef<SmartAuditSession | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const transcriptBottomRef = useRef<HTMLDivElement>(null);

  // Keep sessionRef in sync with state for callbacks
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Load audit & checklist
  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 2000);

    async function load() {
      try {
        const a = await getAudit(auditId);
        if (!isMounted) return;
        if (!a) {
          setLoading(false);
          return;
        }
        setAudit(a);

        const [cl, existing] = await Promise.all([
          getChecklist(a.checklistTemplateId).catch(() => null),
          getSmartSessionsByAudit(auditId).catch(() => []),
        ]);

        if (!isMounted) return;
        setChecklist(cl ?? null);

        if (existing && existing.length > 0) {
          const recent = existing[existing.length - 1];
          if (recent.status !== "COMPLETED") {
            setSession(recent);
            setElapsedSeconds(recent.durationSec);
            setRecordingState(recent.status);
            if (recent.prompts?.length) {
              setPrompts(recent.prompts);
            }
            if (recent.coverage?.length) {
              setCoverage(recent.coverage);
            }
            if (recent.endSessionSummary) {
              setSessionSummary(recent.endSessionSummary);
            }
            setConsentGiven(true);
          }
        }
      } catch (err) {
        console.error("Failed to load smart session:", err);
      } finally {
        clearTimeout(safetyTimer);
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [auditId]);

  // Autosave helper to IndexedDB
  const persistSession = useCallback(async (updated: SmartAuditSession) => {
    setSession(updated);
    await saveSmartSession(updated);
  }, []);

  // Quick Voice Marker Trigger Detector
  const checkVoiceMarkers = useCallback(
    (text: string, currentSec: number) => {
      if (!sessionRef.current) return;
      const lower = text.toLowerCase();

      const triggers: { phrase: string; type: VoiceMarkerType }[] = [
        { phrase: "potential finding", type: "POTENTIAL_FINDING" },
        { phrase: "finding", type: "POTENTIAL_FINDING" },
        { phrase: "pqe note", type: "PQE_NOTE" },
        { phrase: "take action", type: "TAKE_ACTION" },
        { phrase: "action item", type: "TAKE_ACTION" },
        { phrase: "follow up", type: "FOLLOW_UP" },
        { phrase: "good practice", type: "GOOD_PRACTICE" },
        { phrase: "need evidence", type: "NEED_EVIDENCE" },
        { phrase: "show me evidence", type: "NEED_EVIDENCE" },
      ];

      for (const t of triggers) {
        if (lower.includes(t.phrase)) {
          // Extract text following trigger phrase if available
          const idx = lower.indexOf(t.phrase);
          const rawNote = text.slice(idx + t.phrase.length).replace(/^[:\s—-]+/, "").trim();
          const cleanText = rawNote.length > 0 ? rawNote : text;

          // Prevent duplicate markers within 5 seconds with same type
          const recentMarker = sessionRef.current.markers[sessionRef.current.markers.length - 1];
          if (recentMarker && recentMarker.type === t.type && Math.abs(recentMarker.timestampSec - currentSec) < 4) {
            return;
          }

          const newMarker: VoiceMarker = {
            id: nanoid(),
            timestamp: formatDuration(currentSec),
            timestampSec: currentSec,
            type: t.type,
            text: cleanText,
          };

          const updated: SmartAuditSession = {
            ...sessionRef.current,
            markers: [...sessionRef.current.markers, newMarker],
            updatedAt: new Date().toISOString(),
          };
          persistSession(updated);
          break;
        }
      }
    },
    [persistSession]
  );

  // Initialize Speech Recognition & Media Recorder
  const startRecordingSession = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Microphone access is not supported by your browser.");
      return;
    }

    try {
      // Audio Enhancement: Noise suppression, acoustic echo cancellation, and auto-gain
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
        },
      });
      audioStreamRef.current = stream;
      isRecordingRef.current = true;

      const mimeType = getSupportedAudioMimeType();
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      recordedAudioChunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedAudioChunksRef.current.push(e.data);
        }
      };

      mr.onstop = async () => {
        if (recordedAudioChunksRef.current.length > 0 && sessionRef.current) {
          const completeAudioBlob = new Blob(recordedAudioChunksRef.current, {
            type: mimeType || "audio/webm",
          });
          const audioKey = `smart_audio_${sessionRef.current.id}`;
          await saveBlob(audioKey, completeAudioBlob);
          if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl);
          const url = URL.createObjectURL(completeAudioBlob);
          setActiveAudioUrl(url);
          const updated: SmartAuditSession = {
            ...sessionRef.current,
            audioBlobKey: audioKey,
          };
          persistSession(updated);
        }
      };

      mr.start(1000);

      // Default neutral speaker profiles — AI does not assume names unless confirmed
      const neutralSpeakers: SpeakerProfile[] = [
        { id: "speaker_1", name: "Speaker 1", role: "Unassigned", color: "blue" },
        { id: "speaker_2", name: "Speaker 2", role: "Unassigned", color: "emerald" },
        { id: "speaker_3", name: "Speaker 3", role: "Unassigned", color: "purple" },
        { id: "speaker_4", name: "Speaker 4", role: "Unassigned", color: "amber" },
        { id: "speaker_5", name: "Speaker 5", role: "Unassigned", color: "rose" },
        { id: "speaker_6", name: "Speaker 6", role: "Unassigned", color: "cyan" },
      ];

      // Create new session if none exists
      let currentSession = sessionRef.current;
      if (!currentSession || currentSession.status === "COMPLETED") {
        currentSession = {
          id: nanoid(),
          auditId,
          title: `Smart Audit Session — ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          startedAt: new Date().toISOString(),
          endedAt: null,
          status: "RECORDING",
          durationSec: 0,
          speakers: neutralSpeakers,
          transcriptSegments: [],
          markers: [],
          photos: [],
          aiNotes: [],
          updatedAt: new Date().toISOString(),
        };
        setSpeakers(neutralSpeakers);
        await persistSession(currentSession);
        setElapsedSeconds(0);
      } else {
        const existingOrNeutral = (currentSession.speakers && currentSession.speakers.length > 0)
          ? currentSession.speakers
          : neutralSpeakers;

        currentSession = {
          ...currentSession,
          status: "RECORDING",
          speakers: existingOrNeutral,
          updatedAt: new Date().toISOString(),
        };
        setSpeakers(existingOrNeutral);
        await persistSession(currentSession);
      }

      setRecordingState("RECORDING");

      // Start duration timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((sec) => {
          const newSec = sec + 1;
          if (sessionRef.current) {
            sessionRef.current.durationSec = newSec;
            // periodic background save every 5 seconds
            if (newSec % 5 === 0) {
              saveSmartSession({ ...sessionRef.current, durationSec: newSec });
            }
          }
          return newSec;
        });
      }, 1000);

      // Continuous Auto-Reconnecting Speech Recognition
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const setupRecognition = () => {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recognition.onresult = (event: any) => {
            let interim = "";
            let final = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                final += event.results[i][0].transcript;
              } else {
                interim += event.results[i][0].transcript;
              }
            }

            setInterimTranscript(interim);

            if (final.trim().length > 0 && sessionRef.current) {
              const currentSec = sessionRef.current.durationSec;
              const timeDiff = currentSec - lastUtteranceTimeRef.current;
              lastUtteranceTimeRef.current = currentSec;

              const textLower = final.trim().toLowerCase();
              const activeSpeakers = sessionRef.current.speakers || speakers;

              // Voice Turn Detection across 4+ speakers:
              let assignedSpeakerId = lastSpeakerIdRef.current;
              const isExplicitAuditorMarker = textLower.startsWith("pqe") || textLower.includes("finding") || textLower.includes("potential nonconformance");

              if (isExplicitAuditorMarker) {
                assignedSpeakerId = "speaker_1";
              } else if (timeDiff > 3.0) {
                // Significant pause -> cycle to next speaker turn (1 -> 2 -> 3 -> 4)
                const currentNum = parseInt(lastSpeakerIdRef.current.replace("speaker_", ""), 10) || 1;
                const nextNum = (currentNum % 4) + 1;
                assignedSpeakerId = `speaker_${nextNum}`;
              }

              lastSpeakerIdRef.current = assignedSpeakerId;

              const speakerObj = activeSpeakers.find((s) => s.id === assignedSpeakerId) || {
                id: assignedSpeakerId,
                name: `Speaker ${assignedSpeakerId.replace("speaker_", "")}`,
                role: "Unassigned",
              };

              const newSegment: TranscriptSegment = {
                id: nanoid(),
                timestamp: formatDuration(currentSec),
                timestampSec: currentSec,
                audioStartSec: Math.max(0, currentSec - 5),
                audioEndSec: currentSec,
                text: final.trim(),
                isFinal: true,
                speakerId: speakerObj.id,
                speakerName: speakerObj.name,
                speakerRole: speakerObj.role,
              };

              const updatedSession: SmartAuditSession = {
                ...sessionRef.current,
                transcriptSegments: [...sessionRef.current.transcriptSegments, newSegment],
                updatedAt: new Date().toISOString(),
              };
              persistSession(updatedSession);
              checkVoiceMarkers(final.trim(), currentSec);
              setInterimTranscript("");
            }
          };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recognition.onerror = (e: any) => {
            console.warn("Speech recognition warning:", e.error);
          };

          recognition.onend = () => {
            // Auto-reconnect seamlessly if recording is still active
            if (isRecordingRef.current) {
              setTimeout(() => {
                if (isRecordingRef.current) {
                  try {
                    recognition.start();
                  } catch {
                    // re-instantiate if needed
                    setupRecognition();
                  }
                }
              }, 120);
            }
          };

          try {
            recognition.start();
          } catch {
            // ignore start error
          }
          speechRecognitionRef.current = recognition;
        };

        setupRecognition();

        // 15-second watchdog timer to ensure continuous recording never drops
        if (recognitionWatchdogRef.current) clearInterval(recognitionWatchdogRef.current);
        recognitionWatchdogRef.current = setInterval(() => {
          if (isRecordingRef.current && (!speechRecognitionRef.current || !audioStreamRef.current?.active)) {
            setupRecognition();
          }
        }, 15000);
      }
    } catch {
      alert("Could not start recording. Please grant microphone permissions in your browser.");
    }
  };

  const pauseRecording = () => {
    isRecordingRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionWatchdogRef.current) clearInterval(recognitionWatchdogRef.current);
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setRecordingState("PAUSED");
    if (sessionRef.current) {
      const updated: SmartAuditSession = {
        ...sessionRef.current,
        status: "PAUSED",
        durationSec: elapsedSeconds,
        updatedAt: new Date().toISOString(),
      };
      persistSession(updated);
    }
  };

  const resumeRecording = () => {
    isRecordingRef.current = true;
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.start();
      } catch {
        // ignore
      }
    }
    timerRef.current = setInterval(() => {
      setElapsedSeconds((sec) => {
        const newSec = sec + 1;
        if (sessionRef.current) {
          sessionRef.current.durationSec = newSec;
        }
        return newSec;
      });
    }, 1000);
    setRecordingState("RECORDING");
    if (sessionRef.current) {
      const updated: SmartAuditSession = {
        ...sessionRef.current,
        status: "RECORDING",
        updatedAt: new Date().toISOString(),
      };
      persistSession(updated);
    }
  };

  const stopRecording = async () => {
    isRecordingRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionWatchdogRef.current) clearInterval(recognitionWatchdogRef.current);
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    setRecordingState("COMPLETED");

    if (sessionRef.current) {
      const updated: SmartAuditSession = {
        ...sessionRef.current,
        status: "COMPLETED",
        endedAt: new Date().toISOString(),
        durationSec: elapsedSeconds,
        updatedAt: new Date().toISOString(),
      };
      await persistSession(updated);
    }
  };

  // Add Manual Quick Marker
  const addQuickMarker = (type: VoiceMarkerType, noteText?: string) => {
    if (!sessionRef.current) return;
    const currentSec = elapsedSeconds;
    const newMarker: VoiceMarker = {
      id: nanoid(),
      timestamp: formatDuration(currentSec),
      timestampSec: currentSec,
      type,
      text: noteText || MARKER_CONFIG[type].label,
    };

    const updated: SmartAuditSession = {
      ...sessionRef.current,
      markers: [...sessionRef.current.markers, newMarker],
      updatedAt: new Date().toISOString(),
    };
    persistSession(updated);
    setCustomMarkerText("");
    setShowMarkerInput(false);
  };

  // Trigger Real-time Prioritized Auditor Questions (v0.5B)
  const runAiQuestionsAnalysis = async () => {
    if (!session || !audit) return;
    const allText = session.transcriptSegments.map((s) => `[${s.timestamp}] ${s.text}`).join("\n");
    if (allText.trim().length === 0) {
      setPromptsError("No spoken discussion captured yet. Speak or record audio to generate questions.");
      return;
    }

    setPromptsLoading(true);
    setPromptsError(null);

    // Build checklist highlights
    const checklistHighlights = checklist?.sections
      .slice(0, 5)
      .map((s) => `${s.title}: ${s.questions.slice(0, 3).map((q) => q.reference).join(", ")}`)
      .join("\n");

    const result = await getSmartQuestionsSuggestion({
      supplierName: audit.supplierName,
      auditType: audit.auditType.replace(/_/g, " "),
      scope: audit.scope,
      checklistHighlights,
      transcript: allText,
    });

    if (isAIError(result)) {
      setPromptsError(result.error);
    } else {
      try {
        // Strip markdown code fences if OpenAI returned them
        const cleanJson = result.suggestion.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
        const parsed = JSON.parse(cleanJson) as {
          priority: SmartQuestionPriority;
          question: string;
          reason: string;
          suggestedAction?: string;
        }[];

        const newPrompts: SmartAuditorPrompt[] = parsed.slice(0, 3).map((p) => ({
          id: nanoid(),
          priority: p.priority || "IMPORTANT",
          question: p.question,
          reason: p.reason,
          suggestedAction: p.suggestedAction,
          timestamp: formatDuration(elapsedSeconds),
          timestampSec: elapsedSeconds,
          dismissed: false,
        }));

        setPrompts(newPrompts);

        if (sessionRef.current) {
          const updated: SmartAuditSession = {
            ...sessionRef.current,
            prompts: newPrompts,
            updatedAt: new Date().toISOString(),
          };
          persistSession(updated);
        }
      } catch {
        setPromptsError("Failed to parse suggested questions. Please try again.");
      }
    }
    setPromptsLoading(false);
  };

  const dismissPrompt = (promptId: string) => {
    const updatedPrompts = prompts.map((p) => (p.id === promptId ? { ...p, dismissed: true } : p));
    setPrompts(updatedPrompts);
    if (sessionRef.current) {
      const updated: SmartAuditSession = {
        ...sessionRef.current,
        prompts: updatedPrompts,
        updatedAt: new Date().toISOString(),
      };
      persistSession(updated);
    }
  };

  // Trigger Smart AI Notes Analysis
  const runAiNotesAnalysis = async () => {
    if (!session || !audit) return;
    const allText = session.transcriptSegments
      .map((s) => `[${s.speakerName || "Speaker"} (${s.speakerRole || "Participant"}) @ ${s.timestamp}] ${s.text}`)
      .join("\n");
    if (allText.trim().length === 0) {
      setAiNotesError("No spoken transcript captured yet. Speak or record audio first.");
      return;
    }

    setAiNotesLoading(true);
    setAiNotesError(null);

    const result = await getSmartNotesSuggestion({
      supplierName: audit.supplierName,
      auditType: audit.auditType.replace(/_/g, " "),
      scope: audit.scope,
      transcript: allText,
      recentMarkers: session.markers.map((m) => ({
        type: MARKER_CONFIG[m.type].label,
        text: m.text,
        timestamp: m.timestamp,
      })),
    });

    if (isAIError(result)) {
      setAiNotesError(result.error);
    } else {
      setAiNotesText(result.suggestion);
      setActiveTab("smart_notes");
    }
    setAiNotesLoading(false);
  };

  // Trigger Checklist Coverage Awareness Analysis (v0.5C)
  const runChecklistCoverageAnalysis = async () => {
    if (!session || !audit || !checklist) return;
    const allText = session.transcriptSegments.map((s) => `[${s.timestamp}] ${s.text}`).join("\n");
    if (allText.trim().length === 0) {
      setCoverageError("No spoken discussion captured yet. Record live discussion first.");
      return;
    }

    setCoverageLoading(true);
    setCoverageError(null);

    const checklistQuestions = checklist.sections.flatMap((s) =>
      s.questions.map((q) => ({
        id: q.id,
        reference: q.reference,
        text: q.text,
      }))
    );

    const result = await getSmartCoverageSuggestion({
      supplierName: audit.supplierName,
      auditType: audit.auditType.replace(/_/g, " "),
      transcript: allText,
      checklistQuestions,
    });

    if (isAIError(result)) {
      setCoverageError(result.error);
    } else {
      try {
        const cleanJson = result.suggestion.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
        const parsed = JSON.parse(cleanJson) as {
          questionId: string;
          questionRef: string;
          status: ChecklistCoverageStatus;
          analysis: string;
          evidenceNeeded?: string;
        }[];

        const coverageItems: SmartChecklistCoverageItem[] = parsed.map((item) => {
          const matchedQ = checklistQuestions.find((q) => q.id === item.questionId);
          return {
            questionId: item.questionId,
            questionRef: item.questionRef || matchedQ?.reference || "—",
            questionText: matchedQ?.text || "",
            status: item.status || "NOT_COVERED",
            analysis: item.analysis,
            evidenceNeeded: item.evidenceNeeded,
          };
        });

        setCoverage(coverageItems);
        setActiveTab("checklist_matrix");

        if (sessionRef.current) {
          const updated: SmartAuditSession = {
            ...sessionRef.current,
            coverage: coverageItems,
            updatedAt: new Date().toISOString(),
          };
          persistSession(updated);
        }
      } catch {
        setCoverageError("Failed to parse checklist coverage. Please try again.");
      }
    }
    setCoverageLoading(false);
  };

  // Trigger End of Session Smart Summary (v0.5C)
  const runEndSessionSummary = async () => {
    if (!session || !audit) return;
    const allText = session.transcriptSegments
      .map((s) => `[${s.speakerName || "Speaker"} (${s.speakerRole || "Participant"}) @ ${s.timestamp}] ${s.text}`)
      .join("\n");
    if (allText.trim().length === 0) {
      setSummaryError("No spoken discussion recorded in this session.");
      return;
    }

    setSummaryLoading(true);
    setSummaryError(null);

    const coverageSummary = coverage.length
      ? coverage.map((c) => `[${c.questionRef}] ${c.status}: ${c.analysis}`).join("\n")
      : undefined;

    const result = await getSmartSessionSummarySuggestion({
      supplierName: audit.supplierName,
      supplierSite: audit.supplierSite,
      auditType: audit.auditType.replace(/_/g, " "),
      scope: audit.scope,
      durationSec: session.durationSec || elapsedSeconds,
      transcript: allText,
      markers: session.markers.map((m) => ({
        type: MARKER_CONFIG[m.type].label,
        text: m.text,
        timestamp: m.timestamp,
      })),
      photos: session.photos.map((p) => ({
        caption: p.caption,
        auditorNote: p.auditorNote,
        process: p.relatedProcess,
      })),
      checklistCoverage: coverageSummary,
    });

    if (isAIError(result)) {
      setSummaryError(result.error);
    } else {
      setSessionSummary(result.suggestion);
      setActiveTab("session_summary");

      if (sessionRef.current) {
        const updated: SmartAuditSession = {
          ...sessionRef.current,
          endSessionSummary: result.suggestion,
          updatedAt: new Date().toISOString(),
        };
        persistSession(updated);
      }
    }
    setSummaryLoading(false);
  };

  // Handle Photo selection from camera / file input
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPendingPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Pre-populate note if auditor was speaking
    setPhotoNote(interimTranscript || "");
    setPhotoAiAnalysis(null);
    setPhotoModalOpen(true);
  };

  // AI Photo Analysis
  const analyzePhotoWithAI = async () => {
    if (!audit) return;
    setPhotoAiLoading(true);

    // Find nearest transcript snippet
    const recentSegments = session?.transcriptSegments.slice(-3).map((s) => s.text).join(" ") || "";

    const res = await getSmartPhotoSuggestion({
      supplierName: audit.supplierName,
      processType: photoProcess || audit.scope,
      scope: audit.scope,
      auditorNote: photoNote,
      nearestTranscript: recentSegments,
      imageBase64: pendingPhotoPreview ?? undefined,
    });

    if (isAIError(res)) {
      setPhotoAiAnalysis(`Error: ${res.error}`);
    } else {
      setPhotoAiAnalysis(res.suggestion);
    }
    setPhotoAiLoading(false);
  };

  // Save Captured Photo to IndexedDB and link to session
  const saveCapturedPhoto = async () => {
    if (!pendingPhotoFile || !sessionRef.current) return;
    setPhotoSaving(true);

    try {
      const evId = nanoid();
      const blobKey = `evidence_blob_${evId}`;
      await saveBlob(blobKey, pendingPhotoFile);

      // Create linked evidence record
      const linkedTo: Evidence["linkedTo"] = [];
      if (photoQuestionId) {
        linkedTo.push({ type: "QUESTION", targetId: photoQuestionId });
      }

      const ev: Evidence = {
        id: evId,
        auditId,
        type: "PHOTO",
        fileName: pendingPhotoFile.name || `photo_${Date.now()}.jpg`,
        mimeType: pendingPhotoFile.type || "image/jpeg",
        caption: photoNote || `Smart Audit Photo @ ${formatDuration(elapsedSeconds)}`,
        takenAt: new Date().toISOString(),
        linkedTo,
        dataClassification: "PROTOTYPE_ONLY",
        blobKey,
      };
      await saveEvidence(ev);

      // Add to Session photos
      const sessionPhoto: SessionPhoto = {
        id: nanoid(),
        evidenceId: evId,
        blobKey,
        timestamp: formatDuration(elapsedSeconds),
        timestampSec: elapsedSeconds,
        caption: ev.caption,
        auditorNote: photoNote,
        relatedQuestionId: photoQuestionId || undefined,
        relatedProcess: photoProcess || undefined,
        aiSuggestedRisk: photoAiAnalysis || undefined,
      };

      const updated: SmartAuditSession = {
        ...sessionRef.current,
        photos: [...sessionRef.current.photos, sessionPhoto],
        updatedAt: new Date().toISOString(),
      };
      await persistSession(updated);

      // Reset modal state
      setPhotoModalOpen(false);
      setPendingPhotoFile(null);
      setPendingPhotoPreview(null);
      setPhotoNote("");
      setPhotoProcess("");
      setPhotoQuestionId("");
      setPhotoAiAnalysis(null);
    } catch {
      alert("Failed to save photo evidence.");
    } finally {
      setPhotoSaving(false);
    }
  };

  // Scroll transcript to bottom on new message
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.transcriptSegments.length, interimTranscript]);

  if (loading) {
    return <LoadingSpinner text="Loading Smart Audit Studio…" />;
  }

  if (!audit) {
    return (
      <div className="space-y-4">
        <PageHeader title="Audit Not Found" />
        <Card>
          <p className="text-slate-600 text-sm">The requested audit does not exist.</p>
          <Link href="/audits" className="mt-3 inline-block btn-secondary text-xs">
            Back to Audits
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Page Header */}
      <PageHeader
        title="🎙 Smart Audit Note Taker"
        subtitle={`${audit.supplierName} · ${audit.auditType.replace(/_/g, " ")} · Plaud-Style Live Meeting & Walkthrough Recorder`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Audits", href: "/audits" },
          { label: audit.supplierName, href: `/audits/${auditId}` },
          { label: "Smart Audit" },
        ]}
        action={
          <Link href={`/audits/${auditId}`} className="btn-secondary text-xs">
            ← Back to Audit Hub
          </Link>
        }
      />

      {/* Recording Consent Gate (if not yet accepted) */}
      {!consentGiven && (
        <Card title="🔒 Auditor & Supplier Recording Consent">
          <div className="space-y-3 text-sm text-slate-700">
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-amber-900 text-xs">
              <strong>Mandatory Consent Notice:</strong> All participants present in the meeting or line walkthrough must be informed that audio is being recorded for the purpose of procurement quality verification and audit note-taking.
            </div>
            <p className="text-xs text-slate-500">
              Audio is processed in real time and stored securely in your browser. Live transcript snippets can be analyzed by AI to generate structured notes and question prompts. AI suggestions are strictly advisory and never replace the auditor’s approval.
            </p>
            <button
              onClick={() => {
                setConsentGiven(true);
                startRecordingSession();
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <span>🎙</span>
              <span>I Confirm Consent &amp; Start Smart Audit</span>
            </button>
          </div>
        </Card>
      )}

      {/* Main Studio Area (When consent is given) */}
      {consentGiven && (
        <>
          {/* Mobile-Friendly Sticky Recorder Bar */}
          <div className="bg-slate-900 text-white rounded-xl p-4 shadow-lg border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Status & Timer */}
              <div className="flex items-center gap-3">
                {recordingState === "RECORDING" && (
                  <span className="relative flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
                  </span>
                )}
                {recordingState === "PAUSED" && (
                  <span className="h-3.5 w-3.5 rounded-full bg-amber-400 inline-block"></span>
                )}
                {recordingState === "COMPLETED" && (
                  <span className="h-3.5 w-3.5 rounded-full bg-slate-500 inline-block"></span>
                )}

                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    {recordingState === "RECORDING"
                      ? "Live Recording"
                      : recordingState === "PAUSED"
                      ? "Recording Paused"
                      : recordingState === "COMPLETED"
                      ? "Session Completed"
                      : "Ready"}
                  </div>
                  <div className="text-2xl font-mono font-bold tracking-tight text-white">
                    {formatDuration(elapsedSeconds)}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Pause / Resume / Stop / Add Photo */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Hidden file input for Photo */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={photoInputRef}
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition active:scale-95"
                  title="Capture or upload photo without interrupting recording"
                >
                  <span className="text-base">📷</span>
                  <span>Add Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowMarkerInput(!showMarkerInput)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition active:scale-95"
                >
                  <span className="text-base">🏷</span>
                  <span>Add Marker</span>
                </button>

                {recordingState === "RECORDING" && (
                  <button
                    type="button"
                    onClick={pauseRecording}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition active:scale-95"
                  >
                    <span>⏸</span>
                    <span>Pause</span>
                  </button>
                )}

                {recordingState === "PAUSED" && (
                  <button
                    type="button"
                    onClick={resumeRecording}
                    className="px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition active:scale-95"
                  >
                    <span>▶</span>
                    <span>Resume</span>
                  </button>
                )}

                {recordingState !== "COMPLETED" && (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition active:scale-95"
                  >
                    <span>⏹</span>
                    <span>Stop</span>
                  </button>
                )}

                {recordingState === "COMPLETED" && (
                  <button
                    type="button"
                    onClick={startRecordingSession}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition active:scale-95"
                  >
                    <span>🎙</span>
                    <span>New Session</span>
                  </button>
                )}
              </div>
            </div>

            {/* Real-time Suggested Question Assistant Tile (v0.5B) */}
            <div className="mt-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400">💡</span>
                  <span className="text-xs font-semibold text-slate-200">AI Suggested Auditor Questions (Prioritized)</span>
                </div>
                <button
                  type="button"
                  onClick={runAiQuestionsAnalysis}
                  disabled={promptsLoading || !session?.transcriptSegments.length}
                  className="text-[11px] text-amber-300 hover:text-amber-200 disabled:opacity-40 underline flex items-center gap-1"
                >
                  {promptsLoading ? <LoadingSpinner inline text="Analyzing..." /> : "Suggest Probing Questions"}
                </button>
              </div>

              {promptsError && (
                <div className="text-[11px] text-red-400 mb-2">{promptsError}</div>
              )}

              {prompts.filter((p) => !p.dismissed).length === 0 ? (
                <div className="bg-slate-800/80 rounded-lg p-2.5 text-xs text-slate-400 border border-slate-700/60 flex items-center justify-between">
                  <span>Listening quietly... Tap &quot;Suggest Probing Questions&quot; anytime to recommend high-priority checks.</span>
                  <button
                    type="button"
                    onClick={runAiQuestionsAnalysis}
                    disabled={promptsLoading || !session?.transcriptSegments.length}
                    className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded text-[11px] hover:bg-amber-500/30 transition disabled:opacity-30"
                  >
                    Suggest Now
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {prompts
                    .filter((p) => !p.dismissed)
                    .map((prompt) => (
                      <div
                        key={prompt.id}
                        className={`p-2.5 rounded-lg border text-xs transition ${
                          prompt.priority === "CRITICAL"
                            ? "bg-red-950/40 border-red-500/40 text-red-200"
                            : prompt.priority === "IMPORTANT"
                            ? "bg-amber-950/40 border-amber-500/40 text-amber-200"
                            : "bg-blue-950/40 border-blue-500/40 text-blue-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`font-bold uppercase text-[10px] px-1.5 py-0.5 rounded ${
                              prompt.priority === "CRITICAL"
                                ? "bg-red-500 text-white"
                                : prompt.priority === "IMPORTANT"
                                ? "bg-amber-500 text-slate-900"
                                : "bg-blue-500 text-white"
                            }`}
                          >
                            {prompt.priority} QUESTION
                          </span>
                          <button
                            type="button"
                            onClick={() => dismissPrompt(prompt.id)}
                            className="text-slate-400 hover:text-slate-200 text-xs px-1"
                            title="Dismiss question"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="font-semibold text-white text-xs mb-1">
                          &quot;{prompt.question}&quot;
                        </div>

                        <div className="text-[11px] text-slate-300 mb-0.5">
                          <strong className="text-slate-200">Reason:</strong> {prompt.reason}
                        </div>

                        {prompt.suggestedAction && (
                          <div className="text-[11px] text-slate-400">
                            <strong className="text-slate-300">Action:</strong> {prompt.suggestedAction}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Quick 1-Tap Voice Marker Bar for Shop Floor Walkthrough */}
            <div className="mt-3 pt-3 border-t border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1.5 font-medium flex items-center justify-between">
                <span>Quick Tap Voice Markers (or say &quot;PQE note&quot;, &quot;Potential finding&quot;, &quot;Take action&quot;):</span>
                <span className="text-slate-500">{session?.markers.length || 0} markers placed</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {(Object.keys(MARKER_CONFIG) as VoiceMarkerType[]).map((type) => {
                  const cfg = MARKER_CONFIG[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addQuickMarker(type)}
                      className="whitespace-nowrap px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs flex items-center gap-1 active:scale-95 transition"
                    >
                      <span>{cfg.emoji}</span>
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Manual Marker Input Expandable Drawer */}
            {showMarkerInput && (
              <div className="mt-3 p-3 bg-slate-800 rounded-lg border border-slate-700 space-y-2">
                <div className="text-xs text-slate-300 font-medium">Add Custom Note / Marker at {formatDuration(elapsedSeconds)}</div>
                <div className="flex gap-2">
                  <select
                    value={customMarkerType}
                    onChange={(e) => setCustomMarkerType(e.target.value as VoiceMarkerType)}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  >
                    {(Object.keys(MARKER_CONFIG) as VoiceMarkerType[]).map((t) => (
                      <option key={t} value={t}>
                        {MARKER_CONFIG[t].emoji} {MARKER_CONFIG[t].label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={customMarkerText}
                    onChange={(e) => setCustomMarkerText(e.target.value)}
                    placeholder="Type observation note..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1 text-xs text-white placeholder-slate-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customMarkerText.trim()) {
                        addQuickMarker(customMarkerType, customMarkerText.trim());
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customMarkerText.trim()) {
                        addQuickMarker(customMarkerType, customMarkerText.trim());
                      }
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tab Navigation for Studio Areas */}
          <div className="flex border-b border-slate-200 gap-4 text-sm font-medium">
            <button
              onClick={() => setActiveTab("transcript")}
              className={`pb-2.5 px-1 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "transcript"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>💬 Live Transcript</span>
              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full text-xs">
                {session?.transcriptSegments.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("smart_notes")}
              className={`pb-2.5 px-1 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "smart_notes"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>✨ Smart AI Notes</span>
              {aiNotesText && <span className="h-2 w-2 rounded-full bg-blue-600"></span>}
            </button>

            <button
              onClick={() => setActiveTab("markers_photos")}
              className={`pb-2.5 px-1 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "markers_photos"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>📸 Photos &amp; Markers</span>
              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full text-xs">
                {(session?.photos.length || 0) + (session?.markers.length || 0)}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("checklist_matrix")}
              className={`pb-2.5 px-1 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "checklist_matrix"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>📋 Checklist Matrix</span>
              {coverage.length > 0 && (
                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full text-xs">
                  {coverage.filter((c) => c.status === "COVERED").length}/{coverage.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("session_summary")}
              className={`pb-2.5 px-1 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "session_summary"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>📄 End Session Summary</span>
              {sessionSummary && <span className="h-2 w-2 rounded-full bg-green-600"></span>}
            </button>
          </div>

          {/* TAB 1: Live Transcript View */}
          {activeTab === "transcript" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <Card
                  title="Live Speech Stream"
                  action={
                    <button
                      onClick={runAiNotesAnalysis}
                      disabled={aiNotesLoading || !session?.transcriptSegments.length}
                      className="text-xs bg-blue-600 text-white font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1"
                    >
                      {aiNotesLoading ? <LoadingSpinner inline text="Analyzing..." /> : <><span>✨</span> Generate Smart Notes</>}
                    </button>
                  }
                >
                  <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                    {session?.transcriptSegments.length === 0 && !interimTranscript && (
                      <div className="py-12 text-center text-slate-400 text-sm">
                        <div className="text-3xl mb-2">🎙</div>
                        <p>Waiting for speech...</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Speak naturally into your device microphone.
                        </p>
                      </div>
                    )}

                    {session?.transcriptSegments.map((seg) => {
                      const spId = seg.speakerId || "speaker_1";
                      const isSp1 = spId === "speaker_1";
                      const isSp2 = spId === "speaker_2";
                      const isSp3 = spId === "speaker_3";

                      const badgeStyle = isSp1
                        ? "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200"
                        : isSp2
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200"
                        : isSp3
                        ? "bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200"
                        : "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200";

                      const cardStyle = isSp1
                        ? "bg-blue-50/40 border-blue-200/80"
                        : isSp2
                        ? "bg-emerald-50/30 border-emerald-200/70"
                        : isSp3
                        ? "bg-purple-50/30 border-purple-200/70"
                        : "bg-amber-50/30 border-amber-200/70";

                      return (
                        <div
                          key={seg.id}
                          className={`p-3 rounded-xl border text-sm text-slate-900 transition ${cardStyle}`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                            <div className="flex items-center gap-2">
                              {/* Interactive Speaker Badge (Plaud-Style) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSpeaker({
                                    segmentId: seg.id,
                                    speakerId: seg.speakerId || "speaker_1",
                                    currentName: seg.speakerName || "Speaker 1",
                                    currentRole: seg.speakerRole || "Unassigned",
                                  });
                                  setNewSpeakerName(seg.speakerName || "");
                                  setNewSpeakerRole(seg.speakerRole || "Unassigned");
                                }}
                                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 shadow-2xs transition ${badgeStyle}`}
                                title="Click to identify and name this voice"
                              >
                                <span>👤</span>
                                <span>{seg.speakerName || `Speaker ${spId.replace("speaker_", "")}`}</span>
                                <span className="opacity-50 text-[10px]">✎</span>
                              </button>

                              {seg.speakerRole && seg.speakerRole !== "Unassigned" && (
                                <span className="text-[10px] text-slate-500 uppercase font-mono tracking-tight bg-white/70 px-1.5 py-0.5 rounded border border-slate-200">
                                  {seg.speakerRole}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Audio Snippet Playback Button */}
                              {activeAudioUrl && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (audioPlayerRef.current) {
                                      audioPlayerRef.current.currentTime = seg.audioStartSec || seg.timestampSec;
                                      audioPlayerRef.current.play();
                                    }
                                  }}
                                  className="text-[11px] text-slate-500 hover:text-blue-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-2xs hover:shadow"
                                  title="Play audio snippet for this sentence"
                                >
                                  <span>▶</span>
                                  <span>Listen</span>
                                </button>
                              )}
                              <span className="font-mono text-slate-400 text-[11px]">{seg.timestamp}</span>
                            </div>
                          </div>
                          <p className="leading-relaxed pl-1">{seg.text}</p>
                        </div>
                      );
                    })}

                    {/* Active Interim Utterance */}
                    {interimTranscript && (
                      <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-sm text-blue-900 animate-pulse">
                        <div className="text-[11px] text-blue-600 font-mono mb-1">
                          {formatDuration(elapsedSeconds)} · Transcribing...
                        </div>
                        <p className="italic">{interimTranscript}</p>
                      </div>
                    )}
                    <div ref={transcriptBottomRef} />
                  </div>
                </Card>
              </div>

              {/* Sidebar: Markers & Fast Actions */}
              <div className="space-y-4">
                <Card title="Session Markers">
                  {session?.markers.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      No markers placed yet. Tap quick markers above or say &quot;PQE note&quot;.
                    </p>
                  ) : (
                    <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                      {session?.markers.map((m) => {
                        const cfg = MARKER_CONFIG[m.type];
                        return (
                          <div
                            key={m.id}
                            className={`p-2 rounded border text-xs ${cfg.bg} ${cfg.border} ${cfg.color}`}
                          >
                            <div className="flex items-center justify-between font-semibold mb-0.5">
                              <span>{cfg.emoji} {cfg.label}</span>
                              <span className="font-mono text-[10px] opacity-75">{m.timestamp}</span>
                            </div>
                            <div className="text-slate-700 font-normal">{m.text}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                {/* Scope & Checklist Context Preview */}
                <Card title="Audit Context">
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <div><span className="font-medium text-slate-700">Supplier:</span> {audit.supplierName}</div>
                    <div><span className="font-medium text-slate-700">Checklist:</span> {checklist?.name || "General"}</div>
                    {audit.scope && <div><span className="font-medium text-slate-700">Scope:</span> {audit.scope}</div>}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 2: Smart AI Notes View */}
          {activeTab === "smart_notes" && (
            <div className="space-y-4">
              <Card
                title="Smart Live AI Notes & Auditor Prompts"
                action={
                  <button
                    onClick={runAiNotesAnalysis}
                    disabled={aiNotesLoading || !session?.transcriptSegments.length}
                    className="text-xs bg-blue-600 text-white font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1"
                  >
                    {aiNotesLoading ? <LoadingSpinner inline text="Analyzing..." /> : <><span>🔄</span> Refresh AI Notes</>}
                  </button>
                }
              >
                {aiNotesError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs mb-3">
                    {aiNotesError}
                  </div>
                )}

                {aiNotesLoading && (
                  <div className="py-12">
                    <LoadingSpinner text="Extracting statements, commitments, process controls, risks and prompts..." />
                  </div>
                )}

                {!aiNotesLoading && !aiNotesText && (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    <div className="text-3xl mb-2">✨</div>
                    <p>No Smart AI Notes generated yet.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Click &quot;Generate Smart Notes&quot; to synthesize the live discussion into categorized statements, supplier commitments, and probing questions.
                    </p>
                    <button
                      onClick={runAiNotesAnalysis}
                      disabled={!session?.transcriptSegments.length}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Generate Notes Now
                    </button>
                  </div>
                )}

                {!aiNotesLoading && aiNotesText && (
                  <AISuggestionBox suggestion={aiNotesText} />
                )}
              </Card>
            </div>
          )}

          {/* TAB 3: Photos & Markers Log */}
          {activeTab === "markers_photos" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-700">Captured Photos &amp; Shop Floor Evidence</h3>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1"
                >
                  <span>📷</span>
                  <span>Take Another Photo</span>
                </button>
              </div>

              {session?.photos.length === 0 ? (
                <Card>
                  <p className="text-xs text-slate-400 text-center py-8">
                    No photos captured during this session yet. Tap &quot;Add Photo&quot; to take photos on the shop floor without interrupting recording.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {session?.photos.map((photo) => (
                    <Card key={photo.id}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-mono font-medium text-slate-600">⏱ {photo.timestamp}</span>
                          {photo.relatedProcess && (
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                              {photo.relatedProcess}
                            </span>
                          )}
                        </div>

                        {photo.auditorNote && (
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800">
                            <strong>Note:</strong> {photo.auditorNote}
                          </div>
                        )}

                        {photo.aiSuggestedRisk && (
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                            <strong className="block text-amber-800 mb-0.5">✨ AI Observation / Risk:</strong>
                            <p className="whitespace-pre-line text-[11px]">{photo.aiSuggestedRisk}</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Checklist Matrix Awareness (v0.5C) */}
          {activeTab === "checklist_matrix" && (
            <div className="space-y-4">
              <Card
                title="AI Checklist Coverage Awareness"
                action={
                  <button
                    onClick={runChecklistCoverageAnalysis}
                    disabled={coverageLoading || !session?.transcriptSegments.length}
                    className="text-xs bg-blue-600 text-white font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1"
                  >
                    {coverageLoading ? <LoadingSpinner inline text="Analyzing..." /> : <><span>🔄</span> Check Discussion Against Checklist</>}
                  </button>
                }
              >
                <div className="bg-blue-50 border border-blue-200 rounded p-2.5 text-xs text-blue-800 mb-3">
                  <strong>Human-in-the-Loop Safeguard:</strong> This matrix tracks what has been covered in live discussion vs. what is still missing. <em>AI never automatically marks checklist items as approved or completed.</em>
                </div>

                {coverageError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs mb-3">
                    {coverageError}
                  </div>
                )}

                {coverageLoading && (
                  <div className="py-12">
                    <LoadingSpinner text="Evaluating discussion coverage against checklist requirements..." />
                  </div>
                )}

                {!coverageLoading && coverage.length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    <div className="text-3xl mb-2">📋</div>
                    <p>No checklist coverage evaluated yet.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Click &quot;Check Discussion Against Checklist&quot; to identify covered items, partial areas, and missing objective evidence.
                    </p>
                    <button
                      onClick={runChecklistCoverageAnalysis}
                      disabled={!session?.transcriptSegments.length}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Evaluate Checklist Coverage
                    </button>
                  </div>
                )}

                {!coverageLoading && coverage.length > 0 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2 bg-green-50 border border-green-200 rounded">
                        <div className="text-lg font-bold text-green-700">
                          {coverage.filter((c) => c.status === "COVERED").length}
                        </div>
                        <div className="text-green-800 font-medium">Covered</div>
                      </div>
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded">
                        <div className="text-lg font-bold text-amber-700">
                          {coverage.filter((c) => c.status === "PARTIALLY_COVERED").length}
                        </div>
                        <div className="text-amber-800 font-medium">Partially Covered</div>
                      </div>
                      <div className="p-2 bg-purple-50 border border-purple-200 rounded">
                        <div className="text-lg font-bold text-purple-700">
                          {coverage.filter((c) => c.status === "OBJECTIVE_EVIDENCE_REQUIRED").length}
                        </div>
                        <div className="text-purple-800 font-medium">Evidence Needed</div>
                      </div>
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                        <div className="text-lg font-bold text-slate-600">
                          {coverage.filter((c) => c.status === "NOT_COVERED").length}
                        </div>
                        <div className="text-slate-600 font-medium">Not Covered</div>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="min-w-full divide-y divide-slate-200 text-xs">
                        <thead className="bg-slate-50 text-slate-700">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Ref</th>
                            <th className="px-3 py-2 text-left font-semibold">Requirement</th>
                            <th className="px-3 py-2 text-left font-semibold">Status</th>
                            <th className="px-3 py-2 text-left font-semibold">Live Analysis</th>
                            <th className="px-3 py-2 text-left font-semibold">Evidence Needed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {coverage.map((item) => (
                            <tr key={item.questionId} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2 font-mono font-medium text-slate-900 whitespace-nowrap">
                                {item.questionRef}
                              </td>
                              <td className="px-3 py-2 text-slate-700 max-w-xs">{item.questionText}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    item.status === "COVERED"
                                      ? "bg-green-100 text-green-800 border border-green-200"
                                      : item.status === "PARTIALLY_COVERED"
                                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                                      : item.status === "OBJECTIVE_EVIDENCE_REQUIRED"
                                      ? "bg-purple-100 text-purple-800 border border-purple-200"
                                      : "bg-slate-100 text-slate-600 border border-slate-200"
                                  }`}
                                >
                                  {item.status.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-600">{item.analysis}</td>
                              <td className="px-3 py-2 text-purple-700 font-medium">{item.evidenceNeeded || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* TAB 5: End Session Smart Summary (v0.5C) */}
          {activeTab === "session_summary" && (
            <div className="space-y-4">
              <Card
                title="Structured Audit Session Summary (13-Point Plaud Format)"
                action={
                  <button
                    onClick={runEndSessionSummary}
                    disabled={summaryLoading || !session?.transcriptSegments.length}
                    className="text-xs bg-blue-600 text-white font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1"
                  >
                    {summaryLoading ? <LoadingSpinner inline text="Generating..." /> : <><span>⚡</span> Generate End-of-Session Summary</>}
                  </button>
                }
              >
                {summaryError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs mb-3">
                    {summaryError}
                  </div>
                )}

                {summaryLoading && (
                  <div className="py-12">
                    <LoadingSpinner text="Compiling 13-point session wrap-up: topics, processes, evidence, findings, actions..." />
                  </div>
                )}

                {!summaryLoading && !sessionSummary && (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    <div className="text-3xl mb-2">📄</div>
                    <p>No end-of-session summary generated yet.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      When your walkthrough or meeting wraps up, click below to generate a structured 13-point draft summary with closing meeting points and actions.
                    </p>
                    <button
                      onClick={runEndSessionSummary}
                      disabled={!session?.transcriptSegments.length}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Generate 13-Point Summary
                    </button>
                  </div>
                )}

                {!summaryLoading && sessionSummary && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs text-slate-500 pb-1 border-b">
                      <span>Total Duration: <strong>{formatDuration(session?.durationSec || elapsedSeconds)}</strong></span>
                      <span>Recorded Segments: <strong>{session?.transcriptSegments.length || 0}</strong></span>
                      <span>Photos Attached: <strong>{session?.photos.length || 0}</strong></span>
                    </div>

                    <AISuggestionBox suggestion={sessionSummary} />

                    <div className="flex gap-2 justify-end pt-2">
                      <Link
                        href={`/findings?auditId=${auditId}`}
                        className="btn-secondary text-xs"
                      >
                        Go to Findings Log →
                      </Link>
                      <Link
                        href={`/audits/${auditId}/verify`}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                      >
                        Go to Auditor Verification →
                      </Link>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}

      {/* Photo Capture & Linking Modal */}
      {photoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-sm font-bold text-slate-800">📸 Link Photo Evidence</h3>
              <button
                onClick={() => setPhotoModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Photo Preview */}
            {pendingPhotoPreview && (
              <div className="relative rounded-lg overflow-hidden border bg-slate-900 flex items-center justify-center max-h-56">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingPhotoPreview}
                  alt="Evidence Preview"
                  className="max-h-56 w-auto object-contain"
                />
                <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-mono px-2 py-0.5 rounded">
                  {formatDuration(elapsedSeconds)}
                </span>
              </div>
            )}

            {/* Spoken / Typed Auditor Note */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Auditor Note (Dictated or Typed)
              </label>
              <textarea
                value={photoNote}
                onChange={(e) => setPhotoNote(e.target.value)}
                placeholder="e.g. Operator can install this rivet from the wrong side. No poka-yoke fixture present."
                rows={3}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Process / Area Tag */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Process / Area</label>
                <input
                  type="text"
                  value={photoProcess}
                  onChange={(e) => setPhotoProcess(e.target.value)}
                  placeholder="e.g. Riveting / Assembly"
                  className="w-full border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Checklist Question (Optional)</label>
                <select
                  value={photoQuestionId}
                  onChange={(e) => setPhotoQuestionId(e.target.value)}
                  className="w-full border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                >
                  <option value="">— Select item —</option>
                  {checklist?.sections.flatMap((s) =>
                    s.questions.map((q) => (
                      <option key={q.id} value={q.id}>
                        [{q.reference}] {q.text.slice(0, 35)}…
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* AI Photo Risk Analysis Prompt */}
            <div>
              <button
                type="button"
                onClick={analyzePhotoWithAI}
                disabled={photoAiLoading}
                className="w-full py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs font-medium hover:bg-purple-100 flex items-center justify-center gap-1.5 transition"
              >
                {photoAiLoading ? (
                  <LoadingSpinner inline text="Analyzing photo risk..." />
                ) : (
                  <>
                    <span>✨</span>
                    <span>AI Photo Risk &amp; Follow-up Question Suggestion</span>
                  </>
                )}
              </button>

              {photoAiAnalysis && (
                <div className="mt-2 p-2.5 bg-purple-50/70 border border-purple-200 rounded text-xs text-purple-900 whitespace-pre-line">
                  {photoAiAnalysis}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setPhotoModalOpen(false)}
                className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCapturedPhoto}
                disabled={photoSaving}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {photoSaving ? "Saving..." : "Save Photo Evidence"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Audio Player for Snippet Playback */}
      <audio ref={audioPlayerRef} src={activeAudioUrl || undefined} className="hidden" />

      {/* ── Speaker Renaming & Attribution Modal ───────────────────────── */}
      {editingSpeaker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xl">👤</span>
                <h3 className="font-bold text-sm text-slate-800">Identify / Rename Speaker</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingSpeaker(null)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Speaker Name
                </label>
                <input
                  type="text"
                  value={newSpeakerName}
                  onChange={(e) => setNewSpeakerName(e.target.value)}
                  placeholder="e.g. Richard, Mr. Han, Operator Xiao"
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role / Designation
                </label>
                <select
                  value={newSpeakerRole}
                  onChange={(e) => setNewSpeakerRole(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Unassigned">Unassigned (Speaker Only)</option>
                  <option value="Lead Auditor">Lead Auditor (You)</option>
                  <option value="Auditor">Co-Auditor</option>
                  <option value="Supplier QA">Supplier QA / Quality Director</option>
                  <option value="Plant Manager">Plant / Production Manager</option>
                  <option value="Process Engineer">Process / Manufacturing Engineer</option>
                  <option value="Line Supervisor">Line Supervisor</option>
                  <option value="Operator">Machine Operator / Inspector</option>
                  <option value="Management">Supplier Executive / GM</option>
                </select>
              </div>

              {/* Quick pre-populate tags */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-medium">Quick suggestions:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[audit?.leadAuditor || "Auditor", audit?.supplierContact || "Supplier QA", "Line Supervisor", "Machine Operator"].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setNewSpeakerName(suggestion)}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded border border-slate-200"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setEditingSpeaker(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editingSpeaker || !sessionRef.current) return;
                  const targetSpeakerId = editingSpeaker.speakerId;
                  const finalName = newSpeakerName.trim() || editingSpeaker.currentName;
                  const finalRole = newSpeakerRole.trim() || editingSpeaker.currentRole;

                  // Update session speakers registry
                  const updatedSpeakers = (sessionRef.current.speakers || speakers).map((s) => {
                    if (s.id === targetSpeakerId) {
                      return { ...s, name: finalName, role: finalRole };
                    }
                    return s;
                  });

                  // Update all transcript segments assigned to this speaker
                  const updatedSegments = sessionRef.current.transcriptSegments.map((seg) => {
                    if (seg.speakerId === targetSpeakerId || seg.id === editingSpeaker.segmentId) {
                      return {
                        ...seg,
                        speakerId: targetSpeakerId,
                        speakerName: finalName,
                        speakerRole: finalRole,
                      };
                    }
                    return seg;
                  });

                  const updatedSession: SmartAuditSession = {
                    ...sessionRef.current,
                    speakers: updatedSpeakers,
                    transcriptSegments: updatedSegments,
                    updatedAt: new Date().toISOString(),
                  };

                  setSpeakers(updatedSpeakers);
                  persistSession(updatedSession);
                  setEditingSpeaker(null);
                }}
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-sm"
              >
                Update Speaker Globally
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
