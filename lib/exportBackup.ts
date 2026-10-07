/**
 * lib/exportBackup.ts — PQE AI Assistant
 *
 * JSON export/import: structured audit data only (no blobs).
 * ZIP export/import: structured audit data + all photo/document blobs.
 */

import JSZip from "jszip";
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
  getPpapReviewsByAudit,
  getSmartSessionsByAudit,
  saveAudit,
  saveChecklist,
  saveSupplierResponse,
  saveVerification,
  saveEvidence,
  saveFinding,
  saveCAR,
  saveReport,
  savePpapReview,
  saveSmartSession,
  getBlob,
  saveBlob,
} from "@/lib/storage/db";

const APP_VERSION = "0.1.0";

// ---------------------------------------------------------------------------
// Shared: build the structured export package for an audit
// ---------------------------------------------------------------------------

async function buildExportPackage(auditId: string): Promise<AuditExportPackage> {
  const audit = await getAudit(auditId);
  if (!audit) throw new Error(`Audit ${auditId} not found`);

  const checklist = await getChecklist(audit.checklistTemplateId);
  if (!checklist) throw new Error(`Checklist not found for audit ${auditId}`);

  const [supplierResponses, verifications, evidenceMetadata, findings, cars, ppapReviews, smartSessions] = await Promise.all([
    getSupplierResponsesByAudit(auditId),
    getVerificationsByAudit(auditId),
    getEvidenceByAudit(auditId),
    getFindingsByAudit(auditId),
    getCARsByAudit(auditId),
    getPpapReviewsByAudit(auditId),
    getSmartSessionsByAudit(auditId),
  ]);

  const report = await getReportByAudit(auditId);

  return {
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    dataClassification: "PROTOTYPE_ONLY",
    checklist,
    audit,
    supplierResponses,
    verifications,
    evidenceMetadata,
    findings,
    cars,
    report: report ?? null,
    ppapReviews,
    smartSessions,
  };
}

// ---------------------------------------------------------------------------
// Shared: restore structured package (no blobs)
// ---------------------------------------------------------------------------

async function restorePackage(pkg: AuditExportPackage): Promise<string> {
  if (!pkg.audit || !pkg.checklist) {
    throw new Error("Invalid backup — missing audit or checklist data.");
  }
  await saveChecklist(pkg.checklist);
  await saveAudit(pkg.audit);
  await Promise.all(pkg.supplierResponses.map(saveSupplierResponse));
  await Promise.all(pkg.verifications.map(saveVerification));
  await Promise.all(pkg.evidenceMetadata.map(saveEvidence));
  await Promise.all(pkg.findings.map(saveFinding));
  await Promise.all(pkg.cars.map(saveCAR));
  if (pkg.report) await saveReport(pkg.report);
  if (pkg.ppapReviews?.length) await Promise.all(pkg.ppapReviews.map(savePpapReview));
  if (pkg.smartSessions?.length) await Promise.all(pkg.smartSessions.map(saveSmartSession));
  return pkg.audit.id;
}

// ---------------------------------------------------------------------------
// Trigger a browser download of a Blob
// ---------------------------------------------------------------------------

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// JSON export (structured data only — no blobs)
// ---------------------------------------------------------------------------

export async function exportAuditToJson(auditId: string): Promise<void> {
  const pkg = await buildExportPackage(auditId);
  const json = JSON.stringify(pkg, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const safeName = pkg.audit.supplierName.replace(/\s+/g, "-");
  triggerDownload(blob, `audit-backup-${safeName}-${new Date().toISOString().slice(0, 10)}.json`);
}

// ---------------------------------------------------------------------------
// JSON import (structured data only — blobs excluded)
// ---------------------------------------------------------------------------

export async function importAuditFromJson(file: File): Promise<string> {
  const text = await file.text();
  let pkg: AuditExportPackage;
  try {
    pkg = JSON.parse(text) as AuditExportPackage;
  } catch {
    throw new Error("Invalid backup file — could not parse JSON.");
  }
  return restorePackage(pkg);
}

// ---------------------------------------------------------------------------
// ZIP export — structured data + all evidence blobs
// ---------------------------------------------------------------------------

export async function exportAuditToZip(auditId: string): Promise<void> {
  const pkg = await buildExportPackage(auditId);

  const zip = new JSZip();

  // 1. audit-data.json — all structured records
  zip.file("audit-data.json", JSON.stringify(pkg, null, 2));

  // 2. blobs/ folder — one file per evidence item
  const blobsFolder = zip.folder("blobs");
  if (!blobsFolder) throw new Error("Failed to create blobs folder in zip");

  for (const ev of pkg.evidenceMetadata) {
    const blob = await getBlob(ev.blobKey);
    if (!blob) continue; // skip if blob was already deleted
    const ext = ev.fileName.includes(".") ? ev.fileName.split(".").pop() : "bin";
    // Use blobKey as the filename so restore can match it back exactly
    blobsFolder.file(`${ev.blobKey}.${ext}`, await blob.arrayBuffer(), { binary: true });
  }

  const safeName = pkg.audit.supplierName.replace(/\s+/g, "-");
  const dateStr = new Date().toISOString().slice(0, 10);
  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  triggerDownload(zipBlob, `audit-with-photos-${safeName}-${dateStr}.zip`);
}

// ---------------------------------------------------------------------------
// ZIP import — structured data + blobs restored to IndexedDB
// ---------------------------------------------------------------------------

export async function importAuditFromZip(file: File): Promise<{ auditId: string; blobsRestored: number }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // 1. Read and restore structured data
  const dataFile = zip.file("audit-data.json");
  if (!dataFile) throw new Error("Invalid zip — audit-data.json not found.");

  let pkg: AuditExportPackage;
  try {
    pkg = JSON.parse(await dataFile.async("string")) as AuditExportPackage;
  } catch {
    throw new Error("Invalid zip — audit-data.json could not be parsed.");
  }

  const auditId = await restorePackage(pkg);

  // 2. Restore blobs — match files in blobs/ back to evidence records by blobKey prefix
  let blobsRestored = 0;
  const blobsFolder = zip.folder("blobs");
  if (blobsFolder) {
    for (const ev of pkg.evidenceMetadata) {
      // Find the zip entry whose name starts with the blobKey (extension varies)
      const entry = blobsFolder.file(new RegExp(`^${ev.blobKey}\\.`));
      if (entry.length === 0) continue;
      const arrayBuffer = await entry[0].async("arraybuffer");
      await saveBlob(ev.blobKey, new Blob([arrayBuffer], { type: ev.mimeType }));
      blobsRestored++;
    }
  }

  return { auditId, blobsRestored };
}
