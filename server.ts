/**
 * PromptShield AI — Full-Stack Server
 * Express + Vite middleware + all API routes.
 * Zero Python dependency — everything runs in TypeScript.
 */
import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  store, getEngine, Sanitizer, type AutoFixResult, type ScanResult,
} from './src/server/engine.ts';
import {
  parseAndScanPrompt, parseAndScanXlsx, parseAndScanCsv,
  parseAndScanPdf, parseAndScanDocx, parseAndScanJson, sanitizeXlsx,
} from './src/server/parsers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;

// ─── Demo File Generation ───────────────────────────────────────────────────

async function ensureDemoFiles() {
  const dir = path.join(__dirname, 'demo_samples');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // customers.csv
  const csvPath = path.join(dir, 'customers.csv');
  if (!fs.existsSync(csvPath)) {
    fs.writeFileSync(csvPath, 'Name,Email,Account ID\nRahul,rahul@example.com,ACC-12345\nPriya,priya@example.com,ACC-67890\n');
  }

  // confidential_project_brief.txt
  const txtPath = path.join(dir, 'confidential_project_brief.txt');
  if (!fs.existsSync(txtPath)) {
    fs.writeFileSync(txtPath, 'CONFIDENTIAL & INTERNAL ONLY: Project Titan Q4 Quote\nThe secret quotation agreed with Apex Corp is $4,850,000.\nDo not distribute outside executive circle. Use API key sk-live99482710492817491028 to query the private ledger.\n');
  }

  // unsupported_binary.dat
  const datPath = path.join(dir, 'unsupported_binary.dat');
  if (!fs.existsSync(datPath)) {
    fs.writeFileSync(datPath, Buffer.from([0x00, 0xFF, 0xFE, 0x00, 0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0]));
  }

  // customers.xlsx
  const xlsxPath = path.join(dir, 'customers.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      ws.addRow(['Name', 'Email', 'Account ID']);
      ws.addRow(['Rahul', 'rahul@example.com', 'ACC-12345']);
      ws.addRow(['Priya', 'priya@example.com', 'ACC-67890']);
      await wb.xlsx.writeFile(xlsxPath);
    } catch (e) { console.warn('[Demo] Could not create customers.xlsx:', e); }
  }
  console.log('[PromptShield AI] Demo files ready in', dir);
}

// ─── Session Store ──────────────────────────────────────────────────────────

const SESSIONS = new Map<string, { created: number; data: any }>();
const SESSION_TTL = 30 * 60 * 1000; // 30 min

function cleanSessions() {
  const now = Date.now();
  for (const [k, v] of SESSIONS) { if (now - v.created > SESSION_TTL) SESSIONS.delete(k); }
}

