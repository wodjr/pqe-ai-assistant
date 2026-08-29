# PROJECT_BRIEF.md — PQE_AI_Assistant

## Project Summary

A secure, AI-assisted web and mobile application that supports Procurement Quality Engineers throughout the complete supplier qualification and onsite audit process.

Before an audit, the application imports controlled Excel audit checklists, sends the appropriate self-assessment to the supplier, collects responses and evidence, and reviews previous audit findings, open corrective actions and recent quality issues. It then prepares a risk-based audit plan, agenda, opening presentation and recommended follow-up questions.

During the onsite audit, the auditor can photograph supplier records, certificates, inspection results and manufacturing evidence. AI uses OCR and document analysis to compare this evidence with checklist requirements, technical drawings, specifications, PFMEA, Control Plans, work instructions and production records. It identifies critical-to-function characteristics, dimension concerns, missing information, inconsistencies and possible traceability gaps for auditor confirmation.

The application also captures and transcribes audit conversations, provides real-time suggested questions, tracks findings and evidence, and produces daily summaries, final audit reports and corrective-action follow-up through verified closure.

The solution must support mechanical manufacturing processes such as CNC machining, sheet-metal stamping, casting, thermal processes, plastic injection moulding, welding, plating, painting, surface finishing, assembly and testing. AI provides recommendations, but only an authorized human auditor can accept evidence, finalize findings, approve suppliers or close corrective actions.

## Target Users

Primary users are Procurement Quality Engineers, Supplier Quality Engineers, manufacturing-process auditors and technical specialists who conduct new-supplier qualification, process audits, line audits, quality-issue investigations and corrective-action verification.

Secondary users are supplier quality representatives, manufacturing engineers and management personnel who complete pre-audit self-assessments, upload supporting evidence, respond to findings and submit corrective actions.

Quality managers and procurement managers use dashboards to review supplier risk, audit status, open findings, overdue corrective actions and qualification decisions.

System administrators manage users, permissions, suppliers, checklist templates, revisions, scoring rules and customer-specific requirements.

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

## Technology Stack

- Framework: Next.js (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- Deployment: Vercel

## MVP Scope

Build only the core features listed above.
No login, database, or paid API unless explicitly required.

## Out of Scope for MVP

- User authentication or accounts
- Database or persistent storage
- Payment or subscription features
- Real-time collaboration
- Advanced AI automation

## Success Criteria

- App loads correctly on mobile and desktop.
- All core features work end to end.
- App deploys to Vercel without errors.
- npm run build passes with no TypeScript or ESLint errors.

## Risks

- Scope creep: stick to MVP features only.
- Mobile layout: use mobile-first Tailwind design from the start.
- API keys: always use server-side routes and .env.local.

