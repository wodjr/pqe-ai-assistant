/**
 * lib/generateReport.ts — PQE AI Assistant
 *
 * Assembles a print-ready HTML audit report string.
 * The caller renders this into a hidden iframe and triggers window.print().
 *
 * Design rules:
 * - AI suggestions are clearly labelled "[AI SUGGESTION — NOT AUDITOR APPROVED]"
 * - Human-approved items are labelled with auditor name + timestamp
 * - The report cannot be finalized unless isAuditorApproved = true
 * - A confidentiality notice appears on every page via print CSS
 * - The structure supports future native PDF generation without redesign
 */

import type {
  Audit,
  ChecklistTemplate,
  SupplierResponse,
  AuditorVerification,
  Evidence,
  Finding,
  CAR,
  AuditReport,
  FindingClass,
  CARStatus,
  RecommendationStatus,
} from "@/types/project";
import { formatDate, formatDateTime, formatScore } from "@/lib/utils/format";

interface ReportData {
  audit: Audit;
  checklist: ChecklistTemplate;
  supplierResponses: SupplierResponse[];
  verifications: AuditorVerification[];
  evidence: Evidence[];
  findings: Finding[];
  cars: CAR[];
  report: AuditReport;
  /** Base64 data URIs for photos, keyed by evidence.id */
  photoDataUris: Record<string, string>;
}

function findingColour(cls: FindingClass): string {
  return cls === "MAJOR" ? "#dc2626" : cls === "MINOR" ? "#d97706" : "#2563eb";
}

function carStatusLabel(status: CARStatus): string {
  const map: Record<CARStatus, string> = {
    OPEN: "Open",
    CONTAINMENT: "Containment",
    ROOT_CAUSE: "Root Cause Analysis",
    CORRECTIVE_ACTION: "Corrective Action",
    EFFECTIVENESS: "Effectiveness Verification",
    CLOSED: "Closed",
    OVERDUE: "⚠ Overdue",
  };
  return map[status];
}

function recommendationBadge(r: RecommendationStatus): string {
  const map: Record<RecommendationStatus, [string, string]> = {
    APPROVE: ["#16a34a", "APPROVE"],
    CONDITIONAL: ["#d97706", "CONDITIONAL APPROVAL"],
    REJECT: ["#dc2626", "REJECT"],
    DEFER: ["#6b7280", "DEFER DECISION"],
    PENDING: ["#6b7280", "PENDING"],
  };
  const [colour, label] = map[r];
  return `<span style="background:${colour};color:#fff;padding:4px 12px;border-radius:4px;font-weight:700;font-size:13px;">${label}</span>`;
}

