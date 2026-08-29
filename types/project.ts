// =============================================================================
// types/project.ts — PQE AI Assistant
// All shared TypeScript domain types for the MVP audit workflow.
// =============================================================================

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export type AuditStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "PENDING_APPROVAL"
  | "CLOSED";

export type AuditType =
  | "QUALIFICATION"
  | "PROCESS"
  | "LINE"
  | "INVESTIGATION"
  | "CAR_VERIFICATION";

export type ResponseStatus =
  | "CONFORMING"
  | "MINOR_NC"
  | "MAJOR_NC"
  | "NOT_APPLICABLE"
  | "NOT_ASSESSED";

export type VerificationVerdict =
  | "CONFORMS"
  | "MINOR_NC"
  | "MAJOR_NC"
  | "NOT_VERIFIABLE"
  | "NOT_APPLICABLE";

export type EvidenceType =
  | "PHOTO"
  | "DOCUMENT"
  | "TRANSCRIPT"
  | "EXTERNAL_REF";

export type FindingClass =
  | "MAJOR"
  | "MINOR"
  | "OBSERVATION"
  | "OFI";

export type CARStatus =
  | "OPEN"
  | "CONTAINMENT"
  | "ROOT_CAUSE"
  | "CORRECTIVE_ACTION"
  | "EFFECTIVENESS"
  | "CLOSED"
  | "OVERDUE";

export type RecommendationStatus =
  | "APPROVE"
  | "CONDITIONAL"
  | "REJECT"
  | "DEFER"
  | "PENDING";

// ---------------------------------------------------------------------------
// Checklist template (imported from Excel workbook)
// ---------------------------------------------------------------------------

export interface ChecklistQuestion {
  id: string;
  sectionId: string;
  order: number;
  /** Clause or drawing reference, e.g. "4.1.2" */
  reference: string;
  text: string;
  guidance: string;
  maxScore: number | null;
  /** Human-readable scoring basis, e.g. "0 / 4 / 8 / 10" */
  scoringBasis: string | null;
  isMandatory: boolean;
}

export interface ChecklistSection {
  id: string;
  title: string;
  order: number;
  questions: ChecklistQuestion[];
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  revision: string;
  importedAt: string; // ISO-8601
  sourceFileName: string;
  /** Original workbook stored as a read-only Blob in IndexedDB — separate store */
  sourceFileBlobKey: string;
  sections: ChecklistSection[];
  totalMaxScore: number;
}

// ---------------------------------------------------------------------------
// Audit record
// ---------------------------------------------------------------------------

export interface Audit {
  id: string;
  checklistTemplateId: string;
  checklistRevision: string;
  status: AuditStatus;
  supplierName: string;
  supplierSite: string;
  supplierContact: string;
  auditType: AuditType;
  auditDates: string[]; // ISO-8601 date strings
  leadAuditor: string;
  auditTeam: string[];
  scope: string;
  agenda: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Supplier self-assessment response
// ---------------------------------------------------------------------------

export interface SupplierResponse {
  id: string;
  auditId: string;
  questionId: string;
  status: ResponseStatus;
  score: number | null;
  response: string;
  comments: string;
  evidenceIds: string[];
  submittedAt: string | null;
  submittedBy: string;
}

// ---------------------------------------------------------------------------
// Auditor onsite verification
// ---------------------------------------------------------------------------

export interface AuditorVerification {
  id: string;
  auditId: string;
  questionId: string;
  verdict: VerificationVerdict | null;
  score: number | null;
  notes: string;
  evidenceIds: string[];
  /**
   * AI-suggested text for display only.
   * This field MUST NOT trigger any automated state change.
   * The auditor must explicitly set `verdict` and `isApproved`.
   */
  aiSuggestion: string | null;
  verifiedAt: string | null;
  verifiedBy: string;
  isApproved: boolean; // must be set by explicit auditor action — never auto-set
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export interface EvidenceLink {
  type: "QUESTION" | "FINDING" | "CAR";
  targetId: string;
}

export interface Evidence {
  id: string;
  auditId: string;
  type: EvidenceType;
  fileName: string;
  mimeType: string;
  caption: string;
  takenAt: string; // ISO-8601
  linkedTo: EvidenceLink[];
  /**
   * Always "PROTOTYPE_ONLY".
   * The blob is stored separately in IndexedDB under key `evidence_blob_<id>`.
   * Do NOT place evidence blobs in localStorage.
   */
  dataClassification: "PROTOTYPE_ONLY";
  blobKey: string;
}

// ---------------------------------------------------------------------------
// Finding
// ---------------------------------------------------------------------------

export interface Finding {
  id: string;
  auditId: string;
  /** Auto-generated reference, e.g. "F-001" */
  reference: string;
  classification: FindingClass;
  title: string;
  description: string;
  questionIds: string[];
  evidenceIds: string[];
  supplierResponseId: string | null;
  verificationId: string | null;
  requiresCAR: boolean;
  carId: string | null;
  raisedAt: string;
  raisedBy: string;
  /**
   * Must be set by explicit auditor action.
   * AI analysis must never auto-set this to true.
   */
  isAuditorApproved: boolean;
}

// ---------------------------------------------------------------------------
// Corrective Action Request (CAR)
// ---------------------------------------------------------------------------

export interface CAR {
  id: string;
  auditId: string;
  findingId: string;
  /** Auto-generated reference, e.g. "CAR-001" */
  reference: string;
  status: CARStatus;
  owner: string;
  dueDate: string; // ISO-8601
  /** 8D Step 1: Containment action */
  containment: string;
  /** 8D Step 2: Root cause analysis */
  rootCause: string;
  /** 8D Step 3: Corrective action */
  correctiveAction: string;
  /** 8D Step 4: Effectiveness verification notes */
  effectivenessEvidence: string;
  effectivenessEvidenceIds: string[];
  closedAt: string | null;
  /**
   * Identity of auditor who closed.
   * This must be set by explicit auditor action — never auto-closed by AI.
   */
  closedBy: string | null;
  isAuditorVerifiedClosed: boolean;
}

// ---------------------------------------------------------------------------
// Audit Report
// ---------------------------------------------------------------------------

export interface AuditReport {
  id: string;
  auditId: string;
  generatedAt: string;
  generatedBy: string;
  qualificationRecommendation: RecommendationStatus;
  conclusion: string;
  /**
   * The auditor must explicitly approve the final report.
   * AI may suggest conclusions; `isAuditorApproved` must never be auto-set.
   */
  isAuditorApproved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  confidentialityNotice: string;
  /** Snapshot scores at time of report generation */
  totalScore: number;
  totalMaxScore: number;
  majorFindings: number;
  minorFindings: number;
  observations: number;
  openCARs: number;
}

// ---------------------------------------------------------------------------
// Storage export package (for backup / restore)
// ---------------------------------------------------------------------------

export interface AuditExportPackage {
  exportedAt: string;
  appVersion: string;
  dataClassification: "PROTOTYPE_ONLY";
  checklist: ChecklistTemplate;
  audit: Audit;
  supplierResponses: SupplierResponse[];
  verifications: AuditorVerification[];
  evidenceMetadata: Evidence[]; // blobs are not included in JSON export
  findings: Finding[];
  cars: CAR[];
  report: AuditReport | null;
}

// ---------------------------------------------------------------------------
// UI helper types
// ---------------------------------------------------------------------------

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export interface StatusBadgeVariant {
  label: string;
  colour: "green" | "yellow" | "red" | "gray" | "blue" | "orange";
}
