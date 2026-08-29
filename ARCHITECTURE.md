# ARCHITECTURE.md — PQE AI Assistant

## Technology Stack

| Layer          | Choice                                   |
|----------------|------------------------------------------|
| Framework      | Next.js 15.5.24 (App Router)             |
| Language       | TypeScript (strict)                      |
| Styling        | Tailwind CSS v3                          |
| State          | React useState / useCallback             |
| Storage        | IndexedDB via `idb` 8.0.2 (prototype)   |
| File parsing   | ExcelJS 4.4.0 (named imports, client)   |
| AI             | OpenAI GPT-4o-mini (server-side only)   |
| Deployment     | Vercel                                   |
| Database       | None (MVP — IndexedDB only)              |
| Authentication | None (MVP)                               |

---

## Folder Structure

```
/
├── app/
│   ├── layout.tsx                  # Root layout + NavBar + PrototypeBanner
│   ├── page.tsx                    # Dashboard
│   ├── globals.css                 # Global styles + utility classes
│   ├── api/
│   │   └── ai/suggest/route.ts     # Secure server-side OpenAI route
│   ├── audits/
│   │   ├── page.tsx                # Audits list
│   │   ├── new/page.tsx            # Create audit form
│   │   └── [id]/
│   │       ├── page.tsx            # Audit Hub (AI prep panel)
│   │       ├── supplier/page.tsx   # Supplier self-assessment
│   │       ├── verify/page.tsx     # Auditor onsite verification (AI guidance)
│   │       ├── voice/page.tsx      # Voice recording + Whisper transcription
│   │       ├── ocr/page.tsx        # Photo OCR document analysis
│   │       ├── drawing/page.tsx    # Technical drawing CTF analysis
│   │       └── report/page.tsx     # Print-ready audit report
│   ├── checklists/
│   │   ├── page.tsx                # Checklist templates list
│   │   └── [id]/page.tsx           # Checklist detail view
│   ├── findings/page.tsx           # Findings log (AI finding suggestion)
│   ├── cars/page.tsx               # CAR 8D workflow
│   ├── suppliers/page.tsx          # Supplier risk dashboard
│   └── settings/page.tsx          # Export, restore, factory reset
│
├── components/
│   ├── NavBar.tsx                  # Mobile-first navigation
│   ├── PrototypeBanner.tsx         # Prototype warning banner
│   ├── AISuggestionBox.tsx         # Reusable AI display (mandatory labelling)
│   ├── StatusBadge.tsx             # Coloured status pill
│   ├── EvidenceUpload.tsx          # Photo/file capture + IndexedDB storage
│   ├── PageHeader.tsx              # Page title + breadcrumbs + action slot
│   ├── Card.tsx                    # Content card wrapper
│   ├── EmptyState.tsx              # Zero-state placeholder
│   └── LoadingSpinner.tsx          # Full-page and inline spinner
│
├── lib/
│   ├── aiSuggest.ts                # Client fetch wrapper for /api/ai/suggest
│   ├── parseExcel.ts               # ExcelJS checklist importer
│   ├── generateReport.ts           # Print-ready HTML report generator
│   ├── exportBackup.ts             # JSON backup export/import
│   ├── storage/
│   │   ├── db.ts                   # IndexedDB layer (idb) — 9 stores
│   │   └── localStorage.ts         # Auditor name + current audit ID
│   └── utils/
│       ├── nanoid.ts               # Secure random IDs + reference generators
│       └── format.ts               # Date/time formatters
│
├── types/
│   └── project.ts                  # All domain types (12 interfaces, 9 enums)
│
└── public/
    └── sw.js                       # Service Worker for offline support
```

---

## Data Flow

```
User action
    │
    ▼
React page (useState, useCallback)
    │
    ├──► IndexedDB (lib/storage/db.ts)          ← all audit data stored here
    │         └── idb library (client-side)
    │
    ├──► /api/ai/suggest (server route)         ← AI calls only, never from browser
    │         └── OpenAI GPT-4o-mini
    │                   └── OPENAI_API_KEY (env, server-side only)
    │
    └──► Print window / new tab                 ← report generation (no PDF lib)
```

---

## AI Architecture — Security Controls

| Control | Implementation |
|---|---|
| API key never in browser | Route is `app/api/ai/suggest/route.ts` — server only |
| Input sanitisation | All context fields truncated before prompt build |
| Output labelling | Every response includes `label` and `disclaimer` |
| No auto-approval | AI suggestions are display-only — approval fields require explicit user action |
| Key missing → graceful | Returns `503` with a clear user-facing message |

---

## Human-Approval Controls (Invariant — Never Bypassed)

The following fields can **only** be set by an explicit user checkbox or confirmation dialog. No code path, including AI suggestions, may auto-set them:

| Field | Location |
|---|---|
| `AuditorVerification.isApproved` | Verify page — explicit checkbox |
| `Finding.isAuditorApproved` | Findings page — explicit button |
| `CAR.isAuditorVerifiedClosed` | CARs page — explicit confirm dialog |
| `AuditReport.isAuditorApproved` | Report page — explicit button |

---

## IndexedDB Stores

| Store | Key | Indexes |
|---|---|---|
| `checklists` | `id` | — |
| `audits` | `id` | `by_status` |
| `supplierResponses` | `id` | `by_audit`, `by_question` |
| `verifications` | `id` | `by_audit`, `by_question` |
| `evidence` | `id` | `by_audit` |
| `findings` | `id` | `by_audit` |
| `cars` | `id` | `by_audit`, `by_finding` |
| `reports` | `id` | `by_audit` |
| `blobs` | `blobKey` | — |

---

## State Management

- Local React state (`useState`) for all UI interactions.
- No global state library — not needed for MVP.
- `localStorage` for two preferences only: `pqe_auditor_name`, `pqe_current_audit_id`.
- IndexedDB for all persistent audit data and file blobs.

---

## Security

- API key stored in `.env.local` only — gitignored.
- No secrets in browser-side code.
- Evidence blobs stored in IndexedDB `blobs` store, not localStorage.
- All user inputs sanitised and truncated before sending to AI.
- TLS provided by Vercel (HTTPS enforced).
- `.env.example` committed with placeholder values only.

---

## Offline Strategy

- `public/sw.js` Service Worker caches app shell and static assets.
- App data (IndexedDB) is always available offline — no sync required for local prototype.
- On reconnect, a future server-backed implementation can sync via background sync API.