function newSessionId(): string { return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

// ─── Allowed File Types ─────────────────────────────────────────────────────

const TEXT_DOC_EXT = new Set([
  '.txt', '.md', '.markdown', '.log', '.env', '.yaml', '.yml',
  '.xml', '.html', '.htm', '.sql', '.ini', '.conf', '.cfg',
]);
const ALLOWED_EXT = new Set([
  '.pdf', '.docx', '.xlsx', '.csv', '.tsv', '.json',
  ...TEXT_DOC_EXT,
]);
const MAX_FILE_SIZE = 15 * 1024 * 1024;

// ─── Start Server ───────────────────────────────────────────────────────────

async function startServer() {
  await ensureDemoFiles();

  const app = express();
  app.use(express.json({ limit: '5mb' }));

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

  // ═══════════════════════════════════════════════════════════════════════════
  // API ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'PromptShield AI', ts: Date.now() });
  });

  // ─── Scan Prompt ────────────────────────────────────────────────────────

  app.post('/api/scan/prompt', (req, res) => {
    cleanSessions();
    const text = (req.body.prompt || '').trim();
    if (!text) return res.status(400).json({ detail: 'Prompt text cannot be empty.' });

    const engine = getEngine();
    const result = parseAndScanPrompt(text, engine);
    const sid = newSessionId();
    SESSIONS.set(sid, { created: Date.now(), data: { ...result, raw_text: text } });

    store.addAuditLog({
      source_type: 'prompt', safe_source_label: 'Direct Text Prompt',
      finding_counts: result.category_counts, total_findings: result.total_findings,
      risk_score: result.risk_score, policy_decision: result.policy_decision,
      action_taken: 'scanned', incomplete_scan: false, notes: result.decision_summary,
    });

    res.json({ session_id: sid, audit_id: '', ...result });
  });

  // ─── Scan File ──────────────────────────────────────────────────────────

  app.post('/api/scan/file', upload.single('file'), async (req, res) => {
    cleanSessions();
    if (!req.file) return res.status(400).json({ detail: 'No file uploaded.' });

    const filename = req.file.originalname || 'uploaded_file';
    const ext = path.extname(filename).toLowerCase();

    if (!ALLOWED_EXT.has(ext)) {
      const safeName = path.basename(filename);
      const incompleteResult: ScanResult = {
        source_type: ext.replace('.', '') || 'unknown',
        safe_source_label: `Unsupported File (${ext || 'binary'})`,
        filename: safeName,
        raw_text: '',
        findings: [],
        is_incomplete: true,
        coverage_notes: `Unsupported file type '${ext || 'unknown'}'. Cannot inspect binary or unsupported formats.`,
        unsupported_elements: [
          `Unsupported file format '${ext || 'unknown'}'. Supported: PDF, DOCX, XLSX, CSV/TSV, JSON, TXT, MD, LOG, YAML, XML, SQL, ENV.`,
        ],
        risk_score: 50,
        policy_decision: 'warn',
        decision_summary: `Warning: Unsupported file type '${ext || 'unknown'}' — Incomplete scan. File cannot be verified as Safe.`,
        blocking_reasons: [],
        score_breakdown: [],
        formula_explanation: 'Incomplete / unsupported file type defaults to Warn (50/100) rather than Safe.',
        category_counts: {},
        total_findings: 0,
      };
      const sid = newSessionId();
      SESSIONS.set(sid, { created: Date.now(), data: { ...incompleteResult } });
      store.addAuditLog({
        source_type: incompleteResult.source_type,
        safe_source_label: incompleteResult.safe_source_label,
        finding_counts: {},
        total_findings: 0,
        risk_score: 50,
        policy_decision: 'warn',
        action_taken: 'unsupported_file',
        incomplete_scan: true,
        notes: incompleteResult.decision_summary,
      });
      return res.json({ session_id: sid, audit_id: '', ...incompleteResult });
    }

    const buf = req.file.buffer;
    const engine = getEngine();

    try {
      let result: ScanResult;
      if (ext === '.pdf') {
        result = await parseAndScanPdf(buf, filename, engine);
      } else if (ext === '.docx') {
        result = await parseAndScanDocx(buf, filename, engine);
      } else if (ext === '.xlsx') {
        result = await parseAndScanXlsx(buf, filename, engine);
      } else if (ext === '.csv' || ext === '.tsv') {
        result = parseAndScanCsv(buf, filename, engine);
      } else if (ext === '.json') {
        result = parseAndScanJson(buf, filename, engine);
      } else {
        // Plain text / code / config documents (.txt, .md, .log, .env, .yaml, .xml, .sql, etc.)
        const hasBinaryNull = buf.subarray(0, 4096).includes(0);
        if (hasBinaryNull) {
          throw new Error('File contains binary bytes and cannot be inspected as plain text.');
        }
        let txt: string;
        try { txt = buf.toString('utf-8'); } catch { txt = buf.toString('latin1'); }
        const lineCount = txt ? txt.split(/\r?\n/).length : 0;
        result = parseAndScanPrompt(txt, engine);
        result.source_type = 'txt';
        result.safe_source_label = `${ext.replace('.', '').toUpperCase()} Document (${path.basename(filename)})`;
        result.filename = path.basename(filename);
        result.coverage_notes = `Scanned ${lineCount} line(s), ${txt.length} character(s) of ${ext.replace('.', '').toUpperCase()} text.`;
      }

      const sid = newSessionId();
      SESSIONS.set(sid, { created: Date.now(), data: { ...result, file_bytes: buf, raw_text: result.raw_text } });

      store.addAuditLog({
        source_type: result.source_type, safe_source_label: result.safe_source_label,
        finding_counts: result.category_counts, total_findings: result.total_findings,
        risk_score: result.risk_score, policy_decision: result.policy_decision,
        action_taken: 'scanned', incomplete_scan: result.is_incomplete, notes: result.decision_summary,
      });

      res.json({ session_id: sid, audit_id: '', ...result });
    } catch (err: any) {
      store.addAuditLog({
        source_type: ext.replace('.', ''), safe_source_label: `File (${ext})`,
        finding_counts: {}, total_findings: 0, risk_score: 50,
        policy_decision: 'warn', action_taken: 'scan_failed',
        incomplete_scan: true, notes: err.message,
      });
      res.status(422).json({ detail: `File scan error: ${err.message}. Status: Incomplete scan / Unsupported.` });
    }
  });

  // ─── Auto-Fix ───────────────────────────────────────────────────────────

  app.post('/api/autofix', async (req, res) => {
    cleanSessions();
    const sess = SESSIONS.get(req.body.session_id);
    if (!sess) return res.status(404).json({ detail: 'Session expired. Please re-scan.' });

    const d = sess.data;
    const engine = getEngine();
    const findings = d.findings || [];

    if (findings.length === 0) {
      return res.json({
        session_id: req.body.session_id, message: 'No findings to mask.',
        original_content: d.raw_text || '', sanitized_content: d.raw_text || '',
        placeholder_map: {}, re_scan_policy_decision: 'allow', re_scan_risk_score: 0, can_proceed: true,
      });
    }

    let afResult: AutoFixResult;
    let xlsxBytes: Buffer | undefined;

    if (d.source_type === 'xlsx' && d.file_bytes) {
      const { buffer, meta } = await sanitizeXlsx(d.file_bytes, findings, engine);
      afResult = meta;
      xlsxBytes = buffer;
    } else if (d.source_type === 'csv' && d.csv_rows) {
      afResult = Sanitizer.sanitizeCsv(d.csv_rows, findings, engine, d.csv_delimiter || ',');
    } else {
      afResult = Sanitizer.sanitizePrompt(d.raw_text || '', findings, engine);
    }

    const can_proceed = afResult.re_scan_policy_decision !== 'block' &&
      afResult.re_scan_risk_score < engine.settings.block_threshold;

    d.sanitized_data = afResult;
    if (xlsxBytes) d.sanitized_xlsx_bytes = xlsxBytes;

    store.addAuditLog({
      source_type: d.source_type, safe_source_label: d.safe_source_label || 'Unknown',
      finding_counts: d.category_counts || {}, total_findings: findings.length,
      risk_score: afResult.re_scan_risk_score, policy_decision: afResult.re_scan_policy_decision,
      action_taken: 'auto_fixed', incomplete_scan: d.is_incomplete || false,
      notes: `Auto-fixed ${Object.keys(afResult.placeholder_map).length} distinct entities.`,
    });

    res.json({ session_id: req.body.session_id, ...afResult, can_proceed });
  });

  // ─── Export ─────────────────────────────────────────────────────────────

  app.post('/api/export', (req, res) => {
    cleanSessions();
    const sess = SESSIONS.get(req.body.session_id);
    if (!sess) return res.status(404).json({ detail: 'Session expired. Please re-scan.' });

    if (!req.body.user_confirmed) {
      return res.status(403).json({ detail: 'Explicit user confirmation required before export.' });
    }
    const d = sess.data;
    const san = d.sanitized_data as AutoFixResult | undefined;

    if (!san && d.findings?.length > 0) {
      return res.status(403).json({ detail: 'Content must be sanitized before export.' });
    }
    if (san?.re_scan_policy_decision === 'block') {
      return res.status(403).json({ detail: 'Content BLOCKED by policy. Export disabled.' });
    }

    const fmt = (req.body.export_format || 'txt').toLowerCase();

    store.addAuditLog({
      source_type: d.source_type, safe_source_label: d.safe_source_label || '',
      finding_counts: {}, total_findings: 0,
      risk_score: san?.re_scan_risk_score ?? 0, policy_decision: 'allow',
      action_taken: `exported_${fmt}`, incomplete_scan: false,
    });

    if (fmt === 'xlsx' && d.sanitized_xlsx_bytes) {
      res.setHeader('Content-Disposition', 'attachment; filename="sanitized_export.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(d.sanitized_xlsx_bytes);
    }

    const text = san?.sanitized_content || d.raw_text || '';
    const ct = fmt === 'csv' ? 'text/csv' : 'text/plain; charset=utf-8';
    res.setHeader('Content-Disposition', `attachment; filename="sanitized_export.${fmt}"`);
    res.setHeader('Content-Type', ct);
    res.send(text);
  });

  // ─── Simulate Submit ───────────────────────────────────────────────────

  app.post('/api/simulate-submit', (req, res) => {
    cleanSessions();
    const sess = SESSIONS.get(req.body.session_id);
    if (!sess) return res.status(404).json({ detail: 'Session expired. Please re-scan.' });
    if (!req.body.user_confirmed) return res.status(403).json({ detail: 'User review confirmation required.' });

    const d = sess.data;
    const san = d.sanitized_data as AutoFixResult | undefined;
    if (!san && d.findings?.length > 0) return res.status(403).json({ detail: 'Content must be sanitized first.' });
    if (san?.re_scan_policy_decision === 'block') return res.status(403).json({ detail: 'Blocked by policy.' });

    const payload = san?.sanitized_content || d.raw_text || '';
    const snippet = payload.length > 200 ? payload.slice(0, 200) + '...' : payload;

    store.addAuditLog({
      source_type: d.source_type, safe_source_label: d.safe_source_label || '',
      finding_counts: {}, total_findings: 0,
      risk_score: san?.re_scan_risk_score ?? 0, policy_decision: 'allow',
      action_taken: 'simulated_submitted', incomplete_scan: false,
      notes: 'Simulated AI submission approved.',
    });

    res.json({
      status: 'success', message: 'Sanitized payload received by AI Gateway (Simulated).',
      submitted_payload_snippet: snippet,
      masked_entities_count: san ? Object.keys(san.placeholder_map).length : 0,
      simulated_ai_response: 'Hello! I received your sanitized inquiry. All sensitive identifiers were abstracted into safe placeholders. How can I assist you?',
      timestamp: Date.now(),
    });
  });

  // ─── Policy ─────────────────────────────────────────────────────────────

  app.get('/api/policy', (_req, res) => {
    res.json({ rules: store.getRules(), settings: store.getSettings() });
  });

  app.put('/api/policy/rules/:ruleId', (req, res) => {
    store.updateRule(req.params.ruleId, req.body);
    res.json({ status: 'success', rule_id: req.params.ruleId });
  });

  app.put('/api/policy/settings', (req, res) => {
    store.updateSettings(req.body);
    res.json({ status: 'success', settings: store.getSettings() });
  });

  app.post('/api/policy/reset', (_req, res) => {
    store.resetToDefaults();
    res.json({ status: 'success', message: 'Reset to defaults.' });
  });

  // ─── Audit ──────────────────────────────────────────────────────────────

  app.get('/api/audit', (req, res) => {
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '100'))));
    res.json({ logs: store.getAuditLogs(limit) });
  });

  app.get('/api/audit/stats', (_req, res) => res.json(store.getAuditStats()));

  app.delete('/api/audit', (_req, res) => {
    store.clearAuditLogs();
    res.json({ status: 'success', message: 'Audit logs cleared.' });
  });

  // ─── Demo Samples ──────────────────────────────────────────────────────

  app.get('/api/demo/samples', (_req, res) => {
    res.json({
      normal_prompt: {
        title: 'Normal Prompt (Allowed)',
        description: 'Standard question with no PII.',
        text: "Can you explain how Dijkstra's shortest path algorithm works and provide a clean Python implementation with time complexity analysis?"
      },
      sensitive_prompt: {
        title: 'Sensitive Prompt (Warns)',
        description: 'Contains email, phone, and account ID.',
        text: 'Support escalation: Customer Priya Sharma (email: priya.sharma@example.com, phone: +1-555-0199) requested an urgent renewal for account ACC-67890. Please draft an email to resolve this.'
      },
      confidential_prompt: {
        title: 'Confidential Prompt (Blocked)',
        description: 'Contains confidential keywords and API key.',
        text: 'INTERNAL ONLY & STRICTLY CONFIDENTIAL: Project Titan acquisition secret quotation is $4,850,000. Use production API key sk-live99482710492817491028 to query the confidential partner ledger.'
      },
      files: [
        { name: 'customers.xlsx', label: 'Synthetic Customer Database (Excel)', description: 'Rahul & Priya at Sheet1!B2, C2, B3, C3', download_url: '/api/demo/file/customers.xlsx' },
        { name: 'customers.csv', label: 'Synthetic Customer Data (CSV)', description: 'CSV format', download_url: '/api/demo/file/customers.csv' },
        { name: 'unsupported_binary.dat', label: 'Corrupted / Unsupported File', description: 'Triggers Incomplete scan state.', download_url: '/api/demo/file/unsupported_binary.dat' },
      ]
    });
  });

  app.get('/api/demo/file/:filename', (req, res) => {
    const safe = path.basename(req.params.filename);
    const fp = path.join(__dirname, 'demo_samples', safe);
    if (!fs.existsSync(fp)) return res.status(404).json({ detail: 'Demo file not found.' });
    res.download(fp, safe);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Vite Dev Middleware
  // ═══════════════════════════════════════════════════════════════════════════

  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PromptShield AI] Server running at http://0.0.0.0:${PORT}`);
    console.log('[PromptShield AI] All API endpoints ready — zero Python dependency.');
  });
}

startServer().catch(err => {
  console.error('[Fatal]', err);
  process.exit(1);
});
