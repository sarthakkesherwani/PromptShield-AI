# PromptShield AI — Browser Edition

A private, on-device scanner for AI prompts and documents. Built with React, Vite, and a deterministic rules engine.

## Run

```
npm install
npm run dev
```

Build with `npm run build`; preview with `npm run preview`.

## Features

- Responsive phone layout, accessible header, and red tap feedback.
- Prompt, TXT, CSV/TSV, JSON, XLSX, DOCX, and PDF text inspection.
- PDF.js runs locally, with page-level findings. Scanned pages, images, encrypted/corrupted PDFs, and coverage failures remain incomplete. No OCR. PDFs are limited to 100 pages.
- Deterministic numbered masking, re-scan, explicit review, and sanitized export. PDFs export sanitized text, not redacted PDF binaries.
- Strict blocks and incomplete scans cannot be released through export or simulated submission.
- Policy settings and up to 500 audit metadata entries save to this browser's local storage. Clear them in the app. Raw prompts, uploaded files, original filenames, matched values, and placeholder maps are not persisted. Browser storage is editable and is not a tamper-evident compliance archive. If storage is unavailable, state lasts for the active page only.
- AI submission is simulated; this edition does not send content to an AI provider.

The existing Node/Python server files are retained for reference; this edition uses the browser adapter in `src/local-api.ts`. The published Sites build serves static assets.
