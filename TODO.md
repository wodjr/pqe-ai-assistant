# TODO.md — PQE AI Assistant

## Status: v0.5.0 — Smart Audit Note Taker (Live Plaud-Style Recorder)

---

## ✅ Phase 1: Project Setup — COMPLETE

- [x] Next.js 15.5.24 scaffold with TypeScript strict, Tailwind CSS v3, ESLint
- [x] `.env.example` created with OPENAI_API_KEY placeholder
- [x] `.gitignore` created (includes `.env.local`, `.next/`, `node_modules/`)
- [x] `npm run dev` starts without errors
- [x] `npm run build` passes clean

---

## ✅ Phase 2: Core Build — COMPLETE

- [x] All domain types — `types/project.ts` (12 interfaces, 9 enums)
- [x] IndexedDB storage layer — `lib/storage/db.ts` (9 stores, full CRUD, cascade delete, factory reset)
- [x] localStorage helpers — `lib/storage/localStorage.ts`
- [x] Secure ID generator — `lib/utils/nanoid.ts`
- [x] Format utilities — `lib/utils/format.ts`
- [x] ExcelJS importer — `lib/parseExcel.ts`
- [x] Print-ready HTML report generator — `lib/generateReport.ts`
- [x] JSON export/import backup — `lib/exportBackup.ts`
- [x] App shell — `app/layout.tsx`, `app/globals.css`
- [x] All 9 shared UI components (NavBar, PrototypeBanner, StatusBadge, EvidenceUpload, PageHeader, Card, EmptyState, LoadingSpinner, AISuggestionBox)
- [x] All 13 pages: Dashboard, Checklists, Checklist detail, Audits, New Audit, Audit Hub, Supplier Assessment, Auditor Verification, Findings, CARs, Report, Settings

---

## ✅ Phase 2 AI: OpenAI Integration — COMPLETE

- [x] Secure server-side route — `app/api/ai/suggest/route.ts` (gpt-4o-mini, key never sent to browser)
- [x] Client fetch wrapper — `lib/aiSuggest.ts`
- [x] Reusable AI display component — `components/AISuggestionBox.tsx`
- [x] AI Audit Prep panel on Audit Hub page
- [x] AI Verification Guidance per question on Auditor Verification page
- [x] AI Finding Suggestion on Findings form
- [x] Git commit `b063c68`

---

## ✅ Phase 3: Extended Features — COMPLETE

- [x] Daily audit summary AI generation (Audit Hub)
- [x] AI Audit Agenda + Opening Notes generation (Audit Hub)
- [x] Supplier risk dashboard (`/suppliers`)
- [x] Voice recording + Whisper transcription (`/audits/[id]/voice`)
- [x] OCR document analysis — photo → GPT-4o vision (`/audits/[id]/ocr`)
- [x] Technical drawing analysis — balloon CTF identification (`/audits/[id]/drawing`)
- [x] Audit history per supplier (Supplier risk dashboard — expand card)
- [x] Multilingual supplier self-assessment form (language toggle on `/audits/[id]/supplier`)
- [x] Offline mode — Service Worker (`public/sw.js`) + registration in `app/layout.tsx`
- [x] PPAP evidence review (`/audits/[id]/ppap`)
- [x] Vertical evidence trace — CTF traceability chain (`/audits/[id]/trace`)
- [x] Supplier qualification decision (`/audits/[id]/qualification`)
- [x] Manufacturing knowledge modules (`/manufacturing`)

---

## ✅ Phase 4: Quality & Polish — COMPLETE

- [x] Mobile layout pass at ≤480px — grid stacking, badge scaling, title shrink
- [x] Accessibility — visible focus rings, aria-labels on icon buttons and selects, breadcrumb nav, skip-link
- [x] NavBar updated with all Phase 3 pages (Suppliers, Manufacturing)
- [x] `npm run build` clean pass — zero errors, zero warnings
- [x] Footer updated to v0.3.0

---

## ✅ Phase 5: Mobile Field Use — COMPLETE

- [x] ZIP export with photos — `exportAuditToZip()` bundles audit JSON + all photo/document blobs into a single `.zip` for phone → Mac transfer (AirDrop / iCloud / USB)
- [x] ZIP import with photos — `importAuditFromZip()` restores all structured data + blobs back to IndexedDB on the Mac browser
- [x] Settings page — "Export with Photos (.zip)" and "Import from ZIP" cards added (highlighted as recommended)
- [x] Draft agenda upload on Audit Hub — auditor can upload `.txt` or `.docx` draft agenda before audit
- [x] AI agenda refinement mode — when a draft is uploaded, AI refines it (time-slots every section, flags gaps, adds opening/closing meetings); without a draft, AI generates from scratch
- [x] `jszip` 3.10.1 added as dependency

---

## ✅ Phase 6: Smart Audit Note Taker (v0.5.0) — COMPLETE

- [x] **v0.5A: Plaud-style recording & live notes studio** (`/audits/[id]/smart`)
  - Live recording with Pause/Resume/Stop controls, timer, and persistent state in IndexedDB (`smartSessions` store)
  - Continuous speech transcription stream using Web Speech API + Whisper
  - Non-interruptive shop floor photo capture with AI risk analysis and evidence linking
  - Quick Voice Markers (auto-detection of "PQE note", "Potential finding", "Take action", etc. + 1-tap quick buttons)
  - Categorized Smart AI Notes (Statements, Commitments, Process Controls, Documents Mentioned, Risks, Actions)
- [x] **v0.5B: Real-time prioritized auditor question assistant**
  - AI quietly listens and generates the top 1–3 probing questions (CRITICAL, IMPORTANT, FOLLOW-UP) with rationale and suggested actions
  - Individual question dismiss and auto-update
- [x] **v0.5C: Checklist awareness & end-of-session smart summary**
  - Checklist Coverage Awareness Matrix (COVERED, PARTIALLY_COVERED, NOT_COVERED, OBJECTIVE_EVIDENCE_REQUIRED)
  - 13-point structured draft Session Summary with closing meeting recommendations
  - Full human-in-the-loop invariant preserved (AI never auto-approves checklist or findings)
- [x] Audit Hub integration with hero banner and "Start Smart Audit" CTA
- [x] Full backup/restore support in ZIP/JSON (`lib/exportBackup.ts`)

---

## 🔄 Phase 7: Deployment

- [ ] Deploy to Vercel (`vercel.json` already present)
- [ ] Set `OPENAI_API_KEY` environment variable in Vercel dashboard
- [ ] Test production URL on mobile and desktop

---

## Deferred (Post-MVP)

- [ ] User authentication (SAML / OpenID Connect)
- [ ] Server-side database (replace IndexedDB)
- [ ] Real-time collaboration
- [ ] Dark mode
- [ ] Payment / subscription features
