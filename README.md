# PQE AI Assistant — v0.4.0

A secure, AI-assisted web and mobile application that supports Procurement Quality Engineers throughout the complete supplier qualification and onsite audit process.

## What it does

Covers the full audit lifecycle in one connected workflow:

**Import checklist → Create audit → Supplier self-assessment → AI pre-audit briefing → Auditor onsite verification → Photo evidence capture → OCR document analysis → Drawing CTF analysis → Voice recording → Record findings → Issue CARs → Generate report → Supplier qualification → Track corrective actions → Auditor closure**

---

## Key capabilities

### Pre-audit
- Import existing Excel audit checklists (ExcelJS — original workbook preserved read-only)
- Risk-based AI audit preparation plan — focus areas, documents to request, opening questions
- Upload draft agenda (`.txt` / `.docx`) and let AI refine it into a polished day-by-day schedule with time slots
- AI review of supplier-completed self-assessment Excel — flags every N, N/A, unanswered and highlighted row with prioritised onsite questions

### Onsite
- Supplier self-assessment form with multilingual support (EN / ES / DE / FR / ZH)
- Auditor verification panel — independent verdict and approval per question; always explicit human action
- 📷 Mobile photo capture — take photos directly from phone camera; stored locally in IndexedDB
- OCR document analysis — photograph material certificates, CoC, FAI, calibration records; AI extracts and flags concerns
- Technical drawing analysis — GPT-4o identifies CTF characteristics, GD&T callouts, balloon references
- Voice recording and Whisper transcription with explicit consent gate; transcripts saved as evidence
- PPAP evidence review — all 18 PPAP elements with per-element status and evidence links
- Vertical CTF evidence trace — Drawing → PFMEA → Control Plan → Work Instruction → Measurement System → Inspection Result
- Real-time AI verification guidance per checklist question
- AI daily end-of-day summary generation

### Post-audit
- Findings log — Major / Minor / Observation / OFI classification; AI suggested finding text; explicit auditor approval required
- 8D Corrective Action Request workflow — containment, root cause, corrective action, effectiveness verification, auditor-verified closure
- Professional print-ready HTML audit report (browser Print → Save as PDF)
- Supplier qualification decision — APPROVE / CONDITIONAL / REJECT with mandatory human approval; AI cannot set this
- Supplier risk dashboard — aggregated findings, open CARs, overdue CARs, audit history per supplier

### Mobile & offline
- Works fully offline via Service Worker (app-shell cache-first strategy)
- All data stored in browser IndexedDB — survives offline, no server required for prototype
- **ZIP export with photos** — exports all audit data + every photo/document blob into one `.zip`; transfer to Mac via AirDrop, iCloud Drive, or USB
- **ZIP import with photos** — restores the full audit including all blobs on any device browser
- JSON-only export/import also available (metadata only, no blobs)

### Reference
- Manufacturing knowledge modules — CNC, Stamping, Casting, Injection Moulding, Welding, Plating, Painting, Heat Treatment, Assembly, Testing

---

> ⚠️ **PROTOTYPE STORAGE** — All data is stored in the browser only (IndexedDB). Not encrypted at rest. Not a production quality record. Export ZIP backups regularly. Do not store actual confidential production data until a secure server-backed version is deployed.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15.5.24 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v3 |
| Storage | IndexedDB via `idb` 8.0.2 |
| Excel parsing | ExcelJS 4.4.0 |
| ZIP packaging | JSZip 3.10.1 |
| AI — text | OpenAI GPT-4o-mini (server-side only) |
| AI — vision | OpenAI GPT-4o (server-side only) |
| AI — voice | OpenAI Whisper (server-side only) |
| Offline | Service Worker (`public/sw.js`) |
| Deployment | Vercel |

---

## Local setup

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher

### Steps

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd pqe-ai-assistant

# 2. Install dependencies
npm install

# 3. Copy environment file and add your OpenAI key
cp .env.example .env.local
# edit .env.local and set OPENAI_API_KEY=sk-...

