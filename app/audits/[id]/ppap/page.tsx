"use client";
/**
 * app/audits/[id]/ppap/page.tsx — PPAP Evidence Review
 *
 * Structured checklist covering the 18 PPAP elements.
 * For each element the auditor records:
 *   - status: SUBMITTED / REVIEWED / ACCEPTED / REJECTED / NOT_REQUIRED
 *   - notes
 *   - evidence uploads
 *
 * Acceptance of any PPAP element requires explicit auditor action.
 * AI cannot accept PPAP evidence.
 */
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getAudit, getEvidenceByAudit } from "@/lib/storage/db";
import type { Audit, Evidence } from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import EvidenceUpload from "@/components/EvidenceUpload";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

const PPAP_ELEMENTS = [
  { id: "1",  ref: "1",  title: "Design Records",                   description: "Drawings, CAD data, change notices, and revision levels" },
  { id: "2",  ref: "2",  title: "Authorised Engineering Change",     description: "Customer-authorised design change documents" },
  { id: "3",  ref: "3",  title: "Customer Engineering Approval",     description: "Engineering sign-off for deviations or changes" },
  { id: "4",  ref: "4",  title: "Design FMEA (DFMEA)",              description: "Design failure mode and effects analysis" },
  { id: "5",  ref: "5",  title: "Process Flow Diagram",              description: "Documented manufacturing process flow" },
  { id: "6",  ref: "6",  title: "Process FMEA (PFMEA)",             description: "Process failure mode and effects analysis with RPN values" },
  { id: "7",  ref: "7",  title: "Control Plan",                      description: "Pre-launch and production control plan with characteristics and controls" },
  { id: "8",  ref: "8",  title: "Measurement System Analysis (MSA)", description: "Gage R&R studies for all measuring equipment used on CTF characteristics" },
  { id: "9",  ref: "9",  title: "Dimensional Results",               description: "Results from dimensional inspection of all balloon characteristics" },
  { id: "10", ref: "10", title: "Material / Performance Test Results",description: "Material certificates, CoCs, and test reports" },
  { id: "11", ref: "11", title: "Initial Process Studies (SPC/Cpk)", description: "Statistical process capability — Cpk ≥ 1.67 required for CTF characteristics" },
  { id: "12", ref: "12", title: "Qualified Laboratory Documentation", description: "Accreditation certificates for all test laboratories used" },
  { id: "13", ref: "13", title: "Appearance Approval Report (AAR)",  description: "Approved appearance sample and AAR form (if required)" },
  { id: "14", ref: "14", title: "Sample Production Parts",            description: "Sample parts produced from production tooling and process" },
  { id: "15", ref: "15", title: "Master Sample",                      description: "Retained master sample signed off by customer" },
  { id: "16", ref: "16", title: "Checking Aids",                      description: "Fixture, gauge, and checking aid drawings and qualification records" },
  { id: "17", ref: "17", title: "Customer-Specific Requirements",     description: "Any additional customer or OEM-specific PPAP requirements" },
  { id: "18", ref: "18", title: "Part Submission Warrant (PSW)",      description: "Signed PSW — the final customer approval document for PPAP" },
];

type ElementStatus = "NOT_REQUIRED" | "SUBMITTED" | "REVIEWED" | "ACCEPTED" | "REJECTED";

const STATUS_OPTIONS: { value: ElementStatus; label: string; colour: string }[] = [
  { value: "NOT_REQUIRED", label: "Not Required", colour: "text-slate-500" },
  { value: "SUBMITTED",    label: "Submitted",    colour: "text-blue-600" },
  { value: "REVIEWED",     label: "Reviewed",     colour: "text-amber-600" },
  { value: "ACCEPTED",     label: "✓ Accepted",   colour: "text-green-700" },
  { value: "REJECTED",     label: "✕ Rejected",   colour: "text-red-600" },
];

const STATUS_BG: Record<ElementStatus, string> = {
  NOT_REQUIRED: "bg-slate-50 border-slate-200",
  SUBMITTED:    "bg-blue-50 border-blue-200",
  REVIEWED:     "bg-amber-50 border-amber-200",
  ACCEPTED:     "bg-green-50 border-green-200",
  REJECTED:     "bg-red-50 border-red-200",
};

interface ElementState { status: ElementStatus; notes: string; }

