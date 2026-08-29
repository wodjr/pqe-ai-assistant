/**
 * lib/exportBackup.ts — PQE AI Assistant
 *
 * Export: serialises a full audit record (without blobs) to a JSON file
 *         and triggers a browser download.
 * Import: restores from a JSON backup file.
 */

import type { AuditExportPackage } from "@/types/project";
import {
  getAudit,
  getChecklist,
  getSupplierResponsesByAudit,
  getVerificationsByAudit,
  getEvidenceByAudit,
  getFindingsByAudit,
  getCARsByAudit,
  getReportByAudit,
  saveAudit,
  saveChecklist,
  saveSupplierResponse,
  saveVerification,
  saveEvidence,
  saveFinding,
  saveCAR,
  saveReport,
} from "@/lib/storage/db";

const APP_VERSION = "0.1.0";

export async function exportAuditToJson(auditId: string): Promise<void> {
  const audit = await getAudit(auditId);
  if (!audit) throw new Error(`Audit ${auditId} not found`);

  const checklist = await getChecklist(audit.checklistTemplateId);
  if (!checklist) throw new Error(`Checklist not found for audit ${auditId}`);

  const [supplierResponses, verifications, evidenceMetadata, findings, cars] = await Promise.all([
    getSupplierResponsesByAudit(auditId),
    getVerificationsByAudit(auditId),
    getEvidenceByAudit(auditId),
    getFindingsByAudit(auditId),
    getCARsByAudit(auditId),
  ]);

  const report = await getReportByAudit(auditId);

  const pkg: AuditExportPackage = {
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    dataClassification: "PROTOTYPE_ONLY",
    checklist,
    audit,
    supplierResponses,
    verifications,
    evidenceMetadata, // blobs are NOT exported — too large for JSON
    findings,
    cars,
    report: report ?? null,
  };

  const json = JSON.stringify(pkg, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-backup-${audit.supplierName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importAuditFromJson(file: File): Promise<string> {
  const text = await file.text();
  let pkg: AuditExportPackage;
  try {
    pkg = JSON.parse(text) as AuditExportPackage;
  } catch {
    throw new Error("Invalid backup file — could not parse JSON.");
  }

  if (!pkg.audit || !pkg.checklist) {
    throw new Error("Invalid backup file — missing audit or checklist data.");
  }

  // Restore all records
  await saveChecklist(pkg.checklist);
  await saveAudit(pkg.audit);
  await Promise.all(pkg.supplierResponses.map(saveSupplierResponse));
  await Promise.all(pkg.verifications.map(saveVerification));
  await Promise.all(pkg.evidenceMetadata.map(saveEvidence));
  await Promise.all(pkg.findings.map(saveFinding));
  await Promise.all(pkg.cars.map(saveCAR));
  if (pkg.report) await saveReport(pkg.report);

  return pkg.audit.id;
}
