"use client";
/**
 * app/settings/page.tsx — Settings, export, import, backup and reset
 */
import { useState, useRef } from "react";
import { listAudits, factoryReset } from "@/lib/storage/db";
import { clearAllPreferences, getAuditorName, setAuditorName } from "@/lib/storage/localStorage";
import { exportAuditToJson, importAuditFromJson } from "@/lib/exportBackup";
import type { Audit } from "@/types/project";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import { useEffect } from "react";

export default function SettingsPage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [auditorName, setAuditorNameState] = useState("");
  const [exportAuditId, setExportAuditId] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listAudits().then(setAudits);
    setAuditorNameState(getAuditorName());
  }, []);

  function showStatus(type: "success" | "error", message: string) {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 5000);
  }

  function handleSaveAuditorName() {
    setAuditorName(auditorName);
    showStatus("success", "Auditor name saved.");
  }

  async function handleExport() {
    if (!exportAuditId) { showStatus("error", "Select an audit to export."); return; }
    try {
      await exportAuditToJson(exportAuditId);
      showStatus("success", "Audit exported. Check your downloads folder.");
    } catch (e) {
      showStatus("error", e instanceof Error ? e.message : "Export failed");
    }
  }

  async function handleImport(file: File) {
    try {
      const id = await importAuditFromJson(file);
      const updated = await listAudits();
      setAudits(updated);
      showStatus("success", `Audit imported successfully (ID: ${id.slice(0, 8)}…). Evidence blobs are not included in JSON backups — re-attach photo evidence manually.`);
    } catch (e) {
      showStatus("error", e instanceof Error ? e.message : "Import failed");
    }
  }

  async function handleReset() {
    const confirmed = confirm(
      "⚠ FACTORY RESET\n\n" +
      "This will permanently delete ALL audits, checklists, findings, CARs, evidence, and reports stored in this browser.\n\n" +
      "This cannot be undone. Export any audits you want to keep first.\n\nType RESET to confirm."
    );
    if (!confirmed) return;
    const text = window.prompt("Type RESET to confirm factory reset:");
    if (text?.trim().toUpperCase() !== "RESET") { showStatus("error", "Reset cancelled."); return; }

    await factoryReset();
    clearAllPreferences();
    setAudits([]);
    showStatus("success", "Factory reset complete. All prototype data deleted.");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Settings"
        subtitle="Preferences, export, import and storage management"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Settings" }]}
      />

      {status && (
        <div
          className={`p-4 rounded-lg text-sm font-medium ${
            status.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {status.type === "success" ? "✓" : "❌"} {status.message}
        </div>
      )}

      {/* Auditor name */}
      <Card title="Auditor Preferences">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your Name (Lead Auditor)</label>
            <p className="text-xs text-slate-500 mb-2">
              Stored in localStorage only. Used to auto-fill auditor name on new audits.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={auditorName}
                onChange={(e) => setAuditorNameState(e.target.value)}
                placeholder="e.g. Jane Smith"
                className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSaveAuditorName}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Export */}
      <Card title="Export Audit (JSON Backup)">
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            Exports all structured audit data (checklist, responses, verifications, findings, CARs, report)
            as a JSON file. <strong>Photo and document blobs are not included</strong> — they are too large
            for JSON and must be re-attached if you restore to a new device.
          </p>
          <div className="flex gap-2 flex-wrap">
            <select
              aria-label="Select audit to export"
              value={exportAuditId}
              onChange={(e) => setExportAuditId(e.target.value)}
              className="flex-1 min-w-[200px] border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select audit to export —</option>
              {audits.map((a) => (
                <option key={a.id} value={a.id}>{a.supplierName} — {a.supplierSite}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExport}
              disabled={!exportAuditId}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded disabled:opacity-50"
            >
              ⬇ Export JSON
            </button>
          </div>
        </div>
      </Card>

      {/* Import */}
      <Card title="Import Audit from Backup">
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            Restore a previously exported JSON backup. If an audit with the same ID already exists,
            it will be overwritten. Evidence blobs must be re-attached manually after import.
          </p>
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="bg-slate-600 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded"
          >
            📂 Choose Backup File (.json)
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
          />
        </div>
      </Card>

      {/* Storage info */}
      <Card title="Storage Information">
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            <strong>IndexedDB</strong> stores all audit records, checklists, evidence metadata and blobs.
            Browser storage limits vary (typically 50–500 MB depending on device and browser).
          </p>
          <p>
            <strong>localStorage</strong> stores only: auditor name, current audit ID, and UI preferences.
            No evidence or audit content is stored in localStorage.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-amber-800 text-xs font-medium mt-2">
            ⚠ PROTOTYPE STORAGE — This data is not encrypted at rest. Do not store actual confidential
            production drawings, supplier quality data or personal information in this prototype application
            until a secure server-side database is deployed.
          </div>
        </div>
      </Card>

      {/* Scoring Rules */}
      <Card title="Scoring Thresholds">
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">
            Define pass/fail thresholds for audit scores. These are displayed as reference only —
            the final qualification decision always requires explicit auditor sign-off.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Pass Threshold (%)", key: "pqe:scorePass", defaultVal: "80", description: "Score ≥ this % = pass" },
              { label: "Conditional (%)", key: "pqe:scoreCond", defaultVal: "60", description: "Score ≥ this % = conditional" },
              { label: "Fail Below (%)", key: "pqe:scoreFail", defaultVal: "60", description: "Score < this % = fail" },
            ].map((field) => {
              const stored = typeof window !== "undefined"
                ? localStorage.getItem(field.key) ?? field.defaultVal
                : field.defaultVal;
              return (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{field.label}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={stored}
                    onChange={(e) => {
                      if (typeof window !== "undefined") localStorage.setItem(field.key, e.target.value);
                    }}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-400 mt-0.5">{field.description}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400">
            Changes are saved automatically to localStorage in this browser.
          </p>
        </div>
      </Card>

      {/* Factory reset */}
      <Card title="Factory Reset">
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            Permanently deletes all prototype data stored in this browser: audits, checklists, findings,
            CARs, evidence and reports. <strong>This cannot be undone.</strong> Export all audits first.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded"
          >
            ⚠ Factory Reset — Delete All Data
          </button>
        </div>
      </Card>
    </div>
  );
}