export default function PPAPPage() {
  const { id: auditId } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [elements, setElements] = useState<Map<string, ElementState>>(
    new Map(PPAP_ELEMENTS.map((e) => [e.id, { status: "NOT_REQUIRED", notes: "" }]))
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const a = await getAudit(auditId);
      if (!a) { setLoading(false); return; }
      setAudit(a);
      const ev = await getEvidenceByAudit(auditId);
      setEvidence(ev);
      setLoading(false);
    }
    load();
  }, [auditId]);

  function updateElement(id: string, field: keyof ElementState, value: string) {
    setElements((prev) => {
      const next = new Map(prev);
      next.set(id, { ...prev.get(id)!, [field]: value });
      return next;
    });
  }

  function handleAccept(id: string) {
    const el = PPAP_ELEMENTS.find((e) => e.id === id);
    if (!confirm(`Accept PPAP element: ${el?.title}?\n\nThis confirms you have reviewed the submitted evidence and it meets requirements.`)) return;
    updateElement(id, "status", "ACCEPTED");
  }

  function handleReject(id: string) {
    updateElement(id, "status", "REJECTED");
  }

  const handleEvidenceAdded = useCallback((ev: Evidence) => {
    setEvidence((prev) => [...prev, ev]);
  }, []);

  const accepted = [...elements.values()].filter((e) => e.status === "ACCEPTED").length;
  const rejected = [...elements.values()].filter((e) => e.status === "REJECTED").length;
  const required = PPAP_ELEMENTS.length - [...elements.values()].filter((e) => e.status === "NOT_REQUIRED").length;

  if (loading) return <LoadingSpinner />;
  if (!audit) return <div className="text-center py-16 text-slate-500">Audit not found. <Link href="/audits" className="text-blue-600 hover:underline">Back</Link></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="PPAP Evidence Review"
        subtitle={`${audit.supplierName} — 18 PPAP Elements`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Audits", href: "/audits" },
          { label: audit.supplierName, href: `/audits/${auditId}` },
          { label: "PPAP" },
        ]}
      />

      <div className="ai-suggestion-block">
        <strong>Human approval required:</strong> Each PPAP element must be individually reviewed and
        accepted by the auditor. AI cannot accept PPAP evidence or approve production parts.
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Accepted", value: accepted, colour: "text-green-600" },
          { label: "Rejected", value: rejected, colour: "text-red-600" },
          { label: "Required", value: required, colour: "text-slate-700" },
        ].map((s) => (
          <Card key={s.label} className="text-center">
            <div className={`text-3xl font-bold ${s.colour}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* PSW banner */}
      {(() => {
        const psw = elements.get("18");
        if (psw?.status === "ACCEPTED") return (
          <div className="bg-green-50 border border-green-300 rounded-lg p-4 text-green-800 font-semibold text-sm">
            ✓ Part Submission Warrant (PSW) accepted — PPAP submission complete
          </div>
        );
        return null;
      })()}

      {/* Elements */}
      <div className="space-y-2">
        {PPAP_ELEMENTS.map((el) => {
          const state = elements.get(el.id)!;
          const isExpanded = expanded === el.id;
          const elEvidence = evidence.filter((e) => e.linkedTo.some((l) => l.targetId === `ppap-${auditId}-${el.id}`));

          return (
            <div key={el.id} className={`border rounded-lg overflow-hidden ${STATUS_BG[state.status]}`}>
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : el.id)}
                className="w-full flex items-center justify-between p-3 text-left hover:opacity-80 gap-3"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-slate-400 shrink-0 w-6 font-mono">{el.ref}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800">{el.title}</div>
                    <div className="text-xs text-slate-500 hidden sm:block">{el.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {elEvidence.length > 0 && <span className="text-xs text-blue-600">📎 {elEvidence.length}</span>}
                  <span className={`text-xs font-semibold ${STATUS_OPTIONS.find((s) => s.value === state.status)?.colour}`}>
                    {STATUS_OPTIONS.find((s) => s.value === state.status)?.label}
                  </span>
                  <span className="text-slate-400">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200 p-4 space-y-3 bg-white">
                  <p className="text-xs text-slate-500 italic">{el.description}</p>

                  {/* Status selector */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((s) => (
                        <label key={s.value} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`ppap-status-${el.id}`}
                            value={s.value}
                            checked={state.status === s.value}
                            onChange={() => {
                              if (s.value === "ACCEPTED") { handleAccept(el.id); }
                              else if (s.value === "REJECTED") { handleReject(el.id); }
                              else updateElement(el.id, "status", s.value);
                            }}
                            className="accent-blue-600"
                          />
                          <span className={`text-xs ${s.colour}`}>{s.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Auditor Notes</label>
                    <textarea
                      rows={2}
                      value={state.notes}
                      onChange={(e) => updateElement(el.id, "notes", e.target.value)}
                      placeholder="Record observations, concerns, or document references…"
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Evidence */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Evidence</label>
                    <EvidenceUpload
                      auditId={auditId}
                      link={{ type: "QUESTION", targetId: `ppap-${auditId}-${el.id}` }}
                      existingEvidence={elEvidence}
                      onAdded={handleEvidenceAdded}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-2">
        <Link href={`/audits/${auditId}`} className="text-sm text-slate-600 hover:underline">← Back to Audit</Link>
      </div>
    </div>
  );
}
