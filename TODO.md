# TODO.md — PQE AI Assistant

## Status: Phase 4 Quality Polish Complete — Ready for Deployment

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

## 🔄 Phase 5: Deployment

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
