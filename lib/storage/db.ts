/**
 * lib/storage/db.ts — PQE AI Assistant
 *
 * IndexedDB abstraction using the `idb` library.
 *
 * ⚠️  PROTOTYPE STORAGE — NOT PRODUCTION-READY ⚠️
 * All data is stored in the browser's IndexedDB.
 * This storage layer is designed to be replaced by a secure server-side
 * database and object storage without changing the audit workflow code.
 * Data is not encrypted at rest in this prototype.
 * Do not store confidential drawings or production supplier documents here
 * for real audits until a server-backed implementation is in place.
 */

import { openDB, type IDBPDatabase } from "idb";
import type {
  ChecklistTemplate,
  Audit,
  SupplierResponse,
  AuditorVerification,
  Evidence,
  Finding,
  CAR,
  AuditReport,
} from "@/types/project";

const DB_NAME = "pqe-ai-assistant";
const DB_VERSION = 1;

export type StoreNames =
  | "checklists"
  | "audits"
  | "supplierResponses"
  | "verifications"
  | "evidence"
  | "findings"
  | "cars"
  | "reports"
  | "blobs";

let _db: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Keyed by record.id
      if (!db.objectStoreNames.contains("checklists")) {
        db.createObjectStore("checklists", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("audits")) {
        const audits = db.createObjectStore("audits", { keyPath: "id" });
        audits.createIndex("by_status", "status");
      }
      if (!db.objectStoreNames.contains("supplierResponses")) {
        const sr = db.createObjectStore("supplierResponses", { keyPath: "id" });
        sr.createIndex("by_audit", "auditId");
        sr.createIndex("by_question", "questionId");
      }
      if (!db.objectStoreNames.contains("verifications")) {
        const v = db.createObjectStore("verifications", { keyPath: "id" });
        v.createIndex("by_audit", "auditId");
        v.createIndex("by_question", "questionId");
      }
      if (!db.objectStoreNames.contains("evidence")) {
        const ev = db.createObjectStore("evidence", { keyPath: "id" });
        ev.createIndex("by_audit", "auditId");
      }
      if (!db.objectStoreNames.contains("findings")) {
        const f = db.createObjectStore("findings", { keyPath: "id" });
        f.createIndex("by_audit", "auditId");
      }
      if (!db.objectStoreNames.contains("cars")) {
        const c = db.createObjectStore("cars", { keyPath: "id" });
        c.createIndex("by_audit", "auditId");
        c.createIndex("by_finding", "findingId");
      }
      if (!db.objectStoreNames.contains("reports")) {
        const r = db.createObjectStore("reports", { keyPath: "id" });
        r.createIndex("by_audit", "auditId");
      }
      // Raw blobs (workbook source files, photo/document evidence)
      // Stored separately from metadata to keep structured records small.
      if (!db.objectStoreNames.contains("blobs")) {
        db.createObjectStore("blobs"); // key is blobKey string
      }
    },
  });
  return _db;
}

// ---------------------------------------------------------------------------
// Checklist templates
// ---------------------------------------------------------------------------

export async function saveChecklist(template: ChecklistTemplate): Promise<void> {
  const db = await getDB();
  await db.put("checklists", template);
}

export async function getChecklist(id: string): Promise<ChecklistTemplate | undefined> {
  const db = await getDB();
  return db.get("checklists", id);
}

export async function listChecklists(): Promise<ChecklistTemplate[]> {
  const db = await getDB();
  return db.getAll("checklists");
}

export async function deleteChecklist(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("checklists", id);
}

// ---------------------------------------------------------------------------
// Audits
// ---------------------------------------------------------------------------

export async function saveAudit(audit: Audit): Promise<void> {
  const db = await getDB();
  await db.put("audits", audit);
}

export async function getAudit(id: string): Promise<Audit | undefined> {
  const db = await getDB();
  return db.get("audits", id);
}

export async function listAudits(): Promise<Audit[]> {
  const db = await getDB();
  return db.getAll("audits");
}

export async function deleteAudit(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("audits", id);
}

// ---------------------------------------------------------------------------
// Supplier responses
// ---------------------------------------------------------------------------

export async function saveSupplierResponse(response: SupplierResponse): Promise<void> {
  const db = await getDB();
  await db.put("supplierResponses", response);
}

export async function getSupplierResponsesByAudit(auditId: string): Promise<SupplierResponse[]> {
  const db = await getDB();
  return db.getAllFromIndex("supplierResponses", "by_audit", auditId);
}

export async function getSupplierResponse(id: string): Promise<SupplierResponse | undefined> {
  const db = await getDB();
  return db.get("supplierResponses", id);
}

export async function deleteSupplierResponse(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("supplierResponses", id);
}

// ---------------------------------------------------------------------------
// Auditor verifications
// ---------------------------------------------------------------------------

export async function saveVerification(verification: AuditorVerification): Promise<void> {
  const db = await getDB();
  await db.put("verifications", verification);
}

