# FEATURE_SPEC.md — PQE_AI_Assistant

## Core Features

Import existing Excel audit questionnaires and mechanical-process checklists

Convert imported workbooks into controlled, revision-managed checklist templates

Supplier portal for pre-audit self-assessment, comments and evidence upload

Separate supplier responses from auditor onsite verification results

Review previous audits, open findings, corrective actions and recent quality issues

Risk-based audit planning, agenda and opening-presentation generation

AI review of supplier submissions before the onsite audit

Mobile photo capture for records, certificates and shop-floor evidence

OCR extraction and verification of photographed supplier documents

Technical-drawing analysis with balloon characteristics and CTF identification

Compare drawing requirements with inspection and production records

Vertical evidence trace from drawing to PFMEA, Control Plan, work instruction, measurement system and inspection result

PFMEA, Control Plan, MSA, Gage R&R, SPC, Cp/Cpk and PPAP evidence review

Material certificate, CoC, FAI, dimensional-report and calibration-record verification

Voice recording and transcription of audit conversations with consent controls

Real-time AI suggestions for additional auditor questions and evidence requests

“Show me” audit-question guidance based on identified risks and missing evidence

Daily audit summary and final audit-report generation

Findings classified by configurable customer and company rules

Photo, document, transcript and checklist evidence linked to each finding

Corrective Action Request creation, assignment and due-date tracking

8D, containment, root-cause, corrective-action and effectiveness verification workflow

Automatic reminders and management escalation for overdue actions

Supplier qualification recommendation with mandatory human approval

Manufacturing knowledge modules for CNC, casting, thermal processing, injection moulding, stamping, welding, plating, painting, surface finishing, assembly and testing

Supplier profiles, process capabilities, certifications, audit history and risk dashboards

Offline mobile operation with secure synchronization after reconnecting

Role-based access, data encryption, audit trails and evidence-retention controls

Clear separation between AI suggestions and auditor-approved conclusions

Customer-specific requirements, scoring thresholds and approval rules

Multilingual-ready supplier forms, reports and audit interactions

## Target Users

Primary users are Procurement Quality Engineers, Supplier Quality Engineers, manufacturing-process auditors and technical specialists who conduct new-supplier qualification, process audits, line audits, quality-issue investigations and corrective-action verification.

Secondary users are supplier quality representatives, manufacturing engineers and management personnel who complete pre-audit self-assessments, upload supporting evidence, respond to findings and submit corrective actions.

Quality managers and procurement managers use dashboards to review supplier risk, audit status, open findings, overdue corrective actions and qualification decisions.

System administrators manage users, permissions, suppliers, checklist templates, revisions, scoring rules and customer-specific requirements.

## Feature Behaviour Guidelines

- Each feature should work end to end before adding the next.
- Validate all user input at the form level.
- Show loading state during any async operation.
- Show a friendly error message if anything fails.
- Show a success confirmation where useful.

## Non-Functional Requirements

| Requirement     | Target                                          |
|-----------------|-------------------------------------------------|
| Mobile support  | Works correctly on 375px screens and up         |
| Accessibility   | Labelled buttons, sufficient colour contrast    |
| Performance     | Page loads in under 3 seconds                   |
| TypeScript      | No implicit any; all types explicitly defined   |
| Build           | npm run build passes before each release        |

## Deferred Features (Not in MVP)

- User login and accounts
- Database for saved data
- Payment integration
- Download or export
- Dark mode
- AI automation

