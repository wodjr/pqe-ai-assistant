# FEATURE_SPEC.md — PQE AI Assistant v0.5.0

## Build Status Key
- ✅ Built and working
- 🔄 Deferred (post-MVP)

---

## Core Features

| Status | Feature |
|---|---|
| ✅ | Import existing Excel audit questionnaires and mechanical-process checklists |
| ✅ | Convert imported workbooks into controlled, revision-managed checklist templates |
| ✅ | Supplier portal for pre-audit self-assessment, comments and evidence upload |
| ✅ | Separate supplier responses from auditor onsite verification results |
| ✅ | Review previous audits, open findings, corrective actions and recent quality issues (Supplier Risk Dashboard) |
| ✅ | Risk-based audit planning, agenda and opening-presentation generation |
| ✅ | Upload auditor draft agenda (.txt / .docx) and AI refines it into a time-slotted schedule |
| ✅ | AI review of supplier submissions before the onsite audit |
| ✅ | Mobile photo capture for records, certificates and shop-floor evidence |
| ✅ | OCR extraction and verification of photographed supplier documents |
| ✅ | Technical-drawing analysis with balloon characteristics and CTF identification |
| ✅ | Compare drawing requirements with inspection and production records |
| ✅ | Vertical evidence trace from drawing to PFMEA, Control Plan, work instruction, measurement system and inspection result |
| ✅ | PFMEA, Control Plan, MSA, Gage R&R, SPC, Cp/Cpk and PPAP evidence review |
| ✅ | Material certificate, CoC, FAI, dimensional-report and calibration-record verification (OCR page) |
| ✅ | Voice recording and transcription of audit conversations with consent controls |
| ✅ | Smart Audit Note Taker — Plaud-style live meeting & shop floor walkthrough recorder (`/audits/[id]/smart`) |
| ✅ | Live speech transcription stream with interim results and automatic persistence |
| ✅ | Categorized Smart AI Notes (Statements, Commitments, Process Controls, Risks, Actions) |
| ✅ | Real-time AI Auditor Question Assistant — Prioritized (CRITICAL, IMPORTANT, FOLLOW-UP) probing questions |
| ✅ | Non-interruptive shop floor photo capture with AI risk & question suggestions |
| ✅ | Quick Voice Markers ("PQE note", "Potential finding", "Take action", "Good practice", etc.) |
| ✅ | Checklist Coverage Awareness Matrix (COVERED, PARTIALLY_COVERED, NOT_COVERED, OBJECTIVE_EVIDENCE_REQUIRED) |
| ✅ | Structured 13-Point End-of-Session Smart Summary with closing meeting recommendations |
| ✅ | Real-time AI suggestions for additional auditor questions and evidence requests |
| ✅ | "Show me" audit-question guidance based on identified risks and missing evidence (AI Verification Guidance) |
| ✅ | Daily audit summary and final audit-report generation |
| ✅ | Findings classified by configurable customer and company rules (scoring thresholds in Settings) |
| ✅ | Photo, document, transcript and checklist evidence linked to each finding |
| ✅ | Corrective Action Request creation, assignment and due-date tracking |
| ✅ | 8D, containment, root-cause, corrective-action and effectiveness verification workflow |
| 🔄 | Automatic reminders and management escalation for overdue actions (requires server + push notifications) |
| ✅ | Supplier qualification recommendation with mandatory human approval |
| ✅ | Manufacturing knowledge modules for CNC, casting, thermal processing, injection moulding, stamping, welding, plating, painting, surface finishing, assembly and testing |
| ✅ | Supplier profiles, process capabilities, certifications, audit history and risk dashboards |
| ✅ | Offline mobile operation (Service Worker, IndexedDB) |
| ✅ | Secure synchronisation after reconnecting — ZIP export → AirDrop/iCloud → ZIP import on Mac |
| 🔄 | Role-based access and user accounts (requires authentication — deferred post-MVP) |
| 🔄 | Data encryption at rest (requires server-side storage — deferred post-MVP) |
| 🔄 | Audit trails and evidence-retention controls (requires server-side storage) |
| ✅ | Clear separation between AI suggestions and auditor-approved conclusions |
| ✅ | Customer-specific requirements, scoring thresholds and approval rules (configurable in Settings) |
| ✅ | Multilingual-ready supplier forms (EN / ES / DE / FR / ZH) |
| 🔄 | Multilingual reports and full audit interactions (partial — forms only for now) |

---

## Target Users

**Primary** — Procurement Quality Engineers, Supplier Quality Engineers, manufacturing-process auditors and technical specialists who conduct new-supplier qualification, process audits, line audits, quality-issue investigations and corrective-action verification.

**Secondary** — Supplier quality representatives, manufacturing engineers and management personnel who complete pre-audit self-assessments, upload supporting evidence, respond to findings and submit corrective actions.

**Managers** — Quality managers and procurement managers use dashboards to review supplier risk, audit status, open findings, overdue corrective actions and qualification decisions.

**Admins** — System administrators manage users, permissions, suppliers, checklist templates, revisions, scoring rules and customer-specific requirements. *(Deferred — requires authentication)*

---

## Feature Behaviour Guidelines

- Each feature works end to end before adding the next.
- All user input is validated at the form level.
- Loading state is shown during any async operation.
- A friendly error message is shown if anything fails.
- Success confirmation is shown where useful.

---

## Non-Functional Requirements

| Requirement | Target | Status |
|---|---|---|
| Mobile support | Works correctly on 375px screens and up | ✅ |
| Accessibility | Labelled buttons, aria-labels, focus rings, breadcrumbs, skip-link | ✅ |
| Performance | Page loads under 3 seconds | ✅ |
| TypeScript | No implicit any; all types explicitly defined | ✅ |
| Build | `npm run build` passes before each release | ✅ |
| Offline | Full operation without network | ✅ |
| AI safety | AI suggestions never auto-set approval fields | ✅ |
| Security | API key server-side only; inputs sanitised; blobs in IndexedDB only | ✅ |

---

## Deferred Features (Post-MVP)

| Feature | Reason deferred |
|---|---|
| User login / accounts (SAML / OpenID Connect) | Requires authentication provider and session management |
| Server-side database (replace IndexedDB) | Requires backend infrastructure |
| Real-time collaboration | Requires server + WebSocket |
| Automatic CAR reminders / escalation emails | Requires server-side scheduler + email service |
| Encryption at rest | Requires server-side storage |
| Full audit trail log | Requires persistent server storage |
| Dark mode | UI polish — low priority |
| Payment / subscription | Not applicable to current scope |
