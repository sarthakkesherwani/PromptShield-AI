# PromptShield AI 🛡️

**Pre-Upload Sensitive Data Detection, Smart Auto-Fix & Policy Guard for AI Workflows**

PromptShield AI protects organizations and individuals from accidental leakage of personally identifiable information (PII), secret tokens, customer account identifiers, and confidential business data when interacting with AI prompt inputs or uploading documents to AI gateways.

---

## 1. Key Features

### 🔍 DeepFile Guard
- **Accurate Source Localization**:
  - **Prompt text**: Character ranges (`Chars 12–34`), line and column indicators.
  - **Excel workbooks (.xlsx)**: Exact worksheet and cell coordinates (e.g. `Sheet1!B2`, `Sheet1!C2`) preserving spreadsheet structure.
  - **PDF documents (.pdf)**: Page-level tracking (`Page 1`, `Page 2`) via PyMuPDF text stream extraction.
  - **CSV files (.csv)**: Row and named column indicators (e.g. `Row 2, Email`).
- **Safety First & Explicit Incomplete Scan State**:
  - Encrypted documents, corrupted files, and image-only/scanned PDFs are explicitly flagged with an **"Incomplete scan / Unsupported"** state rather than falsely claiming "Safe".
  - Formula safety: Spreadsheet formulas starting with `=`, `+`, `-`, `@` are inspected safely and never executed.

### 🧠 Smart Auto-Fix & Deterministic Masking
- **Numbered Placeholders**: Replaces sensitive values with consistent entity placeholders:
  - `[EMAIL_1]`, `[EMAIL_2]`
  - `[PHONE_1]`, `[PHONE_2]`
  - `[ACCOUNT_1]`, `[ACCOUNT_2]`
  - `[API_KEY_1]`
  - `[CONFIDENTIAL_1]`
- **Repeated Value Consistency**: Repeated occurrences of the exact same sensitive value throughout a document share the identical placeholder.
- **Re-Scan Verification**: The sanitized payload is automatically re-scanned before export or submission is unlocked. Auto-Fix cannot silently approve previously blocked policy violations.
- **Honest PII & Names Notice**: Explains that person names and contextual metadata can be personal data, and field masking alone does not guarantee total re-identification immunity.

### ⚖️ Transparent Risk Scoring & Policy Engine
- **Heuristic Scoring (0–100)**: Multi-category weighted scoring with transparent explanations and diminishing returns for repeated occurrences.
- **Three Policy Decisions**:
  - **ALLOW**: No sensitive rules triggered, risk score within allow threshold.
  - **WARN**: Sensitive findings detected; user review and smart auto-fix required.
  - **BLOCK**: Prohibited items (e.g. API keys, secret quotes) trigger strict blocking.
- **Inviolable Security Axiom**: A low calculated risk score can **never** override a strict blocking policy rule.

### 🔒 Zero-Exposure Audit Logging
- Stores tamper-evident metadata in SQLite: Scan ID, timestamp, source type, finding counts by category, risk score, policy decision, and action taken.
- **Zero-Exposure Guarantee**: Never persists raw prompts, sensitive values, original personal filenames, uploaded file bytes, or placeholder mapping keys.

---

## 2. Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion
- **Backend**: Python 3.10+, FastAPI, Uvicorn, SQLite
- **File Parsing**:
  - PyMuPDF (`fitz` / `pymupdf`) for text-based PDFs
  - `openpyxl` for Excel `.xlsx`
  - Python standard `csv` module
- **Server Bridge**: Node.js + Express with Vite middleware and reverse proxy on port 3000.

---

## 3. Setup & Running Instructions

### Prerequisites
- Node.js 18+ and `npm`
- Python 3.10+ with `pip`

### Step 1: Install Dependencies
```bash
# Node dependencies
npm install

# Python backend dependencies
pip install fastapi uvicorn pymupdf openpyxl python-multipart
```

