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

## Verified exports

- XLSX downloads are rebuilt as genuine value-only workbooks, including clean files. Cells and inspected notes are masked; source metadata, formulas, links, and formatting are not copied.
- CSV is offered for CSV/TSV sources only. Delimiters normalize to commas, quoted fields retain their structure, and formula-like fields are prefixed with an apostrophe.
- TXT is an extracted text preview, including for PDF and Word sources.
- Review is required. Exported content is scanned again against the current policy. Incomplete, blocked, or still-sensitive results are rejected.
- Run `npm run test:export` for export regression checks.

## Local context model

The scanner now combines existing policy rules with PromptShield Context v1, a multinomial logistic regression token classifier trained on 10,248 synthetic tokens. It runs entirely in the browser without an API key or external inference. Names, addresses, secrets, health, personal finance and private plans use the same policy, location, masking and export checks as rule findings. Each model finding includes a confidence score.

See `src/model/MODEL_CARD.md` for scope and evaluation limits. Reproduce weights with `python scripts/train_detector.py` (numpy and scikit-learn 1.8). Run `npm run test:model` and `npm run test:export`. No user prompts are used for training. This is a prototype classifier, not an LLM or a guarantee of complete redaction.
