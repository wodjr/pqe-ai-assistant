"use client";
/**
 * app/audits/new/page.tsx — Create new audit
 */
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { listChecklists, saveAudit } from "@/lib/storage/db";
import { setCurrentAuditId, getAuditorName, setAuditorName } from "@/lib/storage/localStorage";
import { nanoid } from "@/lib/utils/nanoid";
import type { Audit, AuditType, ChecklistTemplate } from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Link from "next/link";

const AUDIT_TYPES: { value: AuditType; label: string }[] = [
  { value: "QUALIFICATION", label: "New Supplier Qualification" },
  { value: "PROCESS", label: "Process Audit" },
  { value: "LINE", label: "Line Audit" },
  { value: "INVESTIGATION", label: "Quality Investigation" },
  { value: "CAR_VERIFICATION", label: "CAR Verification" },
];

export default function NewAuditPage() {
  const router = useRouter();
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    checklistTemplateId: "",
    supplierName: "",
    supplierSite: "",
    supplierContact: "",
    auditType: "QUALIFICATION" as AuditType,
    auditDates: [new Date().toISOString().slice(0, 10)],
    leadAuditor: "",
    auditTeam: "",
    scope: "",
    agenda: "",
  });

  useEffect(() => {
    listChecklists().then(setChecklists);
    const savedName = getAuditorName();
    if (savedName) setForm((f) => ({ ...f, leadAuditor: savedName }));
  }, []);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleDateChange(index: number, value: string) {
    setForm((f) => {
      const dates = [...f.auditDates];
      dates[index] = value;
      return { ...f, auditDates: dates };
    });
  }

  function addDate() {
    setForm((f) => ({ ...f, auditDates: [...f.auditDates, new Date().toISOString().slice(0, 10)] }));
  }

  function removeDate(index: number) {
    setForm((f) => ({ ...f, auditDates: f.auditDates.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.checklistTemplateId) { setError("Please select a checklist template."); return; }
    if (!form.supplierName.trim()) { setError("Supplier name is required."); return; }
    if (!form.leadAuditor.trim()) { setError("Lead auditor name is required."); return; }

    setSaving(true);
    try {
      const checklist = checklists.find((c) => c.id === form.checklistTemplateId);
      if (!checklist) throw new Error("Checklist not found");

      const now = new Date().toISOString();
      const audit: Audit = {
        id: nanoid(),
        checklistTemplateId: form.checklistTemplateId,
        checklistRevision: checklist.revision,
        status: "DRAFT",
        supplierName: form.supplierName.trim(),
        supplierSite: form.supplierSite.trim(),
        supplierContact: form.supplierContact.trim(),
        auditType: form.auditType,
        auditDates: form.auditDates.filter(Boolean),
        leadAuditor: form.leadAuditor.trim(),
        auditTeam: form.auditTeam.split(",").map((s) => s.trim()).filter(Boolean),
        scope: form.scope.trim(),
        agenda: form.agenda.trim(),
        createdAt: now,
        updatedAt: now,
      };

      await saveAudit(audit);
      setCurrentAuditId(audit.id);
      setAuditorName(form.leadAuditor.trim());
      router.push(`/audits/${audit.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create audit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Create New Audit"
        subtitle="Set up a supplier audit record"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Audits", href: "/audits" }, { label: "New Audit" }]}
      />

      {checklists.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          ⚠ No checklist templates available.{" "}
          <Link href="/checklists" className="underline font-medium">Import a checklist first</Link>.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card title="Checklist &amp; Audit Setup">
          <div className="space-y-4">
            {/* Checklist */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Checklist Template <span className="text-red-500">*</span>
              </label>
              <select
                value={form.checklistTemplateId}
                onChange={(e) => set("checklistTemplateId", e.target.value)}
                required
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select a checklist —</option>
                {checklists.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Rev {c.revision})
                  </option>
                ))}
              </select>
            </div>

            {/* Audit type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Audit Type <span className="text-red-500">*</span>
              </label>
              <select
                value={form.auditType}
                onChange={(e) => set("auditType", e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {AUDIT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Supplier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Supplier Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.supplierName}
                  onChange={(e) => set("supplierName", e.target.value)}
                  required
                  placeholder="e.g. Acme Precision Ltd"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Site</label>
                <input
                  type="text"
                  value={form.supplierSite}
                  onChange={(e) => set("supplierSite", e.target.value)}
                  placeholder="e.g. Manchester, UK"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Contact</label>
              <input
                type="text"
                value={form.supplierContact}
                onChange={(e) => set("supplierContact", e.target.value)}
                placeholder="Name and role"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Audit dates */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Audit Date(s)</label>
              {form.auditDates.map((d, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    type="date"
                    value={d}
                    onChange={(e) => handleDateChange(i, e.target.value)}
                    className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {form.auditDates.length > 1 && (
                    <button type="button" onClick={() => removeDate(i)} className="text-red-500 text-sm hover:text-red-700">✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addDate} className="text-blue-600 text-xs hover:underline">+ Add another date</button>
            </div>

            {/* Auditors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Lead Auditor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.leadAuditor}
                  onChange={(e) => set("leadAuditor", e.target.value)}
                  required
                  placeholder="Your name"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Audit Team</label>
                <input
                  type="text"
                  value={form.auditTeam}
                  onChange={(e) => set("auditTeam", e.target.value)}
                  placeholder="Comma-separated names"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Scope */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Audit Scope</label>
              <textarea
                value={form.scope}
                onChange={(e) => set("scope", e.target.value)}
                rows={3}
                placeholder="Describe the processes, products and requirements to be audited…"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Agenda */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Audit Agenda</label>
              <textarea
                value={form.agenda}
                onChange={(e) => set("agenda", e.target.value)}
                rows={4}
                placeholder="08:00 Opening meeting&#10;09:00 Manufacturing process review&#10;11:00 Document review&#10;14:00 Shop floor walk&#10;16:00 Closing meeting"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && <p className="text-sm text-red-600">❌ {error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || checklists.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-6 py-2 rounded disabled:opacity-50 transition-colors"
              >
                {saving ? "Creating…" : "Create Audit"}
              </button>
              <Link href="/audits" className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2 border border-slate-300 rounded">
                Cancel
              </Link>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
