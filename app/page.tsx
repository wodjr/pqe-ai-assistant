"use client";
/**
 * app/page.tsx — Dashboard
 * Shows all audits, quick-access actions, overdue CAR alerts, and overall status summary.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { listAudits, listChecklists, getCARsByAudit } from "@/lib/storage/db";
import { getCurrentAuditId, setCurrentAuditId } from "@/lib/storage/localStorage";
import { formatDate } from "@/lib/utils/format";
import type { Audit, ChecklistTemplate, CAR } from "@/types/project";
import StatusBadge from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";

const STATUS_ORDER: Record<string, number> = {
  IN_PROGRESS: 0,
  PENDING_APPROVAL: 1,
  DRAFT: 2,
  CLOSED: 3,
};

export default function DashboardPage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [overdueCARs, setOverdueCARs] = useState<{ car: CAR; auditName: string }[]>([]);

  useEffect(() => {
    async function load() {
      const [a, c] = await Promise.all([listAudits(), listChecklists()]);
      const sorted = [...a].sort(
        (x, y) => (STATUS_ORDER[x.status] ?? 9) - (STATUS_ORDER[y.status] ?? 9)
      );
      setAudits(sorted);
      setChecklists(c);
      setCurrentId(getCurrentAuditId());

      // Detect overdue CARs across all audits
      const today = new Date().toISOString().slice(0, 10);
      const overdue: { car: CAR; auditName: string }[] = [];
      await Promise.all(
        a.map(async (audit) => {
          const cars = await getCARsByAudit(audit.id);
          for (const car of cars) {
            if (!car.isAuditorVerifiedClosed && car.dueDate && car.dueDate < today) {
              overdue.push({ car, auditName: `${audit.supplierName} — ${audit.supplierSite}` });
            }
          }
        })
      );
      setOverdueCARs(overdue);
      setLoading(false);
    }
    load();
  }, []);

  function selectAudit(id: string) {
    setCurrentAuditId(id);
    setCurrentId(id);
  }

  if (loading) return <LoadingSpinner message="Loading dashboard…" />;

  const activeAudit = audits.find((a) => a.id === currentId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Supplier audit and qualification workflow"
        action={
          <Link
            href="/audits/new"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
          >
            + New Audit
          </Link>
        }
      />

      {/* Active audit quick-nav */}
      {activeAudit && (
        <Card title="Active Audit">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-slate-800 text-base">{activeAudit.supplierName}</div>
              <div className="text-sm text-slate-500">{activeAudit.supplierSite} · {activeAudit.auditType.replace(/_/g, " ")}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {activeAudit.auditDates.map(formatDate).join(", ")}
              </div>
            </div>
            <StatusBadge variant={activeAudit.status} />
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href={`/audits/${activeAudit.id}/supplier`} className="btn-secondary text-sm">Supplier Assessment</Link>
            <Link href={`/audits/${activeAudit.id}/verify`} className="btn-secondary text-sm">Auditor Verification</Link>
            <Link href={`/findings?auditId=${activeAudit.id}`} className="btn-secondary text-sm">Findings</Link>
            <Link href={`/cars?auditId=${activeAudit.id}`} className="btn-secondary text-sm">CARs</Link>
            <Link href={`/audits/${activeAudit.id}/report`} className="btn-secondary text-sm">Report</Link>
          </div>
        </Card>
      )}

      {/* Overdue CARs alert */}
      {overdueCARs.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600 font-bold text-sm">⚠ {overdueCARs.length} Overdue Corrective Action{overdueCARs.length > 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-1">
            {overdueCARs.slice(0, 5).map(({ car, auditName }) => (
              <div key={car.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-red-700">
                  <strong>{car.reference}</strong> — {auditName} — due {car.dueDate}
                </span>
                <Link
                  href={`/cars?auditId=${car.auditId}`}
                  className="text-red-600 hover:underline font-medium shrink-0"
                >
                  Review →
                </Link>
              </div>
            ))}
            {overdueCARs.length > 5 && (
              <p className="text-xs text-red-500 mt-1">…and {overdueCARs.length - 5} more</p>
            )}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Audits", value: audits.length, colour: "text-slate-700" },
          { label: "In Progress", value: audits.filter((a) => a.status === "IN_PROGRESS").length, colour: "text-blue-600" },
          { label: "Pending Approval", value: audits.filter((a) => a.status === "PENDING_APPROVAL").length, colour: "text-amber-600" },
          { label: "Checklists", value: checklists.length, colour: "text-green-600" },
        ].map((s) => (
          <Card key={s.label} className="text-center">
            <div className={`text-3xl font-bold ${s.colour}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Audit list */}
      <Card title="All Audits">
        {audits.length === 0 ? (
          <EmptyState
            title="No audits yet"
            description="Import a checklist and create your first audit to get started."
            action={
              <Link href="/audits/new" className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded">
                Create First Audit
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="pb-2 pr-4 font-semibold">Supplier</th>
                  <th className="pb-2 pr-4 font-semibold hidden sm:table-cell">Type</th>
                  <th className="pb-2 pr-4 font-semibold hidden md:table-cell">Dates</th>
                  <th className="pb-2 pr-4 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-4">
                      <div className="font-medium text-slate-800">{a.supplierName}</div>
                      <div className="text-xs text-slate-500">{a.supplierSite}</div>
                    </td>
                    <td className="py-2 pr-4 hidden sm:table-cell text-slate-600">
                      {a.auditType.replace(/_/g, " ")}
                    </td>
                    <td className="py-2 pr-4 hidden md:table-cell text-slate-500 text-xs">
                      {a.auditDates.map(formatDate).join(", ")}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge variant={a.status} />
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => selectAudit(a.id)}
                          className={`text-xs px-2 py-1 rounded border ${a.id === currentId ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:bg-slate-100"}`}
                        >
                          {a.id === currentId ? "Active" : "Set Active"}
                        </button>
                        <Link
                          href={`/audits/${a.id}`}
                          className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
                        >
                          Open
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { href: "/checklists",    icon: "📁", label: "Checklists",     desc: "Import and manage Excel checklists" },
          { href: "/findings",      icon: "🔍", label: "Findings",       desc: "Record and classify audit findings" },
          { href: "/suppliers",     icon: "📊", label: "Suppliers",       desc: "Risk dashboard and audit history" },
          { href: "/cars",          icon: "📋", label: "CARs",            desc: "Corrective action tracking" },
          { href: "/manufacturing", icon: "⚙️", label: "Manufacturing",   desc: "Process knowledge modules" },
          { href: "/settings",      icon: "🔧", label: "Settings",        desc: "Export, restore and reset data" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="block bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="text-xl mb-1">{l.icon}</div>
            <div className="font-semibold text-slate-700 text-sm">{l.label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{l.desc}</div>
          </Link>
        ))}
      </div>

    </div>
  );
}
