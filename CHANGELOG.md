# CHANGELOG.md — PQE AI Assistant

All notable changes to this project are documented here.

---

## [Unreleased] — Phase 3 Features

### In Progress
- Daily audit summary AI generation
- Supplier risk dashboard (`/suppliers`)
- Voice recording + OpenAI Whisper transcription
- OCR document analysis (photo → GPT-4o vision)
- Technical drawing CTF analysis
- Multilingual supplier self-assessment toggle
- Offline Service Worker

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
