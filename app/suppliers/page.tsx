"use client";
/**
 * app/suppliers/page.tsx — Supplier Risk Dashboard
 *
 * Aggregates all audits by supplier to show risk profile, open findings,
 * overdue CARs, and audit history. Read-only summary view.
 */
import { useEffect, useState } from "react";
import { listAudits, getFindingsByAudit, getCARsByAudit } from "@/lib/storage/db";
import { formatDate } from "@/lib/utils/format";
import type { Audit, Finding, CAR } from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

interface SupplierProfile {
  name: string;
  site: string;
  audits: Audit[];
  totalMajor: number;
  totalMinor: number;
  totalObservations: number;
  openCARs: number;
  overdueCARs: number;
  lastAuditDate: string;
  riskScore: "HIGH" | "MEDIUM" | "LOW";
}

function calcRisk(major: number, overdue: number): SupplierProfile["riskScore"] {
  if (major > 0 || overdue > 0) return "HIGH";
  return "LOW";
}

const RISK_COLOURS: Record<SupplierProfile["riskScore"], string> = {
  HIGH:   "bg-red-100 text-red-700 border-red-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW:    "bg-green-100 text-green-700 border-green-200",
};

export default function SuppliersPage() {
  const [profiles, setProfiles] = useState<SupplierProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const audits = await listAudits();
      // Group by supplier name+site
      const map = new Map<string, Audit[]>();
      for (const a of audits) {
        const key = `${a.supplierName}|${a.supplierSite}`;
        map.set(key, [...(map.get(key) ?? []), a]);
      }

      const built: SupplierProfile[] = [];
      for (const [key, supplierAudits] of map) {
        const [name, site] = key.split("|");
        // Load all findings and CARs for this supplier's audits
        const allFindings: Finding[] = [];
        const allCARs: CAR[] = [];
        await Promise.all(
          supplierAudits.map(async (a) => {
            const [fi, ca] = await Promise.all([
              getFindingsByAudit(a.id),
              getCARsByAudit(a.id),
            ]);
            allFindings.push(...fi);
            allCARs.push(...ca);
          })
        );

        const major = allFindings.filter((f) => f.classification === "MAJOR").length;
        const minor = allFindings.filter((f) => f.classification === "MINOR").length;
        const obs   = allFindings.filter((f) => f.classification === "OBSERVATION").length;
        const openCARs    = allCARs.filter((c) => !c.isAuditorVerifiedClosed).length;
        const overdueCARs = allCARs.filter((c) => c.status === "OVERDUE").length;
        const lastDate = supplierAudits
          .flatMap((a) => a.auditDates)
          .sort()
          .at(-1) ?? "";

        built.push({
          name,
          site,
          audits: supplierAudits,
          totalMajor: major,
          totalMinor: minor,
          totalObservations: obs,
          openCARs,
          overdueCARs,
          lastAuditDate: lastDate,
          riskScore: calcRisk(major, overdueCARs),
        });
      }

      // Sort HIGH → LOW
      const ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      built.sort((a, b) => ORDER[a.riskScore] - ORDER[b.riskScore]);
      setProfiles(built);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Risk Dashboard"
        subtitle="Aggregated risk, findings and audit history by supplier"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Suppliers" }]}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Suppliers",   value: profiles.length,                                     colour: "text-slate-700" },
          { label: "High Risk",   value: profiles.filter((p) => p.riskScore === "HIGH").length, colour: "text-red-600" },
          { label: "Open CARs",   value: profiles.reduce((s, p) => s + p.openCARs, 0),         colour: "text-amber-600" },
        ].map((s) => (
          <Card key={s.label} className="text-center">
            <div className={`text-3xl font-bold ${s.colour}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </Card>
        ))}
      </div>

      {profiles.length === 0 ? (
        <EmptyState
          title="No supplier data yet"
          description="Create audits and record findings to populate the risk dashboard."
          action={<Link href="/audits/new" className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700">Create Audit</Link>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((p) => {
            const key = `${p.name}|${p.site}`;
            const isSelected = selected === key;
            return (
              <div key={key} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                {/* Supplier header */}
                <button
                  type="button"
                  onClick={() => setSelected(isSelected ? null : key)}
                  className="w-full flex items-start justify-between p-4 text-left hover:bg-slate-50 gap-3"
                  aria-expanded={isSelected}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.site}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Last audit: {p.lastAuditDate ? formatDate(p.lastAuditDate) : "—"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${RISK_COLOURS[p.riskScore]}`}>
                      {p.riskScore} RISK
                    </span>
                    <span className="text-slate-400 text-xs">{p.audits.length} audit{p.audits.length !== 1 ? "s" : ""}</span>
                    <span className="text-slate-400">{isSelected ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Quick stats strip */}
                <div className="border-t border-slate-100 grid grid-cols-4 divide-x divide-slate-100 text-center text-xs">
                  {[
                    { label: "Major",   value: p.totalMajor,       colour: p.totalMajor > 0 ? "text-red-600 font-bold" : "text-slate-500" },
                    { label: "Minor",   value: p.totalMinor,       colour: p.totalMinor > 0 ? "text-amber-600 font-bold" : "text-slate-500" },
                    { label: "Open CARs", value: p.openCARs,       colour: p.openCARs > 0 ? "text-amber-600 font-bold" : "text-slate-500" },
                    { label: "Overdue",   value: p.overdueCARs,    colour: p.overdueCARs > 0 ? "text-red-600 font-bold" : "text-slate-500" },
                  ].map((s) => (
                    <div key={s.label} className="py-2 px-1">
                      <div className={s.colour}>{s.value}</div>
                      <div className="text-slate-400">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Audit history (expanded) */}
                {isSelected && (
                  <div className="border-t border-slate-100 p-4 space-y-2 bg-slate-50">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Audit History</div>
                    {p.audits
                      .slice()
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                      .map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded p-2">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-700">
                              {a.auditType.replace(/_/g, " ")}
                            </div>
                            <div className="text-xs text-slate-500">
                              {a.auditDates.map(formatDate).join(", ")} · {a.leadAuditor}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge variant={a.status} />
                            <Link
                              href={`/audits/${a.id}`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Open →
                            </Link>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