export async function getVerificationsByAudit(auditId: string): Promise<AuditorVerification[]> {
  const db = await getDB();
  return db.getAllFromIndex("verifications", "by_audit", auditId);
}

export async function getVerification(id: string): Promise<AuditorVerification | undefined> {
  const db = await getDB();
  return db.get("verifications", id);
}

// ---------------------------------------------------------------------------
// Evidence (metadata only; blobs in separate store)
// ---------------------------------------------------------------------------

export async function saveEvidence(evidence: Evidence): Promise<void> {
  const db = await getDB();
  await db.put("evidence", evidence);
}

export async function getEvidenceByAudit(auditId: string): Promise<Evidence[]> {
  const db = await getDB();
  return db.getAllFromIndex("evidence", "by_audit", auditId);
}

export async function getEvidence(id: string): Promise<Evidence | undefined> {
  const db = await getDB();
  return db.get("evidence", id);
}

export async function deleteEvidence(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("evidence", id);
}

// ---------------------------------------------------------------------------
// Blobs (raw file data)
// ---------------------------------------------------------------------------

export async function saveBlob(key: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put("blobs", blob, key);
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  const db = await getDB();
  return db.get("blobs", key);
}

export async function deleteBlob(key: string): Promise<void> {
  const db = await getDB();
  await db.delete("blobs", key);
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

export async function saveFinding(finding: Finding): Promise<void> {
  const db = await getDB();
  await db.put("findings", finding);
}

export async function getFindingsByAudit(auditId: string): Promise<Finding[]> {
  const db = await getDB();
  return db.getAllFromIndex("findings", "by_audit", auditId);
}

export async function getFinding(id: string): Promise<Finding | undefined> {
  const db = await getDB();
  return db.get("findings", id);
}

export async function deleteFinding(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("findings", id);
}

// ---------------------------------------------------------------------------
// CARs
// ---------------------------------------------------------------------------

export async function saveCAR(car: CAR): Promise<void> {
  const db = await getDB();
  await db.put("cars", car);
}

export async function getCARsByAudit(auditId: string): Promise<CAR[]> {
  const db = await getDB();
  return db.getAllFromIndex("cars", "by_audit", auditId);
}

export async function getCAR(id: string): Promise<CAR | undefined> {
  const db = await getDB();
  return db.get("cars", id);
}

export async function deleteCAR(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("cars", id);
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function saveReport(report: AuditReport): Promise<void> {
  const db = await getDB();
  await db.put("reports", report);
}

export async function getReportByAudit(auditId: string): Promise<AuditReport | undefined> {
  const db = await getDB();
  const results = await db.getAllFromIndex("reports", "by_audit", auditId);
  return results[results.length - 1];
}

export async function getReport(id: string): Promise<AuditReport | undefined> {
  const db = await getDB();
  return db.get("reports", id);
}

// ---------------------------------------------------------------------------
// Full-audit delete (cascade)
// ---------------------------------------------------------------------------

export async function deleteAuditCascade(auditId: string): Promise<void> {
  const db = await getDB();

  // Delete all related evidence blobs first
  const evidenceList = await db.getAllFromIndex("evidence", "by_audit", auditId);
  for (const ev of evidenceList) {
    await db.delete("blobs", ev.blobKey);
    await db.delete("evidence", ev.id);
  }

  const tx = db.transaction(
    ["audits", "supplierResponses", "verifications", "findings", "cars", "reports"],
    "readwrite"
  );
  const [srStore, vStore, fStore, cStore, rStore] = [
    tx.objectStore("supplierResponses"),
    tx.objectStore("verifications"),
    tx.objectStore("findings"),
    tx.objectStore("cars"),
    tx.objectStore("reports"),
  ];

  const [srs, vs, fs, cs, rs] = await Promise.all([
    srStore.index("by_audit").getAllKeys(auditId),
    vStore.index("by_audit").getAllKeys(auditId),
    fStore.index("by_audit").getAllKeys(auditId),
    cStore.index("by_audit").getAllKeys(auditId),
    rStore.index("by_audit").getAllKeys(auditId),
  ]);

  await Promise.all([
    ...srs.map((k) => srStore.delete(k)),
    ...vs.map((k) => vStore.delete(k)),
    ...fs.map((k) => fStore.delete(k)),
    ...cs.map((k) => cStore.delete(k)),
    ...rs.map((k) => rStore.delete(k)),
  ]);

  await tx.objectStore("audits").delete(auditId);
  await tx.done;
}

// ---------------------------------------------------------------------------
// Factory reset
// ---------------------------------------------------------------------------

export async function factoryReset(): Promise<void> {
  const db = await getDB();
  const stores: StoreNames[] = [
    "checklists",
    "audits",
    "supplierResponses",
    "verifications",
    "evidence",
    "findings",
    "cars",
    "reports",
    "blobs",
  ];
  const tx = db.transaction(stores, "readwrite");
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
  await tx.done;
}
