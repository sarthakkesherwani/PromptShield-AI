import { prepareExport } from './server/export';
import { Buffer } from 'buffer';
import {store, getEngine, Sanitizer, type AutoFixResult, type ScanResult} from './server/engine';
import {parseAndScanPrompt, parseAndScanXlsx, parseAndScanCsv, parseAndScanPdf, parseAndScanDocx, parseAndScanJson, sanitizeXlsx} from './server/parsers';
store.restoreLocalState();
const SESSIONS = new Map<string, any>();
function cleanSessions(){ const now=Date.now(); for(const [id,s] of SESSIONS) if(now-s.created>1800000) SESSIONS.delete(id); }
function newSessionId(){return crypto.randomUUID()}
const MAX_FILE_SIZE=15*1024*1024;
const TEXT_DOC_EXT=new Set(['.txt','.md','.log','.env','.yaml','.yml','.xml','.html','.sql','.ini','.conf','.cfg']);
const ALLOWED_EXT=new Set(['.pdf','.docx','.xlsx','.csv','.tsv','.json',...TEXT_DOC_EXT]);
const path={extname:(s:string)=>s.includes('.')?'.'+s.split('.').pop()!.toLowerCase():'',basename:(s:string)=>s.split(/[\\/]/).pop()!,join:(...s:string[])=>s.join('/')};
const __dirname='';
const nativeFetch=window.fetch.bind(window);
const fs={existsSync:()=>true};
const routes:any[]=[];
const app:any=Object.fromEntries(['get','post','put','delete'].map(method=>[method,(pattern:string,...handlers:any[])=>routes.push({method:method.toUpperCase(),pattern,handler:handlers.at(-1)})]));
const upload={single:()=>null};
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
      action_taken: 'scanned', incomplete_scan: false, notes: "Scan completed.",
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
        source_type: result.source_type, safe_source_label: result.source_type + " document",
        finding_counts: result.category_counts, total_findings: result.total_findings,
        risk_score: result.risk_score, policy_decision: result.policy_decision,
        action_taken: 'scanned', incomplete_scan: result.is_incomplete, notes: "Scan completed.",
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
    if (d.is_incomplete || d.policy_decision === 'block') return res.status(403).json({detail: 'Incomplete scans and strict policy blocks cannot be exported, submitted, or auto-fixed.'});
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
      afResult = Sanitizer.sanitizeCsv(d.csv_rows, findings, engine, ',');
    } else {
      afResult = Sanitizer.sanitizePrompt(d.raw_text || '', findings, engine);
    }

    const can_proceed = afResult.re_scan_findings.length === 0 && afResult.re_scan_policy_decision === 'allow' &&
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

  app.post('/api/export', async (req, res) => {
    cleanSessions();
    const session = SESSIONS.get(req.body.session_id);
    if (!session) return res.status(404).json({detail: 'Session expired. Please scan again.'});
    if (req.body.user_confirmed !== true) return res.status(403).json({detail: 'Review the preview and tick the confirmation before exporting.'});
    try {
      const format = String(req.body.export_format || 'txt').toLowerCase();
      const exported = await prepareExport(session.data, format);
      store.addAuditLog({source_type: session.data.source_type, safe_source_label: session.data.source_type + ' scan', finding_counts: {}, total_findings: 0, risk_score: 0, policy_decision: 'allow', action_taken: `exported_${format}`, incomplete_scan: false});
      res.setHeader('Content-Type', exported.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
      return res.send(exported.body);
    } catch (err: any) { return res.status(403).json({detail: err.message}); }
  });

  // ─── Simulate Submit ───────────────────────────────────────────────────

  app.post('/api/simulate-submit', async (req, res) => {
    cleanSessions();
    const sess = SESSIONS.get(req.body.session_id);
    if (!sess) return res.status(404).json({ detail: 'Session expired. Please re-scan.' });
    if (!req.body.user_confirmed) return res.status(403).json({ detail: 'User review confirmation required.' });

    const d = sess.data;
    if (d.is_incomplete || d.policy_decision === 'block') return res.status(403).json({detail: 'Incomplete scans and strict policy blocks cannot be exported, submitted, or auto-fixed.'});
    const san = d.sanitized_data as AutoFixResult | undefined;
    if (!san && d.findings?.length > 0) return res.status(403).json({ detail: 'Content must be sanitized first.' });
    if (san?.re_scan_policy_decision === 'block') return res.status(403).json({ detail: 'Blocked by policy.' });

    let payload: string;
    try { payload = String((await prepareExport(d, 'txt')).body); } catch (err: any) { return res.status(403).json({detail: err.message}); }
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


window.fetch = async (input:any, options:any={}) => {
 const url=new URL(typeof input==='string'?input:input.url,location.href);
 if(url.origin!==location.origin || !url.pathname.startsWith('/api/')) return nativeFetch(input,options);
 if(url.pathname.startsWith('/api/demo/file/')) return nativeFetch('/demo_samples/'+encodeURIComponent(url.pathname.split('/').pop()!));
 const method=options.method||'GET';
 const route=routes.find(r=>r.method===method && new RegExp('^'+r.pattern.replace(/:[^/]+/g,'([^/]+)')+'$').test(url.pathname));
 if(!route) return Response.json({detail:'Unknown operation'},{status:404});
 const keys=[...route.pattern.matchAll(/:([^/]+)/g)].map(m=>m[1]);
 const vals=url.pathname.match(new RegExp('^'+route.pattern.replace(/:[^/]+/g,'([^/]+)')+'$'))!.slice(1);
 const req:any={body:{},params:Object.fromEntries(keys.map((k,i)=>[k,vals[i]])),query:Object.fromEntries(url.searchParams)};
 if(options.body instanceof FormData){ const f=options.body.get('file') as File; if(f){if(f.size>MAX_FILE_SIZE)return Response.json({detail:'File exceeds 15 MB limit'},{status:413});req.file={originalname:f.name,buffer:Buffer.from(await f.arrayBuffer())};} }
 else if(options.body) req.body=JSON.parse(options.body);
 let response:Response|undefined;let status=200; const headers:any={};
 const res:any={status:(s:number)=>{status=s;return res},json:(d:any)=>response=Response.json(d,{status}),setHeader:(k:string,v:string)=>headers[k]=v,send:(data:any)=>response=new Response(data,{status,headers}),download:async(fp:string)=>{response=await nativeFetch('/demo_samples/'+path.basename(fp))}};
 try{ await route.handler(req,res);store.persistLocalState();return response||Response.json({status:'ok'}); }catch(e:any){return Response.json({detail:e.message||'Operation failed'},{status:422});}
};
