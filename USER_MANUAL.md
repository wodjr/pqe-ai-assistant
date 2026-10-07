# PQE AI Assistant — User Operation Manual (v0.5.0)

Welcome to the **PQE AI Assistant**! This user manual provides step-by-step guidance for Procurement Quality Engineers (PQE), Supplier Quality Engineers (SQE), and manufacturing auditors conducting supplier audits, process evaluations, and shop floor walkthroughs.

---

## 📑 Table of Contents

1. [Quick Start & Overview](#1-quick-start--overview)
2. [Phase 1: Pre-Audit Preparation](#2-phase-1-pre-audit-preparation)
   - [1.1 Import Audit Checklists](#11-import-audit-checklists)
   - [1.2 Create a New Audit](#12-create-a-new-audit)
   - [1.3 Generate AI Audit Agenda & Opening Briefing](#13-generate-ai-audit-agenda--opening-briefing)
   - [1.4 AI Pre-Audit Briefing from Supplier Responses](#14-ai-pre-audit-briefing-from-supplier-responses)
3. [Phase 2: Onsite Smart Audit & Walkthrough (The Live Studio)](#3-phase-2-onsite-smart-audit--walkthrough-the-live-studio)
   - [2.1 Starting a Smart Audit Session](#21-starting-a-smart-audit-session)
   - [2.2 Live Transcription & Voice Markers](#22-live-transcription--voice-markers)
   - [2.3 Non-Interruptive Photo Capture](#23-non-interruptive-photo-capture)
   - [2.4 Generating Categorized Smart AI Notes](#24-generating-categorized-smart-ai-notes)
   - [2.5 AI Auditor Question Assistant](#25-ai-auditor-question-assistant)
   - [2.6 Checklist Coverage Awareness Matrix](#26-checklist-coverage-awareness-matrix)
   - [2.7 End-of-Session 13-Point Summary](#27-end-of-session-13-point-summary)
4. [Phase 3: Deep Technical Onsite Tools](#4-phase-3-deep-technical-onsite-tools)
   - [3.1 Document OCR & Material Certificate Analysis](#31-document-ocr--material-certificate-analysis)
   - [3.2 Technical Drawing & GD&T Balloon Analysis](#32-technical-drawing--gdt-balloon-analysis)
   - [3.3 18-Element PPAP Submission Review](#33-18-element-ppap-submission-review)
   - [3.4 Vertical CTF Traceability Chain](#34-vertical-ctf-traceability-chain)
5. [Phase 4: Verification, Findings & 8D CARs](#5-phase-4-verification-findings--8d-cars)
   - [4.1 Auditor Question Verification](#41-auditor-question-verification)
   - [4.2 Logging Findings](#42-logging-findings)
   - [4.3 Managing 8D Corrective Action Requests (CARs)](#43-managing-8d-corrective-action-requests-cars)
6. [Phase 5: Reporting & Qualification Decision](#6-phase-5-reporting--qualification-decision)
   - [5.1 Final Supplier Qualification Decision](#51-final-supplier-qualification-decision)
   - [5.2 Generating Print-Ready Audit Reports](#52-generating-print-ready-audit-reports)
7. [Phase 6: Backup, Restore & Mobile Phone-to-Mac Transfer](#7-phase-6-backup-restore--mobile-phone-to-mac-transfer)
   - [6.1 Exporting ZIP Backups with Photos](#61-exporting-zip-backups-with-photos)
   - [6.2 Restoring from ZIP](#62-restoring-from-zip)
8. [Important Principles & Human-in-the-Loop Rules](#8-important-principles--human-in-the-loop-rules)

---

## 1. Quick Start & Overview

The PQE AI Assistant covers the full supplier quality audit lifecycle:

```
[Import Checklist] ──► [Create Audit] ──► [AI Prep & Agenda]
                                                │
                                                ▼
[8D CAR Closure] ◄── [Findings & Report] ◄── [Smart Audit Live Studio]
                                             (Voice, OCR, Photos, AI Notes)
```

### Core Navigation Bar:
- **Dashboard (`/`)**: High-level overview of audits, open findings, and active progress.
- **Audits (`/audits`)**: List and manage all supplier audits.
- **Checklists (`/checklists`)**: Manage master Excel checklist templates.
- **Suppliers (`/suppliers`)**: Supplier risk dashboard, audit history, and open CAR metrics.
- **Manufacturing (`/manufacturing`)**: Reference library for 10 manufacturing processes (CNC, Stamping, Casting, Injection Moulding, Welding, Plating, etc.).
- **Settings (`/settings`)**: Auditor name preferences, threshold configuration, and ZIP backup/restore.

---

## 2. Phase 1: Pre-Audit Preparation

### 1.1 Import Audit Checklists
1. Navigate to **Checklists** (`/checklists`).
2. Drag and drop your company's Excel audit checklist workbook (`.xlsx` or `.xls`).
3. The parser extracts sections, question numbers, clause references, scoring criteria, and guidance.
4. The original workbook is preserved read-only as a reference blob.

### 1.2 Create a New Audit
1. Navigate to **Audits** (`/audits`) → Click **"+ New Audit"**.
2. Select your imported checklist template.
3. Enter supplier details: **Supplier Name**, **Site Location**, **Lead Auditor**, **Audit Type** (*Qualification, Process, Line, Investigation, or CAR Verification*), **Dates**, and **Scope**.
4. Click **"Create Audit"** to open the **Audit Hub**.

### 1.3 Generate AI Audit Agenda & Opening Briefing
1. On the **Audit Hub** (`/audits/[id]`), scroll to the **"AI Audit Agenda & Opening Notes"** section.
2. *(Optional)* Upload an auditor draft agenda (`.txt` or `.docx`).
3. Click **"Generate Audit Agenda"**.
4. The AI outputs:
   - Day-by-day 08:00–17:00 time-slotted agenda.
   - Opening meeting script and briefing notes.
   - Top 3 risk focus areas based on your audit scope.
   - Pre-arrival document request list.

### 1.4 AI Pre-Audit Briefing from Supplier Responses
1. When the supplier emails back their filled checklist with Y/N/NA answers, scroll to **"✦ AI Pre-Audit Briefing — Supplier Response Review"** on the Audit Hub.
2. Upload the supplier's completed Excel file.
3. The system parses all responses and highlights:
   - 🔴 **High Priority**: Questions answered "N" with suggested probing questions.
   - 🟡 **Medium Priority**: "N/A" items requiring verification.
   - ⚪ **Weak Comments**: "Y" answers with vague or missing supporting notes.
   - 📄 Advance document requests.

---

## 3. Phase 2: Onsite Smart Audit & Walkthrough (The Live Studio)

The **Smart Audit Note Taker** (`/audits/[id]/smart`) is designed for one-handed mobile phone operation during line walkthroughs.

### 2.1 Starting a Smart Audit Session
1. From the Audit Hub, click the prominent dark banner: **"Start Smart Audit"**.
2. Review the mandatory audio recording consent notice.
3. Tap **"I Confirm Consent & Start Smart Audit"**.
4. The recording timer begins and audio is continuously transcribed.

### 2.2 Live Transcription & Voice Markers
- **Live Utterances**: Speak naturally into your device; the live transcript displays real-time speech.
- **Voice Markers**: Say any of the following phrases while speaking to drop instant markers:
  - *"PQE note"*
  - *"Potential finding"*
  - *"Take action"*
  - *"Follow up"*
  - *"Good practice"*
  - *"Need evidence"*
- **1-Tap Quick Markers**: Alternatively, tap any of the coloured marker chips at the top of the screen without typing.

### 2.3 Non-Interruptive Photo Capture
1. Tap **"📷 Add Photo"** on the top recorder bar.
2. Take a photo using your phone camera.
3. Spoken observations are automatically populated into the auditor note.
4. *(Optional)* Tap **"✨ AI Photo Risk Suggestion"** to analyze poka-yoke, orientation, or calibration concerns.
5. Tap **"Save Photo Evidence"** — recording continues without interruption.

### 2.4 Generating Categorized Smart AI Notes
1. Switch to the **"✨ Smart AI Notes"** tab.
2. Tap **"Generate Smart Notes"**.
3. The AI summarizes the live conversation into:
   - **Statements & Context**
   - **Supplier Commitments** (frequencies, pledges, responsibilities)
   - **Process Controls** (torques, fixtures, SPC routines)
   - **Documents Mentioned**
   - **Risks & Discrepancies**
   - **Follow-up Actions**

### 2.5 AI Auditor Question Assistant
- Located directly in the top recorder bar.
- Tap **"Suggest Probing Questions"** at any time.
- The AI provides the top **1–3 prioritized questions**:
  - `CRITICAL QUESTION`: E.g. Missing reaction plan or poka-yoke defect risk.
  - `IMPORTANT QUESTION`: E.g. Calibration frequency or work instruction clarity.
  - `FOLLOW-UP QUESTION`: Clarifications.
- Tap **✕** to dismiss questions you have already asked.

### 2.6 Checklist Coverage Awareness Matrix
1. Tap the **"📋 Checklist Matrix"** tab.
2. Tap **"Check Discussion Against Checklist"**.
3. The AI compares your live discussion against the checklist requirements and flags:
   - `COVERED`: Verified in conversation.
   - `PARTIALLY_COVERED`: Mentioned, but needs deeper investigation.
   - `NOT_COVERED`: Not yet discussed.
   - `OBJECTIVE_EVIDENCE_REQUIRED`: Discussed, but physical logs or records must be reviewed.

### 2.7 End-of-Session 13-Point Summary
1. When wrapping up your meeting or line walk, tap **"⏹ Stop"** on the recorder.
2. Switch to the **"📄 End Session Summary"** tab.
3. Tap **"Generate 13-Point Summary"**.
4. The AI produces a comprehensive draft containing:
   - *Topics Discussed, Processes Observed, Documents Reviewed, Objective Evidence, Photos, Potential Findings, Observations, Good Practices, Commitments, Open Questions, Missing Evidence, Action Items with Owners, and Closing Meeting Discussion Points.*

---

## 4. Phase 3: Deep Technical Onsite Tools

Accessible directly from the **Audit Hub** under *Onsite AI Tools*:

### 3.1 Document OCR & Material Certificate Analysis (`/audits/[id]/ocr`)
- Photograph supplier material certificates, CoCs, calibration records, or First Article Inspections (FAI).
- AI extracts chemical compositions, mechanical properties, expiry dates, and flags out-of-spec or missing data.

### 3.2 Technical Drawing & GD&T Balloon Analysis (`/audits/[id]/drawing`)
- Photograph a 2D engineering drawing.
- Select your manufacturing process (e.g. CNC Machining, Stamping, Plastic Injection).
- AI identifies Critical-to-Function (CTF) characteristics, GD&T callouts, and specifies what inspection equipment (CMM, height gauge) must be checked.

### 3.3 18-Element PPAP Submission Review (`/audits/[id]/ppap`)
- Review all 18 AIAG/VDA PPAP elements.
- Upload multi-tab PPAP workbooks (supports English, Traditional Chinese, and Simplified Chinese).
- AI verifies PSW signatures, Cpk capability metrics (flags Cpk < 1.67 for CTFs), and dimensional results.

### 3.4 Vertical CTF Traceability Chain (`/audits/[id]/trace`)
- Verify the end-to-end traceability of critical dimensions across 6 levels:
  `Drawing Callout ➔ PFMEA ➔ Control Plan ➔ Work Instruction ➔ Measurement System (MSA) ➔ Inspection Log`

---

## 5. Phase 4: Verification, Findings & 8D CARs

### 5.1 Auditor Question Verification (`/audits/[id]/verify`)
- Go question by question through the checklist.
- Set verdicts: `CONFORMS`, `MINOR_NC`, `MAJOR_NC`, `NOT_VERIFIABLE`, `NOT_APPLICABLE`.
- Score items according to scoring basis.
- Check the **"Auditor Approved"** box to confirm completion.

### 5.2 Logging Findings (`/findings?auditId=[id]`)
- Raise findings classified as: `MAJOR`, `MINOR`, `OBSERVATION`, or `OFI` (Opportunity for Improvement).
- Tap **"Suggest Finding Text"** to let AI draft a factual finding statement from your notes.
- Attach photo, OCR, and transcript evidence.
- Click **"Approve Finding"** (Human auditor approval required).

### 5.3 Managing 8D Corrective Action Requests (CARs) (`/cars?auditId=[id]`)
- Create CARs directly linked to major and minor findings.
- Step through 8D phases:
  1. **Containment Action** (Immediate isolation)
  2. **Root Cause Analysis** (5-Why / Fishbone)
  3. **Corrective Action** (Permanent preventive fix)
  4. **Effectiveness Verification** (Auditor evidence review)
- Final step: Auditor clicks **"Verify and Close CAR"** with sign-off.

---

## 6. Phase 5: Reporting & Qualification Decision

### 6.1 Final Supplier Qualification Decision (`/audits/[id]/qualification`)
- Formal sign-off on supplier status:
  - 🟢 **APPROVE**: Supplier meets all quality and process standards.
  - 🟡 **CONDITIONAL**: Approval subject to verified CAR closure within 30–90 days.
  - 🔴 **REJECT**: Critical failure modes or systemic non-compliances.
- **Strict Invariant**: AI cannot approve or change supplier qualification. The lead auditor must sign off with their name and date.

### 6.2 Generating Print-Ready Audit Reports (`/audits/[id]/report`)
- Generates a formatted executive audit report.
- Includes audit scores, finding breakdown, photo evidence summary, qualification decision, and signature blocks.
- Click **"Print / Save PDF"** to trigger the browser's native print engine and save as PDF.

---

## 7. Phase 6: Backup, Restore & Mobile Phone-to-Mac Transfer

All audit data and photographs are stored securely in your browser's local storage (IndexedDB).

### 7.1 Exporting ZIP Backups with Photos
1. Navigate to **Settings** (`/settings`) or the **Audit Hub**.
2. Click **"Export with Photos (.zip)"**.
3. A single `.zip` file is downloaded containing:
   - `audit-data.json`: All structured audits, checklists, responses, findings, and CARs.
   - `blobs/`: All full-resolution photos, drawings, and documents.
4. **Phone ➔ Mac Workflow**: AirDrop, iCloud Drive, or email the `.zip` file from your mobile device to your desktop.

### 7.2 Restoring from ZIP
1. On your Mac/PC browser, go to **Settings** (`/settings`).
2. Click **"Import from ZIP"** and select the `.zip` file.
3. All audit data, transcripts, notes, and photos are restored.

---

## 8. Important Principles & Human-in-the-Loop Rules

To ensure strict engineering integrity, the application enforces the following rules:

1. **AI is strictly advisory**: AI generates suggestions, notes, questions, and drafts. It never makes quality decisions on its own.
2. **Explicit Human Approvals**:
   - Only human auditors can check `isApproved` on checklist items.
   - Only human auditors can approve a `Finding`.
   - Only human auditors can close a `CAR`.
   - Only human auditors can issue a `Qualification Decision`.
3. **Privacy & Security**: OpenAI API keys are kept strictly server-side. No API keys or credentials are ever exposed to client browsers.
4. **Data Safety**: Export `.zip` backups regularly at the end of each audit day.

---

*PQE AI Assistant — Built for Procurement & Supplier Quality Engineers.*