# 4. Start development server
npm run dev
```

Open **http://localhost:3000** in your browser.

### Other commands

```bash
npm run build      # Production build (must pass before deploying)
npm run start      # Serve production build locally
npm run lint       # ESLint check
npm run typecheck  # TypeScript check (no emit)
```

---

## Project structure

```
app/
  page.tsx                        # Dashboard
  layout.tsx                      # Root layout + NavBar + PrototypeBanner + SW registration
  globals.css                     # Global styles + utility classes
  api/
    ai/suggest/route.ts           # Secure server-side OpenAI route (text + vision modes)
    ai/transcribe/route.ts        # Secure server-side Whisper transcription route
  audits/
    page.tsx                      # All audits list
    new/page.tsx                  # Create audit
    [id]/page.tsx                 # Audit Hub — AI prep, agenda, daily summary, supplier review
    [id]/supplier/page.tsx        # Supplier self-assessment (multilingual)
    [id]/verify/page.tsx          # Auditor onsite verification with AI guidance
    [id]/voice/page.tsx           # Voice recording + Whisper transcription
    [id]/ocr/page.tsx             # Photo OCR document analysis
    [id]/drawing/page.tsx         # Technical drawing CTF analysis
    [id]/ppap/page.tsx            # 18-element PPAP evidence review
    [id]/trace/page.tsx           # CTF vertical evidence traceability chain
    [id]/qualification/page.tsx   # Supplier qualification decision (human approval required)
    [id]/report/page.tsx          # Print-ready audit report
  checklists/
    page.tsx                      # Import Excel checklist templates
    [id]/page.tsx                 # View checklist sections and questions
  findings/page.tsx               # Findings log
  cars/page.tsx                   # Corrective Action Requests — 8D workflow
  suppliers/page.tsx              # Supplier risk dashboard
  manufacturing/page.tsx          # Manufacturing knowledge modules
  settings/page.tsx               # Export ZIP/JSON, import, factory reset

components/
  NavBar.tsx                      # Mobile-first navigation
  PrototypeBanner.tsx             # Prototype warning banner
  AISuggestionBox.tsx             # Reusable AI display with mandatory labelling
  StatusBadge.tsx                 # Coloured status pill
  EvidenceUpload.tsx              # Photo/file capture + IndexedDB storage
  PageHeader.tsx                  # Page title + breadcrumbs + action slot
  Card.tsx                        # Content card wrapper
  EmptyState.tsx                  # Zero-state placeholder
  LoadingSpinner.tsx              # Full-page and inline spinner

lib/
  aiSuggest.ts                    # Client fetch wrapper for /api/ai/suggest
  parseExcel.ts                   # ExcelJS checklist importer
  parseSupplierExcel.ts           # Supplier-completed Excel parser
  generateReport.ts               # Print-ready HTML report generator
  exportBackup.ts                 # JSON + ZIP export/import (with photo blobs)
  storage/
    db.ts                         # IndexedDB layer — 9 stores, full CRUD
    localStorage.ts               # Auditor name + current audit ID only
  utils/
    nanoid.ts                     # Cryptographically secure IDs
    format.ts                     # Date / score / class formatting

types/project.ts                  # All shared TypeScript domain types
public/sw.js                      # Service Worker — offline app-shell cache
```

---

## Workflow

1. **Checklists** — Upload an `.xlsx` audit questionnaire. Original file preserved read-only.
2. **New Audit** — Select checklist, fill in supplier info, dates, auditor and team.
3. **Audit Hub** — Upload draft agenda → AI refines it with time slots and gaps flagged. Upload supplier-completed Excel → AI pre-audit briefing. Generate AI audit prep plan.
4. **Supplier Assessment** — Record supplier responses, status and evidence per question. Supports EN / ES / DE / FR / ZH.
5. **Auditor Verification** — Set independent verdict per question, attach photos, request AI guidance, tick approval checkbox.
6. **Onsite AI Tools** — Voice recording, OCR, drawing analysis, PPAP review, evidence traceability chain.
7. **Findings** — Record and classify findings. Approve each finding explicitly — AI suggestion is display only.
8. **CARs** — Fill 8D fields, advance status, attach effectiveness evidence, auditor-verified closure.
9. **Report** — Select qualification recommendation, write conclusion, generate print-ready report, approve.
10. **Settings** — Export ZIP (with all photos) → AirDrop to Mac → Import ZIP to restore. Or JSON-only backup. Factory reset.

---

## Human approval controls

The following actions **always require explicit auditor action** and can never be triggered automatically by AI:

| Action | Control |
|---|---|
| Approve a verification item | Checkbox on each question |
| Approve a finding | "Approve Finding" button |
| Close a CAR | "Auditor Verified Closed" button + confirmation dialog |
| Approve the final report | "Approve Report" button + confirmation dialog |
| Qualify a supplier | Report recommendation + auditor approval |

All AI suggestions are labelled `⚠ AI SUGGESTION — NOT AUDITOR APPROVED` and have zero effect on any approval field.

---

## Deployment (Vercel)

1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo.
3. In Vercel **Settings → Environment Variables**, add:
   - `OPENAI_API_KEY` = your OpenAI API key (required for all AI features)
4. Click **Deploy**.
5. Test the production URL on both mobile (375px) and desktop.

> Without `OPENAI_API_KEY` the app still works fully — all non-AI features operate normally. AI panels show a clear "not configured" message.

---

## Security notes

- `OPENAI_API_KEY` is stored in `.env.local` only — gitignored, never sent to the browser.
- All AI calls go through server-side Next.js route handlers — the key is never exposed client-side.
- All inputs to AI are sanitised and truncated before prompt construction.
- Evidence blobs are stored in IndexedDB only — nothing sensitive goes into localStorage.
- The application binds to localhost only during development.
- Container images (if added later) must use `registry.redhat.io` base images with a non-root user.

---

## Licence

MIT
