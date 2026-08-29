# PQE AI Assistant

A secure, AI-assisted web and mobile application that supports Procurement Quality Engineers throughout the complete supplier qualification and onsite audit process.

## What it does

Covers the full audit lifecycle in one working workflow:

**Import checklist → Create audit → Supplier self-assessment → Auditor onsite verification → Attach evidence → Record finding → Issue CAR → Generate audit report → Track corrective action → Auditor closure**

Key capabilities:
- Import existing Excel audit checklists (ExcelJS — original workbook preserved read-only)
- Supplier self-assessment form with evidence upload
- Auditor verification panel — verdict and approval are always explicit human actions
- AI suggestions are clearly labelled and never auto-applied
- Findings log with Major / Minor / Observation / OFI classification
- 8D Corrective Action Request workflow through to auditor-verified closure
- Professional print-ready HTML audit report (browser Print → Save as PDF)
- Export / import JSON backup and factory reset
- All data stored in browser IndexedDB — no server, no login required for MVP

> ⚠️ **PROTOTYPE STORAGE** — Data is stored in the browser only (IndexedDB). Not encrypted at rest. Not a production quality record. Export backups regularly. Do not store actual confidential production data until a secure server-backed version is deployed.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v3 |
| Storage | IndexedDB via `idb` |
| Excel parsing | ExcelJS |
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

# 3. Copy environment file (no real values needed for MVP)
cp .env.example .env.local

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
app/                          # Next.js App Router pages
  page.tsx                    # Dashboard
  audits/
    page.tsx                  # All audits list
    new/page.tsx              # Create audit
    [id]/page.tsx             # Audit hub
    [id]/supplier/page.tsx    # Supplier self-assessment
    [id]/verify/page.tsx      # Auditor onsite verification
    [id]/report/page.tsx      # Generate & approve report
  checklists/
    page.tsx                  # Import Excel checklist
    [id]/page.tsx             # View checklist
  findings/page.tsx           # Findings log
  cars/page.tsx               # Corrective Action Requests
  settings/page.tsx           # Export / backup / reset

components/                   # Reusable UI components
  NavBar.tsx
  PrototypeBanner.tsx
  StatusBadge.tsx
  EvidenceUpload.tsx
  PageHeader.tsx
  Card.tsx
  EmptyState.tsx
  LoadingSpinner.tsx

lib/
  parseExcel.ts               # ExcelJS workbook importer
  generateReport.ts           # Print-ready HTML report generator
  exportBackup.ts             # JSON export / import
  storage/
    db.ts                     # IndexedDB abstraction (idb)
    localStorage.ts           # Preferences only
  utils/
    nanoid.ts                 # Cryptographically secure IDs
    format.ts                 # Date / score / class formatting

types/project.ts              # All shared TypeScript domain types
```

---

## Workflow

1. **Checklists** — Upload an `.xlsx` audit questionnaire. The original file is preserved read-only.
2. **New Audit** — Select the checklist, fill in supplier info, dates and auditor name.
3. **Supplier Assessment** — Record supplier responses, conformance status and evidence per question.
4. **Auditor Verification** — Set independent verdict per question, attach photos, tick approval checkbox.
5. **Findings** — Record and classify findings. Approve each finding explicitly.
6. **CARs** — Fill in 8D corrective action fields, advance status, attach effectiveness evidence, close.
7. **Report** — Select qualification recommendation, write conclusion, generate report, Print → Save as PDF.
8. **Settings** — Export JSON backup, restore from backup, factory reset.

---

## Human approval controls

The following actions **always require explicit auditor action** and cannot be triggered automatically:

| Action | Control |
|---|---|
| Approve a verification item | Checkbox on each question |
| Approve a finding | "Approve Finding" button |
| Close a CAR | "Auditor Verified Closed" button with confirmation dialog |
| Approve the final report | "Approve Report" button with confirmation dialog |
| Qualify a supplier | Report recommendation + auditor approval |

AI suggestions (where present) are labelled `⚠ AI SUGGESTION — NOT AUDITOR APPROVED` and have no effect on any approval field.

---

## Deployment (Vercel)

1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo.
3. No environment variables are required for MVP.
4. Click **Deploy**.
5. Test the production URL on both mobile (375px) and desktop.

---

## Security notes

- No API keys are required or exposed in this MVP.
- `.env.local` is gitignored and never committed.
- All evidence blobs are stored in IndexedDB only — nothing sensitive goes into localStorage.
- The application binds to localhost only during development.
- Container images (if added later) must use `registry.redhat.io` base images with a non-root user.

---

## Licence

MIT
