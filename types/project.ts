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

// ---------------------------------------------------------------------------
// PPAP Part Submission Review
// ---------------------------------------------------------------------------

export type PpapElementRisk = "OK" | "GAP" | "MISSING" | "NOT_REVIEWED";

export interface PpapElementResult {
  elementId: string;   // "1"–"18"
  title: string;
  risk: PpapElementRisk;
  note: string;        // AI observation for this element
}

export type PpapPartRisk = "GREEN" | "AMBER" | "RED";

export interface PpapPartReview {
  id: string;
  auditId: string;
  partNumber: string;    // derived from filename or first sheet
  fileName: string;
  uploadedAt: string;    // ISO-8601
  /** Raw text extracted from all worksheets — sent to AI */
  extractedText: string;
  /** AI narrative review — full suggestion text */
  aiSuggestion: string | null;
  aiGeneratedAt: string | null;
  /** Per-element structured results parsed from AI response */
  elementResults: PpapElementResult[];
  /** Overall risk colour */
  overallRisk: PpapPartRisk;
  /** Cpk values spotted by AI */
  cpkValues: string;
  /** PSW status spotted by AI */
  pswStatus: string;
  /** Auditor final decision — must be set by explicit action */
  auditorDecision: "PENDING" | "ACCEPTED" | "REJECTED";
  auditorNotes: string;
  decidedAt: string | null;
  decidedBy: string;
}

// ---------------------------------------------------------------------------
// Storage export package (for backup / restore)
// ---------------------------------------------------------------------------

export type VoiceMarkerType =
  | "POTENTIAL_FINDING"
  | "PQE_NOTE"
  | "TAKE_ACTION"
  | "FOLLOW_UP"
  | "GOOD_PRACTICE"
  | "NEED_EVIDENCE";

export interface VoiceMarker {
  id: string;
  timestamp: string; // e.g. "10:42" or ISO
  timestampSec: number;
  type: VoiceMarkerType;
  text: string;
}

export interface SpeakerProfile {
  id: string; // e.g. "speaker_1", "speaker_2"
  name: string; // e.g. "Richard", "Mr. Han"
  role?: string; // e.g. "Lead Auditor", "Supplier QA Manager", "Line Supervisor", "Operator"
  color?: string; // e.g. "blue", "indigo", "emerald", "amber", "rose"
}

export interface TranscriptSegment {
  id: string;
  timestamp: string;
  timestampSec: number;
  audioStartSec?: number;
  audioEndSec?: number;
  text: string;
  isFinal: boolean;
  speakerId?: string; // e.g. "speaker_1"
  speakerName?: string; // e.g. "Lead Auditor", "Mr. Han"
  speakerRole?: string;
}

export type SmartNoteCategory =
  | "STATEMENT"
  | "COMMITMENT"
  | "PROCESS_CONTROL"
  | "DOCUMENT_MENTIONED"
  | "RISK_PROBLEM"
  | "FOLLOW_UP";

export type SmartQuestionPriority = "CRITICAL" | "IMPORTANT" | "FOLLOW_UP";

export interface SmartAuditorPrompt {
  id: string;
  priority: SmartQuestionPriority;
  question: string;
  reason: string;
  suggestedAction?: string;
  relatedRequirement?: string;
  timestamp: string;
  timestampSec: number;
  dismissed?: boolean;
}

export type ChecklistCoverageStatus =
  | "COVERED"
  | "PARTIALLY_COVERED"
  | "NOT_COVERED"
  | "OBJECTIVE_EVIDENCE_REQUIRED";

export interface SmartChecklistCoverageItem {
  questionId: string;
  questionRef: string;
  questionText: string;
  status: ChecklistCoverageStatus;
  analysis: string;
  evidenceNeeded?: string;
}

export interface SmartAiNote {
  id: string;
  timestampSec: number;
  category: SmartNoteCategory;
  note: string;
}

export interface SessionPhoto {
  id: string;
  evidenceId: string;
  blobKey: string;
  timestamp: string;
  timestampSec: number;
  caption: string;
  auditorNote: string;
  relatedQuestionId?: string;
  relatedProcess?: string;
  aiSuggestedRisk?: string;
  aiSuggestedQuestion?: string;
}

export interface SmartAuditSession {
  id: string;
  auditId: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  status: "RECORDING" | "PAUSED" | "COMPLETED";
  durationSec: number;
  audioBlobKey?: string;
  speakers?: SpeakerProfile[];
  transcriptSegments: TranscriptSegment[];
  markers: VoiceMarker[];
  photos: SessionPhoto[];
  aiNotes: SmartAiNote[];
  prompts?: SmartAuditorPrompt[];
  coverage?: SmartChecklistCoverageItem[];
  endSessionSummary?: string;
  lastAiAnalysisSec?: number;
  updatedAt: string;
}

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
  ppapReviews: PpapPartReview[];
  smartSessions?: SmartAuditSession[];
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
