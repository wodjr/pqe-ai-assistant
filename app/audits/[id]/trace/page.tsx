"use client";
/**
 * app/audits/[id]/trace/page.tsx — Vertical Evidence Trace
 *
 * Links a CTF characteristic from drawing through to inspection result:
 *   Drawing characteristic → PFMEA → Control Plan → Work Instruction
 *   → Measurement System → Inspection Result
 *
 * Each link in the chain has a status and supporting evidence.
 * Acceptance of each link requires explicit auditor action.
 */
import { useEffect, useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { getAudit, getEvidenceByAudit } from "@/lib/storage/db";
import { nanoid } from "@/lib/utils/nanoid";
import type { Audit, Evidence } from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import EvidenceUpload from "@/components/EvidenceUpload";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

type LinkStatus = "NOT_CHECKED" | "VERIFIED" | "GAP" | "NOT_APPLICABLE";

interface TraceLink {
  id: string;
  step: string;
  description: string;
  notes: string;
  status: LinkStatus;
  docRef: string;
}

interface TraceChain {
  id: string;
  characteristic: string; // e.g. "Ø 25.00 ±0.05 — Bore diameter"
  partNumber: string;
  links: TraceLink[];
}

const TRACE_STEPS = [
  { step: "Drawing", description: "CTF characteristic identified on drawing with balloon number, tolerance, and datum references" },
  { step: "PFMEA",   description: "Characteristic listed in PFMEA with failure mode, severity, occurrence, and detection ratings" },
  { step: "Control Plan", description: "Characteristic controlled in Control Plan with method, frequency, reaction plan, and responsible party" },
  { step: "Work Instruction", description: "Operator work instruction references the characteristic and control method" },
  { step: "Measurement System", description: "Measurement equipment is calibrated, capable (GR&R ≤ 10%), and appropriate for the tolerance" },
  { step: "Inspection Result", description: "Actual inspection data demonstrates conformance — Cpk ≥ 1.33 for normal, ≥ 1.67 for CTF" },
];

const STATUS_CONFIG: Record<LinkStatus, { label: string; colour: string; bg: string }> = {
  NOT_CHECKED:    { label: "Not Checked",    colour: "text-slate-500",  bg: "bg-slate-50" },
  VERIFIED:       { label: "✓ Verified",     colour: "text-green-700",  bg: "bg-green-50" },
  GAP:            { label: "⚠ Gap Found",    colour: "text-red-700",    bg: "bg-red-50" },
  NOT_APPLICABLE: { label: "N/A",            colour: "text-slate-400",  bg: "bg-slate-50" },
};

function makeChain(characteristic = "", partNumber = ""): TraceChain {
  return {
    id: nanoid(),
    characteristic,
    partNumber,
    links: TRACE_STEPS.map((s) => ({
      id: nanoid(),
      step: s.step,
      description: s.description,
      notes: "",
      status: "NOT_CHECKED",
      docRef: "",
    })),
  };
}

export default function TracePage() {
  const { id: auditId } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [chains, setChains] = useState<TraceChain[]>([makeChain()]);
  const [selectedChain, setSelectedChain] = useState<string>("");
  const [expandedLink, setExpandedLink] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const a = await getAudit(auditId);
      if (!a) { setLoading(false); return; }
      setAudit(a);
      const ev = await getEvidenceByAudit(auditId);
      setEvidence(ev);
      setSelectedChain(chains[0].id);
      setLoading(false);
    }
    load();
  }, [auditId]); // eslint-disable-line react-hooks/exhaustive-deps

  function addChain() {
    const c = makeChain();
    setChains((prev) => [...prev, c]);
    setSelectedChain(c.id);
  }

  function updateChain(chainId: string, field: "characteristic" | "partNumber", value: string) {
    setChains((prev) => prev.map((c) => c.id === chainId ? { ...c, [field]: value } : c));
  }

  function updateLink(chainId: string, linkId: string, field: keyof TraceLink, value: string) {
    setChains((prev) => prev.map((c) => c.id === chainId ? {
      ...c,
      links: c.links.map((l) => l.id === linkId ? { ...l, [field]: value } : l),
    } : c));
  }

  function verifyLink(chainId: string, linkId: string) {
    const chain = chains.find((c) => c.id === chainId);
    const link = chain?.links.find((l) => l.id === linkId);
    if (!confirm(`Verify "${link?.step}" for characteristic: ${chain?.characteristic || "unnamed"}?\n\nThis confirms you have reviewed objective evidence for this step.`)) return;
    updateLink(chainId, linkId, "status", "VERIFIED");
  }

  const handleEvidenceAdded = useCallback((ev: Evidence) => {
    setEvidence((prev) => [...prev, ev]);
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!audit) return <div className="text-center py-16 text-slate-500">Audit not found. <Link href="/audits" className="text-blue-600 hover:underline">Back</Link></div>;

  const activeChain = chains.find((c) => c.id === selectedChain) ?? chains[0];
  const verifiedLinks = activeChain?.links.filter((l) => l.status === "VERIFIED").length ?? 0;
  const gapLinks = activeChain?.links.filter((l) => l.status === "GAP").length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vertical Evidence Trace"
        subtitle={`${audit.supplierName} — CTF characteristic traceability`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Audits", href: "/audits" },
          { label: audit.supplierName, href: `/audits/${auditId}` },
          { label: "Evidence Trace" },
        ]}
      />

      <div className="ai-suggestion-block">
        <strong>Auditor verification required:</strong> Each link in the evidence chain must be individually
        verified by the auditor. AI cannot verify characteristics or close traceability gaps.
      </div>

      {/* Chain selector */}
      <Card title="CTF Characteristics">
        <div className="flex flex-wrap gap-2 mb-3">
          {chains.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedChain(c.id)}
              className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${
                selectedChain === c.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {c.characteristic || `Characteristic ${i + 1}`}
            </button>
          ))}
          <button
            type="button"
            onClick={addChain}
            className="text-xs px-3 py-1.5 rounded border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50"
          >
            + Add Characteristic
          </button>
        </div>

        {/* Characteristic details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">CTF Characteristic (from drawing)</label>
            <input
              type="text"
              value={activeChain.characteristic}
              onChange={(e) => updateChain(activeChain.id, "characteristic", e.target.value)}
              placeholder="e.g. Ø 25.00 ±0.05 — Bore diameter, Balloon 7"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Part Number</label>
            <input
              type="text"
              value={activeChain.partNumber}
              onChange={(e) => updateChain(activeChain.id, "partNumber", e.target.value)}
              placeholder="e.g. ABC-12345-A"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Card>

      {/* Chain progress */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Verified", value: verifiedLinks, colour: "text-green-600" },
          { label: "Gaps Found", value: gapLinks, colour: gapLinks > 0 ? "text-red-600 font-bold" : "text-slate-500" },
          { label: "Total Steps", value: TRACE_STEPS.length, colour: "text-slate-700" },
        ].map((s) => (
          <Card key={s.label} className="text-center">
            <div className={`text-2xl font-bold ${s.colour}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Trace chain */}
      <div className="space-y-2">
        {activeChain.links.map((link, idx) => {
          const cfg = STATUS_CONFIG[link.status];
          const isExpanded = expandedLink === link.id;
          const linkEvidence = evidence.filter((e) => e.linkedTo.some((l) => l.targetId === `trace-${link.id}`));

          return (
            <div key={link.id} className={`border rounded-lg overflow-hidden ${cfg.bg} border-slate-200`}>
              <button
                type="button"
                onClick={() => setExpandedLink(isExpanded ? null : link.id)}
                className="w-full flex items-center justify-between p-3 text-left hover:opacity-80 gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 w-4">{idx + 1}</span>
                    {idx < activeChain.links.length - 1 && (
                      <span className="text-slate-300 text-xs">→</span>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{link.step}</div>
                    {link.docRef && <div className="text-xs text-blue-600">{link.docRef}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {linkEvidence.length > 0 && <span className="text-xs text-blue-600">📎 {linkEvidence.length}</span>}
                  <span className={`text-xs font-semibold ${cfg.colour}`}>{cfg.label}</span>
                  <span className="text-slate-400">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200 p-4 space-y-3 bg-white">
                  <p className="text-xs text-slate-500 italic">{link.description}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Document / Record Reference</label>
                      <input
                        type="text"
                        value={link.docRef}
                        onChange={(e) => updateLink(activeChain.id, link.id, "docRef", e.target.value)}
                        placeholder="Doc number, revision, date…"
                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(Object.keys(STATUS_CONFIG) as LinkStatus[]).map((s) => (
                          <label key={s} className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`trace-status-${link.id}`}
                              checked={link.status === s}
                              onChange={() => {
                                if (s === "VERIFIED") verifyLink(activeChain.id, link.id);
                                else updateLink(activeChain.id, link.id, "status", s);
                              }}
                              className="accent-blue-600"
                            />
                            <span className={`text-xs ${STATUS_CONFIG[s].colour}`}>{STATUS_CONFIG[s].label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Auditor Notes</label>
                    <textarea
                      rows={2}
                      value={link.notes}
                      onChange={(e) => updateLink(activeChain.id, link.id, "notes", e.target.value)}
                      placeholder="Record what was observed, any gaps or concerns…"
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Evidence</label>
                    <EvidenceUpload
                      auditId={auditId}
                      link={{ type: "QUESTION", targetId: `trace-${link.id}` }}
                      existingEvidence={linkEvidence}
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
