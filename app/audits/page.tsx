"use client";
/**
 * app/audits/page.tsx — All audits list
 */
import { useEffect, useState } from "react";
import { listAudits } from "@/lib/storage/db";
import { setCurrentAuditId, getCurrentAuditId } from "@/lib/storage/localStorage";
import { formatDate } from "@/lib/utils/format";
import type { Audit } from "@/types/project";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function AuditsPage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    listAudits().then((a) => {
      setAudits(a.sort((x, y) => y.createdAt.localeCompare(x.createdAt)));
      setCurrentId(getCurrentAuditId());
      setLoading(false);
    });
  }, []);

  function activate(id: string) {
    setCurrentAuditId(id);
    setCurrentId(id);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audits"
        subtitle="Manage all supplier audit records"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Audits" }]}
        action={
          <Link href="/audits/new" className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded">
            + New Audit
          </Link>
        }
      />

      {audits.length === 0 ? (
        <EmptyState
          title="No audits yet"
          description="Create your first audit to begin the qualification workflow."
          action={
            <Link href="/audits/new" className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded">
              Create First Audit
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {audits.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">{a.supplierName}</span>
                    <StatusBadge variant={a.status} />
                    {a.id === currentId && (
                      <span className="badge bg-blue-100 text-blue-700">Active</span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5">
                    {a.supplierSite} · {a.auditType.replace(/_/g, " ")}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Lead: {a.leadAuditor} · Dates: {a.auditDates.map(formatDate).join(", ")}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {a.id !== currentId && (
                    <button
                      onClick={() => activate(a.id)}
                      className="text-xs border border-slate-300 text-slate-600 px-3 py-1 rounded hover:bg-slate-50"
                    >
                      Set Active
                    </button>
                  )}
                  <Link href={`/audits/${a.id}`} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                    Open Audit
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
