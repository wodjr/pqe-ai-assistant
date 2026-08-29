"use client";
/**
 * app/page.tsx — Dashboard
 * Shows all audits, quick-access actions, and overall status summary.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { listAudits, listChecklists } from "@/lib/storage/db";
import { getCurrentAuditId, setCurrentAuditId } from "@/lib/storage/localStorage";
import { formatDate } from "@/lib/utils/format";
import type { Audit, ChecklistTemplate } from "@/types/project";
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

  useEffect(() => {
    async function load() {
      const [a, c] = await Promise.all([listAudits(), listChecklists()]);
      const sorted = [...a].sort(
        (x, y) => (STATUS_ORDER[x.status] ?? 9) - (STATUS_ORDER[y.status] ?? 9)
      );
      setAudits(sorted);
      setChecklists(c);
      setCurrentId(getCurrentAuditId());
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/checklists" className="block bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow">
          <div className="text-2xl mb-2">📁</div>
          <div className="font-semibold text-slate-700">Checklist Templates</div>
          <div className="text-xs text-slate-500 mt-1">Import and manage Excel audit checklists</div>
        </Link>
        <Link href="/findings" className="block bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow">
          <div className="text-2xl mb-2">🔍</div>
          <div className="font-semibold text-slate-700">Findings Log</div>
          <div className="text-xs text-slate-500 mt-1">Record and classify audit findings</div>
        </Link>
        <Link href="/settings" className="block bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow">
          <div className="text-2xl mb-2">⚙️</div>
          <div className="font-semibold text-slate-700">Settings &amp; Backup</div>
          <div className="text-xs text-slate-500 mt-1">Export, restore and reset audit data</div>
        </Link>
      </div>
    </div>
  );
}
