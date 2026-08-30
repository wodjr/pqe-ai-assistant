"use client";
/**
 * app/cars/page.tsx — Corrective Action Request management
 *
 * Key controls:
 * - isAuditorVerifiedClosed can only be set by explicit auditor action.
 * - AI cannot close a CAR.
 * - Status progression is manual.
 */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  listAudits,
  getAudit,
  getCARsByAudit,
  getFindingsByAudit,
  getEvidenceByAudit,
  saveCAR,
} from "@/lib/storage/db";
import { getAuditorName } from "@/lib/storage/localStorage";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import type { Audit, CAR, CARStatus, Finding, Evidence } from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import StatusBadge from "@/components/StatusBadge";
import EvidenceUpload from "@/components/EvidenceUpload";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

const STATUS_STEPS: CARStatus[] = [
  "OPEN",
  "CONTAINMENT",
  "ROOT_CAUSE",
  "CORRECTIVE_ACTION",
  "EFFECTIVENESS",
  "CLOSED",
];

function CARsPageInner() {
  const searchParams = useSearchParams();
  const presetAuditId = searchParams.get("auditId") ?? "";

  const [audits, setAudits] = useState<Audit[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState(presetAuditId);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [cars, setCars] = useState<CAR[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Map<string, Partial<CAR>>>(new Map());
  const auditorName = typeof window !== "undefined" ? getAuditorName() : "";

  useEffect(() => {
    listAudits().then(setAudits);
  }, []);

  useEffect(() => {
    if (!selectedAuditId) { setLoading(false); return; }
    setLoading(true);
    async function load() {
      const a = await getAudit(selectedAuditId);
      setAudit(a ?? null);
      if (a) {
        const [ca, fi, ev] = await Promise.all([
          getCARsByAudit(selectedAuditId),
          getFindingsByAudit(selectedAuditId),
          getEvidenceByAudit(selectedAuditId),
        ]);
        setCars(ca);
        setFindings(fi);
        setEvidence(ev);
      }
      setLoading(false);
    }
    load();
  }, [selectedAuditId]);

  function getDraft(car: CAR): CAR {
    return { ...car, ...drafts.get(car.id) };
  }

  function updateDraft(carId: string, field: keyof CAR, value: string) {
    setDrafts((prev) => {
      const next = new Map(prev);
      next.set(carId, { ...prev.get(carId), [field]: value });
      return next;
    });
  }

  async function saveUpdates(car: CAR) {
    setSaving(car.id);
    const updated = getDraft(car);
    await saveCAR(updated);
    setCars((prev) => prev.map((c) => (c.id === car.id ? updated : c)));
    setDrafts((prev) => { const n = new Map(prev); n.delete(car.id); return n; });
    setSaving(null);
  }

  async function advanceStatus(car: CAR) {
    const idx = STATUS_STEPS.indexOf(car.status === "OVERDUE" ? "OPEN" : car.status);
    const nextStatus = STATUS_STEPS[Math.min(idx + 1, STATUS_STEPS.length - 1)];
    const updated = { ...getDraft(car), status: nextStatus };
    setSaving(car.id);
    await saveCAR(updated);
    setCars((prev) => prev.map((c) => (c.id === car.id ? updated : c)));
    setSaving(null);
  }

  async function closeCar(car: CAR) {
    // Only auditor can close — must be explicit action
    const confirmed = confirm(
      `You are about to mark ${car.reference} as Auditor Verified Closed.\n\n` +
      `This confirms that corrective actions have been verified as effective by the auditor.\n\n` +
      `Auditor: ${auditorName || audit?.leadAuditor || "Unknown"}\n\nProceed?`
    );
    if (!confirmed) return;

    const updated: CAR = {
      ...getDraft(car),
      status: "CLOSED",
      isAuditorVerifiedClosed: true,
      closedAt: new Date().toISOString(),
      closedBy: auditorName || audit?.leadAuditor || "Auditor",
    };
    setSaving(car.id);
    await saveCAR(updated);
    setCars((prev) => prev.map((c) => (c.id === car.id ? updated : c)));
    setSaving(null);
  }

  async function markOverdue(car: CAR) {
    const updated = { ...getDraft(car), status: "OVERDUE" as CARStatus };
    await saveCAR(updated);
    setCars((prev) => prev.map((c) => (c.id === car.id ? updated : c)));
  }

  if (loading) return <LoadingSpinner />;

  const openCount = cars.filter((c) => !c.isAuditorVerifiedClosed).length;
  const overdueCount = cars.filter((c) => c.status === "OVERDUE").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Corrective Action Requests"
        subtitle="Track and verify corrective actions through to closure"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "CARs" }]}
      />

      {/* Audit selector */}
      <Card title="Select Audit">
        <select
          aria-label="Select audit"
          value={selectedAuditId}
          onChange={(e) => setSelectedAuditId(e.target.value)}
          className="w-full max-w-sm border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Select an audit —</option>
          {audits.map((a) => (
            <option key={a.id} value={a.id}>{a.supplierName} — {a.supplierSite}</option>
          ))}
        </select>
      </Card>

      {selectedAuditId && audit && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 stats-strip-2col gap-4">
            <Card className="text-center">
              <div className="text-3xl font-bold text-red-600">{openCount}</div>
              <div className="text-xs text-slate-500 mt-1">Open</div>
            </Card>
            <Card className="text-center">
              <div className="text-3xl font-bold text-amber-600">{overdueCount}</div>
              <div className="text-xs text-slate-500 mt-1">Overdue</div>
            </Card>
            <Card className="text-center">
              <div className="text-3xl font-bold text-green-600">{cars.filter((c) => c.isAuditorVerifiedClosed).length}</div>
              <div className="text-xs text-slate-500 mt-1">Closed</div>
            </Card>
          </div>

          {cars.length === 0 ? (
            <EmptyState
              title="No CARs for this audit"
              description="CARs are created automatically when raising a finding with 'Requires CAR' checked, or manually from the Findings page."
              action={
                <Link href={`/findings?auditId=${selectedAuditId}`} className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700">
                  Go to Findings
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              {cars.map((car) => {
                const draft = getDraft(car);
                const finding = findings.find((f) => f.id === car.findingId);
                const carEvidence = evidence.filter((e) => e.linkedTo.some((l) => l.targetId === car.id));
                const isExpanded = expandedId === car.id;

                return (
                  <Card key={car.id}>
                    {/* CAR header */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : car.id)}
                      className="w-full flex items-start justify-between text-left gap-3"
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="font-bold text-slate-400 text-sm shrink-0">{car.reference}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusBadge variant={car.status} />
                            {finding && (
                              <span className="text-sm font-medium text-slate-700">
                                {finding.reference}: {finding.title}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Owner: {car.owner || "—"} · Due: {formatDate(car.dueDate)}
                            {car.isAuditorVerifiedClosed && (
                              <span className="ml-2 text-green-600 font-medium">
                                ✓ Closed by {car.closedBy} on {formatDate(car.closedAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-slate-400 shrink-0">{isExpanded ? "▲" : "▼"}</span>
                    </button>

                    {isExpanded && (
                      <div className="mt-4 border-t border-slate-100 pt-4 space-y-4">

                        {/* Status progression */}
                        {!car.isAuditorVerifiedClosed && (
                          <div>
                            <div className="text-xs font-medium text-slate-600 mb-2">8D Status</div>
                            <div className="flex flex-wrap gap-1">
                              {STATUS_STEPS.map((s) => (
                                <span
                                  key={s}
                                  className={`text-xs px-2 py-1 rounded ${
                                    car.status === s
                                      ? "bg-blue-600 text-white font-bold"
                                      : STATUS_STEPS.indexOf(s) < STATUS_STEPS.indexOf(car.status === "OVERDUE" ? "OPEN" : car.status)
                                        ? "bg-green-100 text-green-700"
                                        : "bg-slate-100 text-slate-400"
                                  }`}
                                >
                                  {s.replace(/_/g, " ")}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Owner + due date */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Owner</label>
                            <input
                              type="text"
                              value={draft.owner}
                              onChange={(e) => updateDraft(car.id, "owner", e.target.value)}
                              disabled={car.isAuditorVerifiedClosed}
                              placeholder="Supplier contact responsible"
                              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
                            <input
                              type="date"
                              value={draft.dueDate}
                              onChange={(e) => updateDraft(car.id, "dueDate", e.target.value)}
                              disabled={car.isAuditorVerifiedClosed}
                              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                            />
                          </div>
                        </div>

                        {/* 8D fields */}
                        {(
                          [
                            { field: "containment" as keyof CAR, label: "D1–D3: Containment Action" },
                            { field: "rootCause" as keyof CAR, label: "D4: Root Cause Analysis" },
                            { field: "correctiveAction" as keyof CAR, label: "D5–D6: Corrective Action" },
                            { field: "effectivenessEvidence" as keyof CAR, label: "D7: Effectiveness Verification" },
                          ] as const
                        ).map(({ field, label }) => (
                          <div key={field}>
                            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                            <textarea
                              rows={3}
                              value={(draft[field] as string) ?? ""}
                              onChange={(e) => updateDraft(car.id, field, e.target.value)}
                              disabled={car.isAuditorVerifiedClosed}
                              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                            />
                          </div>
                        ))}

                        {/* Effectiveness evidence upload */}
                        <div>
                          <div className="text-xs font-medium text-slate-600 mb-1">Effectiveness Evidence Files</div>
                          <EvidenceUpload
                            auditId={selectedAuditId}
                            link={{ type: "CAR", targetId: car.id }}
                            existingEvidence={carEvidence}
                            onAdded={(ev) => setEvidence((prev) => [...prev, ev])}
                          />
                        </div>

                        {/* Action buttons */}
                        {!car.isAuditorVerifiedClosed && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={saving === car.id}
                              onClick={() => saveUpdates(car)}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded disabled:opacity-50"
                            >
                              {saving === car.id ? "Saving…" : "Save Updates"}
                            </button>
                            {car.status !== "EFFECTIVENESS" && car.status !== "CLOSED" && (
                              <button
                                type="button"
                                disabled={saving === car.id}
                                onClick={() => advanceStatus(car)}
                                className="border border-slate-300 text-slate-600 text-sm px-4 py-1.5 rounded hover:bg-slate-50 disabled:opacity-50"
                              >
                                Advance to Next Step →
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={saving === car.id}
                              onClick={() => markOverdue(car)}
                              className="border border-amber-300 text-amber-700 text-sm px-4 py-1.5 rounded hover:bg-amber-50 disabled:opacity-50"
                            >
                              Mark Overdue
                            </button>
                            {car.status === "EFFECTIVENESS" && (
                              <button
                                type="button"
                                disabled={saving === car.id}
                                onClick={() => closeCar(car)}
                                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-1.5 rounded disabled:opacity-50"
                              >
                                ✓ Auditor Verified Closed
                              </button>
                            )}
                          </div>
                        )}

                        {car.isAuditorVerifiedClosed && (
                          <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
                            ✓ <strong>Auditor Verified Closed</strong> by {car.closedBy} on {formatDateTime(car.closedAt)}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function CARsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading corrective actions…</div>}>
      <CARsPageInner />
    </Suspense>
  );
}
