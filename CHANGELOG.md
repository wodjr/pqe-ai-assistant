# CHANGELOG.md — PQE AI Assistant

All notable changes to this project are documented here.

---

## [0.3.0] — Phase 3 + Phase 4 Polish — 2025

### Added
- **Daily audit summary** AI generation on Audit Hub — end-of-day narrative from live audit stats
- **AI Audit Agenda & Opening Notes** — day-by-day agenda, risk focus, pre-arrival document requests
- **Supplier Risk Dashboard** (`/suppliers`) — aggregated risk profile, finding counts, open CARs,
  overdue CARs, and expandable audit history per supplier
- **Voice Recording + Whisper Transcription** (`/audits/[id]/voice`)
  - MediaRecorder API with explicit consent gate
  - Secure server-side Whisper route (`/api/ai/transcribe`)
  - Transcripts saved as `TRANSCRIPT` evidence in IndexedDB
- **OCR Document Analysis** (`/audits/[id]/ocr`)
  - Camera capture or file upload (≤10 MB)
  - GPT-4o vision analysis via secure server route
  - Document types: Material Certificate, CoC, FAI, Dimensional Report, Calibration Record, etc.
- **Technical Drawing Analysis** (`/audits/[id]/drawing`)
  - GPT-4o vision identifies CTF characteristics, GD&T callouts, and required evidence
  - Process-type context (CNC, Casting, Stamping, Welding, …)
- **PPAP Evidence Review** (`/audits/[id]/ppap`) — 18 PPAP elements, per-element status + evidence
- **Vertical Evidence Trace** (`/audits/[id]/trace`) — CTF chain: Drawing → PFMEA → Control Plan
  → Work Instruction → Measurement System → Inspection Result
- **Supplier Qualification Decision** (`/audits/[id]/qualification`) — formal APPROVE /
  CONDITIONAL / REJECT with required auditor sign-off; AI cannot make or change this decision
- **Manufacturing Knowledge Modules** (`/manufacturing`) — CNC, Stamping, Casting, Injection
  Moulding, Welding, Plating, Painting, Heat Treatment, Assembly, Testing reference guides
- **Multilingual supplier self-assessment** — EN / ES / DE / FR / ZH language toggle
- **Offline Service Worker** (`public/sw.js`) — app-shell cache-first strategy; API routes
  always network-first; registered in `app/layout.tsx`

### Phase 4 Quality & Polish
- Mobile layout: `@media (max-width: 480px)` breakpoint stacks 2/3/4-column grids to single
  column; stats strips use 2-column override class; badge and title scaling
- Accessibility: `aria-label` added to icon-only buttons (date remove, dismiss banner, evidence
  remove) and unlabelled `<select>` elements; breadcrumb `<nav aria-label="Breadcrumb">`;
  skip-link; visible focus rings on all interactive elements; `button:disabled` opacity
- Footer version bumped to `v0.3.0`
- `npm run build` passes clean — zero TypeScript errors, zero ESLint warnings

---


## [0.2.0] — Phase 2 AI — 2025-01-31 (commit `b063c68`)

### Added
- `app/api/ai/suggest/route.ts` — secure server-side OpenAI GPT-4o-mini route
  - Modes: `audit_prep`, `verification`, `finding`
  - API key never sent to browser; all inputs sanitised and truncated
  - Returns `503` with a clear message when key is not configured
- `lib/aiSuggest.ts` — client-side fetch wrapper for the AI route
- `components/AISuggestionBox.tsx` — reusable AI display component with mandatory
  "AI SUGGESTION — NOT AUDITOR APPROVED" label and expandable disclaimer
- AI Audit Preparation panel on Audit Hub page (`app/audits/[id]/page.tsx`)
- AI Verification Guidance per checklist question on Auditor Verification page
- AI Finding Suggestion on the New Finding form
- `.env.example` updated with `OPENAI_API_KEY` placeholder and documentation

### Security
- AI suggestions can never write to `isApproved`, `isAuditorApproved`, or
  `isAuditorVerifiedClosed` — these fields require explicit auditor action only

---

## [0.1.0] — Phase 1 + 2 Core Build — 2025-01-31 (commit `285afdd`)

### Added
- **Project scaffold** — Next.js 15.5.24, TypeScript strict, Tailwind CSS v3,
  ESLint, PostCSS
- **Domain types** — `types/project.ts`: 12 interfaces, 9 enums covering the
  full audit lifecycle (audit, checklist, supplier response, verification,
  evidence, finding, CAR, report)
- **IndexedDB storage** — `lib/storage/db.ts`: 9 object stores with indexes,
  full CRUD, cascade delete, and factory reset
- **localStorage helpers** — auditor name and current audit ID preferences
- **Secure ID generator** — `lib/utils/nanoid.ts` using `crypto.getRandomValues`
- **Format utilities** — `lib/utils/format.ts` — date, datetime, score formatters
- **Excel importer** — `lib/parseExcel.ts` using ExcelJS 4.4.0 (named imports)
  — original workbook preserved read-only as blob in IndexedDB
- **Print-ready report** — `lib/generateReport.ts` — generates HTML that opens
  in a new tab for browser Print → Save as PDF (no PDF library required)
- **JSON backup** — `lib/exportBackup.ts` — full audit export/import
- **App shell** — `app/layout.tsx` with NavBar and PrototypeBanner;
  `app/globals.css` with `btn-secondary`, `badge`, `ai-suggestion-block` utilities
- **UI components** — NavBar, PrototypeBanner, StatusBadge, EvidenceUpload,
  PageHeader, Card, EmptyState, LoadingSpinner
- **Pages** (13 total):
  - Dashboard — audit list, stats, quick-nav for active audit
  - Checklists — import Excel workbook, list templates
  - Checklist detail — view sections and questions
  - Audits list — sortable audit table
  - New Audit — form with audit type, dates, supplier, scope, team
  - Audit Hub — status, stats, AI prep panel, status workflow, export
  - Supplier Assessment — per-question self-assessment form with evidence upload
  - Auditor Verification — per-question verdict, score, notes, evidence, approval
  - Findings Log — create, classify, approve, delete findings; link to CARs
  - CARs — full 8D workflow (containment, root cause, corrective action,
    effectiveness, auditor verified closure)
  - Report — print-ready audit summary with qualification recommendation
  - Settings — auditor name, export backup, restore, factory reset
- **Git setup** — `.gitignore`, `README.md` with full setup guide, first commit

### Fixed
- ExcelJS must use named imports (`import { Workbook } from "exceljs"`) — default
  import crashes at runtime in Next.js
- `exceljs` removed from `serverExternalPackages` — it runs client-side
- `btn-secondary` CSS class was missing — caused invisible links on dashboard
- Pages using `useSearchParams()` wrapped in `<Suspense>` for Next.js 15 static
  generation compatibility
- PrototypeBanner z-index set to appear above content

---

_Project started: 2025-01-31_