### Step 2: Generate Synthetic Demo Files
```bash
python3 backend/create_demo_data.py
```

### Step 3: Start Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 4. Hackathon 2-Minute Demo Script

Follow these steps for a live demonstration:

1. **Step 1: Required Excel Test (`customers.xlsx`)**
   - Click the **Demo Walkthrough** button in the header.
   - Click **Scan XLSX Now** for `customers.xlsx`.
   - Observe findings pinned at exact cells: `Sheet1!B2` (rahul@example.com), `Sheet1!C2` (ACC-12345), `Sheet1!B3` (priya@example.com), and `Sheet1!C3` (ACC-67890).
2. **Step 2: Smart Auto-Fix & Numbered Placeholders**
   - Click **Run Smart Auto-Fix**.
   - Notice the mapped placeholders: `rahul@example.com` &rarr; `[EMAIL_1]`, `ACC-12345` &rarr; `[ACCOUNT_1]`, etc.
   - Point out that repeated values share the same placeholder and re-scan clearance is `ALLOW`.
3. **Step 3: Policy Gating & Approved Export**
   - Check the user review confirmation box.
   - Download the structural `sanitized_export.xlsx` or click **Send to AI Assistant (Simulated)** to preview the clean gateway payload.
4. **Step 4: Strict Blocking Enforcement**
   - Click **Quick Test &rarr; Blocked Quotation Sample**.
   - Risk score hits 100 with policy **BLOCK** due to `sk-live...` API key and `CONFIDENTIAL & INTERNAL ONLY: secret quotation`.
   - Show that Auto-Fix refuses to bypass strict blocking policy.
5. **Step 5: Incomplete / Unsupported File Guard**
   - Load `unsupported_binary.dat`.
   - DeepFile Guard explicitly flags an **"Incomplete scan / Unsupported"** state rather than falsely reporting the file as safe.
6. **Step 6: Zero-Exposure Audit Trail**
   - Switch to the **Audit History** tab.
   - Show that audit records track scan IDs, category counts, and policy outcomes without storing any raw personal data or prompts.

---

## 5. Implemented Features & Current Limitations

### Implemented Features
- [x] Full-stack architecture (React + Tailwind + FastAPI + SQLite)
- [x] Rule-based detection for emails, phone numbers, account IDs (`ACC-12345`), API keys (`sk-...`, `AKIA...`, `ghp_...`, `Bearer...`), and configurable confidential keywords
- [x] DeepFile Guard with exact coordinates (Prompt Chars/Line, PDF Page, XLSX Sheet & Cell, CSV Row & Col)
- [x] Heuristic risk score (0-100) with transparent formula breakdown
- [x] Policy decisions: Allow, Warn, Block (strict blocking rule override enforced)
- [x] Smart Auto-Fix with consistent numbered placeholders (`[EMAIL_1]`, `[ACCOUNT_1]`, etc.)
- [x] Side-by-side before/after comparison with change highlighting
- [x] Re-scan validation before unlocking final actions
- [x] Backend-enforced policy validation on export and simulated submission
- [x] Structural XLSX export, CSV export, and text extraction export for PDF
- [x] Zero-exposure SQLite audit logging without raw sensitive content
- [x] Custom policy settings editor for thresholds, rules, weights, and custom confidential phrases
- [x] Synthetic demo suite (`customers.xlsx`, `customers.csv`, `customer_escalations.pdf`, `unsupported_binary.dat`)

### Remaining Limitations
- **Image-based / Scanned PDFs**: Optical character recognition (OCR) is intentionally not bundled to maintain lightweight local execution; scanned documents are safely flagged as incomplete scans.
- **Spreadsheet Macros & Embedded Binaries**: Binary macros and embedded OLE objects inside `.xlsx` are detected and flagged as uninspected.
- **Contextual Anonymization**: Names and implicit re-identification references are preserved in rule-based mode; masking selected fields does not guarantee full differential privacy.