function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateReportHtml(data: ReportData): string {
  const {
    audit,
    checklist,
    supplierResponses,
    verifications,
    evidence,
    findings,
    cars,
    report,
    photoDataUris,
  } = data;

  const responseMap = new Map(supplierResponses.map((r) => [r.questionId, r]));
  const verificationMap = new Map(verifications.map((v) => [v.questionId, v]));
  const evidenceMap = new Map(evidence.map((e) => [e.id, e]));
  const findingsByCar = new Map(findings.map((f) => [f.carId ?? "", f]));

  const majorCount = findings.filter((f) => f.classification === "MAJOR").length;
  const minorCount = findings.filter((f) => f.classification === "MINOR").length;
  const obsCount = findings.filter(
    (f) => f.classification === "OBSERVATION" || f.classification === "OFI"
  ).length;

  const approvedVerifications = verifications.filter((v) => v.isApproved);
  const totalScore = approvedVerifications.reduce((sum, v) => sum + (v.score ?? 0), 0);
  const scorePercent =
    checklist.totalMaxScore > 0
      ? Math.round((totalScore / checklist.totalMaxScore) * 100)
      : null;

  const css = `
    @import url('');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, "Segoe UI", Arial, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      background: #fff;
    }
    .page { max-width: 210mm; margin: 0 auto; padding: 20mm 18mm; }
    h1 { font-size: 18pt; margin-bottom: 4pt; }
    h2 { font-size: 13pt; margin: 20pt 0 6pt; border-bottom: 1.5pt solid #1d4ed8; padding-bottom: 3pt; color: #1d4ed8; }
    h3 { font-size: 11pt; margin: 14pt 0 4pt; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 9.5pt; }
    th { background: #1e293b; color: #fff; padding: 5pt 7pt; text-align: left; font-weight: 600; }
    td { padding: 4pt 7pt; border-bottom: 0.5pt solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .badge { display: inline-block; padding: 2pt 7pt; border-radius: 3pt; font-size: 8.5pt; font-weight: 600; }
    .major { background: #fee2e2; color: #dc2626; }
    .minor { background: #fef3c7; color: #d97706; }
    .obs   { background: #dbeafe; color: #2563eb; }
    .conf  { background: #dcfce7; color: #16a34a; }
    .nc    { background: #fee2e2; color: #dc2626; }
    .na    { background: #f1f5f9; color: #64748b; }
    .ai-suggestion {
      background: #fffbeb;
      border: 1pt dashed #f59e0b;
      border-radius: 3pt;
      padding: 4pt 8pt;
      font-size: 9pt;
      color: #92400e;
      margin: 4pt 0;
    }
    .ai-suggestion::before { content: "⚠ AI SUGGESTION — NOT AUDITOR APPROVED: "; font-weight: 700; }
    .auditor-approved-label { color: #16a34a; font-size: 8.5pt; font-weight: 600; }
    .draft-label { color: #dc2626; font-size: 8.5pt; font-weight: 700; }
    .photo-grid { display: flex; flex-wrap: wrap; gap: 8pt; margin: 8pt 0; }
    .photo-item { width: 130pt; }
    .photo-item img { width: 130pt; height: 100pt; object-fit: cover; border: 0.5pt solid #cbd5e1; }
    .photo-caption { font-size: 7.5pt; color: #64748b; margin-top: 2pt; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt 20pt; margin: 8pt 0; }
    .info-row { display: flex; gap: 8pt; padding: 3pt 0; border-bottom: 0.5pt solid #f1f5f9; }
    .info-label { font-weight: 600; min-width: 130pt; color: #374151; font-size: 9.5pt; }
    .info-value { color: #1a1a1a; font-size: 9.5pt; }
    .score-box { border: 1.5pt solid #1d4ed8; border-radius: 4pt; padding: 10pt 16pt; display: inline-block; }
    .score-num { font-size: 24pt; font-weight: 700; color: #1d4ed8; }
    .score-max { font-size: 12pt; color: #64748b; }
    .confidentiality {
      font-size: 7.5pt;
      color: #6b7280;
      text-align: center;
      border-top: 0.5pt solid #e5e7eb;
      padding-top: 6pt;
      margin-top: 16pt;
    }
    .signature-box {
      border: 0.5pt solid #9ca3af;
      padding: 10pt;
      margin: 8pt 0;
      min-height: 60pt;
    }
    .prototype-banner {
      background: #fef3c7;
      border: 1.5pt solid #f59e0b;
      border-radius: 4pt;
      padding: 6pt 12pt;
      font-size: 9pt;
      color: #92400e;
      margin-bottom: 12pt;
      text-align: center;
      font-weight: 600;
    }
    @media print {
      body { margin: 0; }
      .page { padding: 15mm 15mm; max-width: none; }
      .no-print { display: none !important; }
      h2 { page-break-after: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
      .photo-grid { page-break-inside: avoid; }
      .confidentiality {
        position: fixed;
        bottom: 6mm;
        left: 0; right: 0;
      }
    }
  `;

  // ---------------------------------------------------------------------------
  // Section: Checklist responses table
  // ---------------------------------------------------------------------------
  const checklistRows = checklist.sections
    .flatMap((sec) =>
      sec.questions.map((q) => {
        const sr = responseMap.get(q.id);
        const av = verificationMap.get(q.id);
        const srStatus = sr?.status ?? "NOT_ASSESSED";
        const avVerdict = av?.verdict ?? null;

        const srBadge =
          srStatus === "CONFORMING"
            ? `<span class="badge conf">Conforming</span>`
            : srStatus === "MINOR_NC"
              ? `<span class="badge minor">Minor NC</span>`
              : srStatus === "MAJOR_NC"
                ? `<span class="badge major">Major NC</span>`
                : srStatus === "NOT_APPLICABLE"
                  ? `<span class="badge na">N/A</span>`
                  : `<span class="badge na">Not Assessed</span>`;

        const avBadge = avVerdict
          ? avVerdict === "CONFORMS"
            ? `<span class="badge conf">Conforms</span>`
            : avVerdict === "MINOR_NC"
              ? `<span class="badge minor">Minor NC</span>`
              : avVerdict === "MAJOR_NC"
                ? `<span class="badge major">Major NC</span>`
                : `<span class="badge na">${avVerdict}</span>`
          : `<span class="badge na">Not Verified</span>`;

        const aiNote =
          av?.aiSuggestion
            ? `<div class="ai-suggestion">${escHtml(av.aiSuggestion)}</div>`
            : "";

        const approvedLabel = av?.isApproved
          ? `<div class="auditor-approved-label">✓ Auditor approved: ${escHtml(av.verifiedBy)} ${formatDateTime(av.verifiedAt)}</div>`
          : "";

        return `<tr>
          <td style="white-space:nowrap;font-size:8.5pt;color:#64748b;">${escHtml(q.reference)}</td>
          <td>${escHtml(q.text)}</td>
          <td>${srBadge}<br/><span style="font-size:8.5pt;">${escHtml(sr?.response)}</span></td>
          <td>${avBadge}${aiNote}${approvedLabel}</td>
          <td style="text-align:center;">${formatScore(av?.score ?? null, q.maxScore)}</td>
        </tr>`;
      })
    )
    .join("\n");

  // ---------------------------------------------------------------------------
  // Section: Findings
  // ---------------------------------------------------------------------------
  const findingRows = findings
    .map((f) => {
      const colour = findingColour(f.classification);
      const approvalLabel = f.isAuditorApproved
        ? `<span class="auditor-approved-label">✓ Approved by ${escHtml(f.raisedBy)}</span>`
        : `<span class="draft-label">DRAFT — Awaiting auditor approval</span>`;
      const evidenceLinks = f.evidenceIds
        .map((eid) => {
          const ev = evidenceMap.get(eid);
          return ev ? `<span style="font-size:8.5pt;color:#2563eb;">${escHtml(ev.fileName)}</span>` : "";
        })
        .filter(Boolean)
        .join(", ");
      return `<tr>
        <td style="font-weight:700;color:${colour};">${escHtml(f.reference)}</td>
        <td><span class="badge" style="background:${colour}20;color:${colour};">${f.classification}</span></td>
        <td><strong>${escHtml(f.title)}</strong><br/><span style="font-size:8.5pt;">${escHtml(f.description)}</span></td>
        <td>${evidenceLinks || "—"}</td>
        <td>${approvalLabel}</td>
      </tr>`;
    })
    .join("\n");

  // ---------------------------------------------------------------------------
  // Section: CARs
  // ---------------------------------------------------------------------------
  const carRows = cars
    .map((car) => {
      const f = findingsByCar.get(car.id) ?? findings.find((fi) => fi.carId === car.id);
      const closedLabel = car.isAuditorVerifiedClosed
        ? `<span class="auditor-approved-label">✓ Closed by ${escHtml(car.closedBy ?? "")} ${formatDate(car.closedAt)}</span>`
        : `<span style="color:#d97706;font-weight:600;">Open — ${carStatusLabel(car.status)}</span>`;
      return `<tr>
        <td style="font-weight:700;">${escHtml(car.reference)}</td>
        <td>${escHtml(f?.reference ?? "—")}</td>
        <td>${escHtml(car.owner)}</td>
        <td style="white-space:nowrap;">${formatDate(car.dueDate)}</td>
        <td>${closedLabel}</td>
      </tr>`;
    })
    .join("\n");

  // ---------------------------------------------------------------------------
  // Section: Photos
  // ---------------------------------------------------------------------------
  const photoItems = evidence
    .filter((e) => e.type === "PHOTO" && photoDataUris[e.id])
    .map(
      (e) =>
        `<div class="photo-item">
          <img src="${photoDataUris[e.id]}" alt="${escHtml(e.caption)}" />
          <div class="photo-caption">${escHtml(e.caption || e.fileName)}<br/>
          ${formatDateTime(e.takenAt)}</div>
        </div>`
    )
    .join("\n");

  const approvalBlock = report.isAuditorApproved
    ? `<div class="auditor-approved-label" style="font-size:11pt;margin-bottom:8pt;">
        ✓ Report approved by <strong>${escHtml(report.approvedBy ?? "")}</strong> on ${formatDateTime(report.approvedAt)}
      </div>`
    : `<div class="draft-label" style="font-size:11pt;margin-bottom:8pt;">
        ⚠ DRAFT — This report has not been approved by the auditor.
      </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Audit Report — ${escHtml(audit.supplierName)}</title>
<style>${css}</style>
</head>
<body>
<div class="page">

  <div class="prototype-banner">
    ⚠ PROTOTYPE STORAGE — NOT PRODUCTION-READY — Data stored in browser IndexedDB only.
    This report is generated from prototype data and must not be used as an official quality record
    until the application is deployed with a secure server-side database.
  </div>

  <!-- COVER -->
  <div style="margin-bottom:24pt;">
    <div style="color:#1d4ed8;font-size:10pt;font-weight:600;letter-spacing:1px;margin-bottom:4pt;">
      PROCUREMENT QUALITY ENGINEERING
    </div>
    <h1>Supplier Audit Report</h1>
    <div style="font-size:14pt;color:#374151;margin:4pt 0 16pt;">${escHtml(audit.supplierName)} — ${escHtml(audit.supplierSite)}</div>
    ${approvalBlock}
    <div class="info-grid">
      <div>
        <div class="info-row"><span class="info-label">Audit Type</span><span class="info-value">${audit.auditType.replace(/_/g, " ")}</span></div>
        <div class="info-row"><span class="info-label">Audit Dates</span><span class="info-value">${audit.auditDates.map(formatDate).join(", ")}</span></div>
        <div class="info-row"><span class="info-label">Lead Auditor</span><span class="info-value">${escHtml(audit.leadAuditor)}</span></div>
        <div class="info-row"><span class="info-label">Audit Team</span><span class="info-value">${escHtml(audit.auditTeam.join(", "))}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Supplier Contact</span><span class="info-value">${escHtml(audit.supplierContact)}</span></div>
        <div class="info-row"><span class="info-label">Checklist</span><span class="info-value">${escHtml(checklist.name)} Rev ${escHtml(checklist.revision)}</span></div>
        <div class="info-row"><span class="info-label">Report Generated</span><span class="info-value">${formatDateTime(report.generatedAt)}</span></div>
        <div class="info-row"><span class="info-label">Generated By</span><span class="info-value">${escHtml(report.generatedBy)}</span></div>
      </div>
    </div>
  </div>

  <!-- SCOPE & AGENDA -->
  <h2>1. Audit Scope &amp; Agenda</h2>
  <p style="white-space:pre-wrap;font-size:10pt;">${escHtml(audit.scope)}</p>
  ${audit.agenda ? `<h3>Agenda</h3><p style="white-space:pre-wrap;font-size:10pt;">${escHtml(audit.agenda)}</p>` : ""}

  <!-- SUMMARY SCORES -->
  <h2>2. Summary</h2>
  <div style="display:flex;gap:32pt;align-items:flex-start;flex-wrap:wrap;margin:8pt 0 16pt;">
    ${scorePercent !== null ? `<div class="score-box"><div class="score-num">${scorePercent}%</div><div class="score-max">${totalScore} / ${checklist.totalMaxScore} points</div></div>` : ""}
    <table style="max-width:300pt;">
      <tr><th>Classification</th><th>Count</th></tr>
      <tr><td><span class="badge major">Major</span></td><td>${majorCount}</td></tr>
      <tr><td><span class="badge minor">Minor</span></td><td>${minorCount}</td></tr>
      <tr><td><span class="badge obs">Obs / OFI</span></td><td>${obsCount}</td></tr>
      <tr><td>Open CARs</td><td>${cars.filter((c) => !c.isAuditorVerifiedClosed).length}</td></tr>
    </table>
  </div>

  <!-- QUALIFICATION RECOMMENDATION -->
  <h2>3. Qualification Recommendation</h2>
  <p style="margin-bottom:8pt;">${recommendationBadge(report.qualificationRecommendation)}</p>
  <p style="white-space:pre-wrap;font-size:10pt;">${escHtml(report.conclusion)}</p>
  <p style="font-size:8.5pt;color:#6b7280;margin-top:6pt;">
    Note: AI may have suggested elements of this conclusion. Final recommendation reflects auditor judgement only.
    This recommendation requires mandatory human approval before any supplier qualification decision is recorded.
  </p>

  <!-- CHECKLIST RESPONSES vs VERIFICATION -->
  <h2>4. Checklist: Supplier Responses vs Auditor Verification</h2>
  <table>
    <thead><tr><th style="width:60pt;">Ref</th><th>Question</th><th style="width:90pt;">Supplier Response</th><th style="width:130pt;">Auditor Verification</th><th style="width:55pt;">Score</th></tr></thead>
    <tbody>${checklistRows}</tbody>
  </table>

  <!-- FINDINGS -->
  <h2>5. Findings</h2>
  ${findings.length === 0 ? "<p>No findings recorded.</p>" : `
  <table>
    <thead><tr><th>Ref</th><th>Class</th><th>Finding</th><th>Evidence</th><th>Status</th></tr></thead>
    <tbody>${findingRows}</tbody>
  </table>`}

  <!-- CARs -->
  <h2>6. Corrective Action Requests</h2>
  ${cars.length === 0 ? "<p>No CARs raised.</p>" : `
  <table>
    <thead><tr><th>CAR Ref</th><th>Finding</th><th>Owner</th><th>Due Date</th><th>Status</th></tr></thead>
    <tbody>${carRows}</tbody>
  </table>
  <h3>8D Details</h3>
  ${cars.map((car) => `
  <div style="margin:8pt 0;padding:8pt;border:0.5pt solid #e5e7eb;border-radius:4pt;">
    <strong>${escHtml(car.reference)}</strong> — Owner: ${escHtml(car.owner)} — Due: ${formatDate(car.dueDate)}
    <div class="info-row" style="margin-top:4pt;"><span class="info-label">Containment</span><span class="info-value">${escHtml(car.containment) || "—"}</span></div>
    <div class="info-row"><span class="info-label">Root Cause</span><span class="info-value">${escHtml(car.rootCause) || "—"}</span></div>
    <div class="info-row"><span class="info-label">Corrective Action</span><span class="info-value">${escHtml(car.correctiveAction) || "—"}</span></div>
    <div class="info-row"><span class="info-label">Effectiveness</span><span class="info-value">${escHtml(car.effectivenessEvidence) || "—"}</span></div>
    ${car.isAuditorVerifiedClosed ? `<div class="auditor-approved-label">✓ Verified closed by ${escHtml(car.closedBy ?? "")} on ${formatDate(car.closedAt)}</div>` : ""}
  </div>`).join("")}
  `}

  <!-- PHOTOGRAPHIC EVIDENCE -->
  ${photoItems ? `<h2>7. Photographic Evidence</h2><div class="photo-grid">${photoItems}</div>` : ""}

  <!-- APPROVAL & SIGNATURE -->
  <h2>8. Approval &amp; Signature</h2>
  <p style="font-size:9.5pt;margin-bottom:8pt;">
    This audit report represents the professional judgement of the lead auditor.
    AI-generated suggestions have been clearly labelled throughout this report.
    Only items marked "Auditor Approved" reflect auditor-confirmed findings.
  </p>
  <table style="max-width:400pt;">
    <tr><th>Role</th><th>Name</th><th>Date</th><th>Signature</th></tr>
    <tr><td>Lead Auditor</td><td>${escHtml(audit.leadAuditor)}</td><td>${report.isAuditorApproved ? formatDate(report.approvedAt) : ""}</td><td class="signature-box"></td></tr>
    <tr><td>Quality Manager</td><td></td><td></td><td class="signature-box"></td></tr>
  </table>

  <!-- CONFIDENTIALITY -->
  <div class="confidentiality">
    ${escHtml(report.confidentialityNotice || "CONFIDENTIAL — This document contains proprietary supplier quality information. Reproduction or disclosure outside the intended recipients is prohibited.")}
    &nbsp;|&nbsp; Generated: ${formatDateTime(report.generatedAt)}
    &nbsp;|&nbsp; PQE AI Assistant — Prototype Storage — Not a Production Quality Record
  </div>

</div>
</body>
</html>`;
}
