import { Buffer } from 'buffer';
/**
 * PromptShield AI — File Parsers (PDF, XLSX, CSV, TXT/Prompt)
 * Pure TypeScript — no Python dependency.
 */
import { DetectionEngine, ScanResult, Finding } from './engine.ts';

// ─── Prompt Parser ──────────────────────────────────────────────────────────

export function parseAndScanPrompt(text: string, engine: DetectionEngine): ScanResult {
  const findings = engine.scanTextSegment(text, 'prompt', `Prompt (Chars 0-${text.length})`, { start: 0, end: text.length });

  // Enrich with line/col info
  for (const f of findings) {
    const start = f.location_meta.start as number;
    const end = f.location_meta.end as number;
    const prefix = text.slice(0, start);
    const line = (prefix.match(/\n/g) || []).length + 1;
    const lastNl = prefix.lastIndexOf('\n');
    const col = lastNl >= 0 ? start - lastNl : start + 1;
    f.location = `Line ${line}, Col ${col} (Chars ${start}–${end})`;
    f.location_meta.line = line;
    f.location_meta.col = col;
  }

  const ev = engine.evaluatePolicyAndScore(findings);
  return {
    source_type: 'prompt', safe_source_label: 'Text Prompt', raw_text: text,
    findings, is_incomplete: false,
    coverage_notes: '100% prompt text inspected via rule engine.',
    unsupported_elements: [], ...ev,
  };
}

// ─── CSV Parser ─────────────────────────────────────────────────────────────

function detectCsvDelimiter(content: string): string {
  const sampleLines = content.split(/\r?\n/).filter((l) => l.trim()).slice(0, 5);
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestScore = 0;

  for (const delim of candidates) {
    let counts: number[] = [];
    for (const line of sampleLines) {
      let inQuotes = false;
      let count = 0;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQuotes = !inQuotes;
        else if (!inQuotes && ch === delim) count++;
      }
      counts.push(count);
    }
    const minCount = counts.length ? Math.min(...counts) : 0;
    const total = counts.reduce((a, b) => a + b, 0);
    if (minCount > 0 && total > bestScore) {
      bestScore = total;
      best = delim;
    } else if (bestScore === 0 && total > 0) {
      bestScore = total;
      best = delim;
    }
  }
  return best;
}

function parseCSVContent(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"' && content[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(cur);
        cur = '';
      } else if (ch === '\r') {
        if (content[i + 1] === '\n') i++;
        row.push(cur);
        cur = '';
        if (row.some((cell) => cell.trim() !== '')) rows.push(row);
        row = [];
      } else if (ch === '\n') {
        row.push(cur);
        cur = '';
        if (row.some((cell) => cell.trim() !== '')) rows.push(row);
        row = [];
      } else {
        cur += ch;
      }
    }
  }
  row.push(cur);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
}

export function parseAndScanCsv(buf: Buffer, filename: string, engine: DetectionEngine): ScanResult {
  let content: string;
  try {
    content = buf.toString('utf-8');
  } catch {
    content = buf.toString('latin1');
  }
  // Strip UTF-8 BOM if present
  content = content.replace(/^\uFEFF/, '');

  const delimiter = filename.toLowerCase().endsWith('.tsv') ? '\t' : detectCsvDelimiter(content);
  const rows = parseCSVContent(content, delimiter);

  const header = rows[0] || [];
  const findings: Finding[] = [];
  let totalCells = 0;

  for (let ri = 0; ri < rows.length; ri++) {
    for (let ci = 0; ci < rows[ri].length; ci++) {
      const val = rows[ri][ci];
      if (!val.trim()) continue;
      totalCells++;
      const colName = ri > 0 && ci < header.length && header[ci].trim() ? header[ci].trim() : `Col ${ci + 1}`;
      const loc = `Row ${ri + 1}, ${colName}`;
      findings.push(...engine.scanTextSegment(val, 'csv', loc, { row: ri + 1, col: ci + 1, col_name: colName }));
    }
  }

  const ev = engine.evaluatePolicyAndScore(findings);
  const safeName = filename.replace(/^.*[\\/]/, '');
  return {
    source_type: 'csv',
    safe_source_label: `CSV File (${safeName})`,
    filename: safeName,
    raw_text: content,
    csv_rows: rows,
    csv_delimiter: delimiter,
    findings,
    is_incomplete: false,
    coverage_notes: `Scanned ${rows.length} row(s), ${totalCells} populated cells (delimiter: ${delimiter === '\t' ? 'TAB' : `'${delimiter}'`}).`,
    unsupported_elements: [],
    ...ev,
  };
}

// ─── XLSX Parser (using ExcelJS) ────────────────────────────────────────────

function extractExcelCellText(cell: any): { text: string; isFormula: boolean } {
  const raw = cell.value;
  if (raw == null) return { text: cell.text || '', isFormula: false };
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return { text: String(raw), isFormula: false };
  }
  if (raw instanceof Date) {
    return { text: raw.toISOString().slice(0, 10), isFormula: false };
  }
  if (typeof raw === 'object') {
    if ('formula' in raw || 'sharedFormula' in raw) {
      const res = raw.result != null ? String(raw.result) : (cell.text || '');
      return { text: res, isFormula: true };
    }
    if (Array.isArray(raw.richText)) {
      return { text: raw.richText.map((r: any) => r.text || '').join(''), isFormula: false };
    }
    if ('text' in raw) {
      const link = raw.hyperlink ? ` (${raw.hyperlink})` : '';
      return { text: `${raw.text}${link}`, isFormula: false };
    }
  }
  return { text: cell.text || '', isFormula: false };
}

function extractNoteText(note: any): string {
  if (!note) return '';
  if (typeof note === 'string') return note;
  if (Array.isArray(note.texts)) return note.texts.map((t: any) => t.text || '').join('');
  return '';
}

export async function parseAndScanXlsx(buf: Buffer, filename: string, engine: DetectionEngine): Promise<ScanResult> {
  let ExcelJS: any;
  try { ExcelJS = (await import('exceljs/dist/exceljs.min.js')).default; } catch {
    throw new Error('ExcelJS library is not available. Cannot parse XLSX files.');
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const findings: Finding[] = [];
  const unsupported: string[] = [];
  let isIncomplete = false;
  let totalCells = 0;
  let formulaCount = 0;
  let commentCount = 0;
  const sheetData: Record<string, any[]> = {};
  const previewLines: string[] = [];

  wb.eachSheet((ws: any) => {
    const sheetName: string = ws.name;
    findings.push(...engine.scanTextSegment(sheetName, 'xlsx', 'Worksheet name', {sheet: sheetName}));
    const rows: any[] = [];
    previewLines.push(`[${sheetName}]`);

    if (ws.state && ws.state !== 'visible') {
      unsupported.push(`Sheet '${sheetName}' has state '${ws.state}' (hidden sheet text cells were inspected).`);
    }

    if (ws.getImages && ws.getImages().length > 0) {
      isIncomplete = true;
      unsupported.push(`Sheet '${sheetName}' contains ${ws.getImages().length} embedded image(s) that cannot be inspected.`);
    }

    ws.eachRow((row: any, rowNumber: number) => {
      const rowVals: any[] = [];
      const previewCells: string[] = [];

      row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
        const { text: val, isFormula } = extractExcelCellText(cell);
        if (isFormula) formulaCount++;
        const coord = cell.address || `${String.fromCharCode(64 + colNumber)}${rowNumber}`;
        const locLabel = `${sheetName}!${coord}`;
        rowVals.push({ coordinate: coord, value: val, row: rowNumber, col: colNumber });
        previewCells.push(val);

        if (val.trim()) {
          totalCells++;
          findings.push(...engine.scanTextSegment(val, 'xlsx', locLabel, {
            sheet: sheetName, cell: coord, row: rowNumber, col: colNumber
          }));
        }

        const noteTxt = extractNoteText(cell.note);
        if (noteTxt.trim()) {
          commentCount++;
          findings.push(...engine.scanTextSegment(noteTxt, 'xlsx', `${locLabel} (Comment)`, {
            sheet: sheetName, cell: coord, row: rowNumber, col: colNumber
          }));
        }
      });

      rows.push(rowVals);
      previewLines.push(previewCells.join('\t'));
    });

    sheetData[sheetName] = rows;
  });

  if (formulaCount > 0) {
    unsupported.push(`Detected ${formulaCount} formula cell(s); inspected cached display values without executing formulas.`);
  }

  const ev = engine.evaluatePolicyAndScore(findings, isIncomplete);
  const safeName = filename.replace(/^.*[\\/]/, '');
  return {
    source_type: 'xlsx', safe_source_label: `Excel Workbook (${safeName})`,
    filename: safeName, raw_text: previewLines.join('\n'), sheet_data: sheetData,
    findings, is_incomplete: isIncomplete,
    coverage_notes: `Scanned ${Object.keys(sheetData).length} sheet(s), ${totalCells} text cell(s)${commentCount ? `, ${commentCount} comment(s)` : ''}${formulaCount ? `, ${formulaCount} formula value(s)` : ''}.`,
    unsupported_elements: unsupported, ...ev,
  };
}

// ─── XLSX Sanitizer ─────────────────────────────────────────────────────────

export async function sanitizeXlsx(
  buf: Buffer, findings: Finding[], engine: DetectionEngine
): Promise<{ buffer: Buffer; meta: import('./engine.ts').AutoFixResult }> {
  const { Sanitizer } = await import('./engine.ts');
  let ExcelJS: any;
  try { ExcelJS = (await import('exceljs/dist/exceljs.min.js')).default; } catch {
    throw new Error('ExcelJS not available');
  }

  const map = Sanitizer.generatePlaceholderMap(findings);
  const source = new ExcelJS.Workbook();
  await source.xlsx.load(buf);
  const output = new ExcelJS.Workbook();
  // Rebuild from inspected cell values only. Do not copy formulas, links, or document metadata.
  source.eachSheet((ws: any) => {
    const safeSheetName = Sanitizer.sanitizeText(ws.name, map).replace(/[\[\]:*?\/\\]/g, '_').slice(0, 31);
    const sheet = output.addWorksheet(safeSheetName || `Sheet${output.worksheets.length + 1}`);
    ws.eachRow((row: any, ri: number) => {
      row.eachCell({ includeEmpty: true }, (cell: any, ci: number) => {
        const { text } = extractExcelCellText(cell);
        const value = Sanitizer.sanitizeText(text, map);
        const target = sheet.getCell(ri, ci);
        target.value = typeof cell.value === 'number' && value === text ? cell.value : value;
        const note = extractNoteText(cell.note);
        if (note) target.note = Sanitizer.sanitizeText(note, map);
      });
    });
  });
  const outBuf = Buffer.from(await output.xlsx.writeBuffer());
  const checked = await parseAndScanXlsx(outBuf, 'sanitized_export.xlsx', engine);
  return { buffer: outBuf, meta: {
    original_content: (await parseAndScanXlsx(buf, 'source.xlsx', engine)).raw_text,
    sanitized_content: checked.raw_text, placeholder_map: map,
    re_scan_findings: checked.findings, re_scan_risk_score: checked.risk_score,
    re_scan_policy_decision: checked.policy_decision, re_scan_summary: checked.decision_summary,
    export_note: 'Value-only workbook. Cell positions and sheet names are retained; formulas, links, styling, and original document metadata are not copied.',
  }};
}

// ─── PDF Parser (pdf-parse v2 PDFParse API) ──────────────────────────────────

export async function parseAndScanPdf(buf: Buffer, filename: string, engine: DetectionEngine): Promise<ScanResult> {
  const safeName = filename.replace(/^.*[\\/]/, '');
  let PDFParseCtor: any;
  try {
    const mod: any = await import('./pdf-browser');
    PDFParseCtor = mod.PDFParse || mod.default?.PDFParse || mod.default;
  } catch {
    return {
      source_type: 'pdf',
      safe_source_label: `PDF Document (${safeName})`,
      raw_text: '',
      findings: [],
      is_incomplete: true,
      coverage_notes: 'PDF parsing library not available. File cannot be verified as safe.',
      unsupported_elements: ['PDF inspection is unavailable in this browser edition. Use TXT, CSV, XLSX or DOCX instead.'],
      risk_score: 50,
      policy_decision: 'warn',
      decision_summary: 'Warning: PDF could not be parsed. Incomplete scan.',
      blocking_reasons: [],
      score_breakdown: [],
      formula_explanation: 'N/A',
      category_counts: {},
      total_findings: 0,
    };
  }

  let parser: any = null;
  try {
    if (typeof PDFParseCtor !== 'function') {
      throw new Error('PDFParse class unavailable');
    }
    parser = new PDFParseCtor({ data: new Uint8Array(buf) });
    const data = await parser.getText();
    const rawPages: { num?: number; text?: string }[] = Array.isArray(data?.pages) ? data.pages : [];
    const fallbackText: string = data?.text || '';
    const numpages: number = data?.total || rawPages.length || 1;

    // Check embedded images (to warn when a PDF mixes text + scanned/uninspected images)
    let embeddedImagesCount = 0;
    let embeddedImagePages = 0;
    try {
      const imgRes = await parser.getImage({ imageBuffer: false, imageDataUrl: false });
      const imgPages: any[] = Array.isArray(imgRes?.pages) ? imgRes.pages : [];
      for (const ip of imgPages) {
        if (Array.isArray(ip.images) && ip.images.length > 0) {
          embeddedImagesCount += ip.images.length;
          embeddedImagePages++;
        }
      }
    } catch {
      throw new Error('PDF image coverage could not be verified');
    }

    // Check document metadata fields (Author, Subject, Title, Keywords)
    let metadataItems: { label: string; value: string }[] = [];
    try {
      const infoRes = await parser.getInfo({ parsePageInfo: false });
      const info = infoRes?.info || {};
      for (const key of ['Title', 'Author', 'Subject', 'Keywords', 'Creator']) {
        if (typeof info[key] === 'string' && info[key].trim()) {
          metadataItems.push({ label: `PDF Metadata (${key})`, value: info[key].trim() });
        }
      }
    } catch {
      // ignore metadata extraction failure
    }

    const pages: { page: number; text: string }[] = [];
    if (rawPages.length > 0) {
      for (let i = 0; i < rawPages.length; i++) {
        pages.push({ page: rawPages[i].num || i + 1, text: rawPages[i].text || '' });
      }
    } else if (fallbackText.trim()) {
      const chunks = fallbackText.split('\f').filter(Boolean);
      for (let i = 0; i < chunks.length; i++) {
        pages.push({ page: i + 1, text: chunks[i] });
      }
    }

    const emptyPageCount = pages.filter(p => !p.text.trim()).length;
    const totalText = pages.map((p) => p.text).join('\n').trim();
    if (!totalText) {
      return {
        source_type: 'pdf',
        safe_source_label: `PDF Document (${safeName})`,
        raw_text: '',
        findings: [],
        is_incomplete: true,
        coverage_notes: `Image-only or scanned PDF (${numpages} page(s)). No extractable text layer found.`,
        unsupported_elements: [
          `Image-only PDF (${embeddedImagesCount || 'multiple'} embedded image(s)). OCR is not enabled — cannot verify as Safe.`,
        ],
        risk_score: 50,
        policy_decision: 'warn',
        decision_summary: 'Warning: Image-only PDF — incomplete scan. Manual inspection required.',
        blocking_reasons: [],
        score_breakdown: [],
        formula_explanation: 'Incomplete scan of image-only PDF assigned caution score 50/100.',
        category_counts: {},
        total_findings: 0,
      };
    }

    const findings: Finding[] = [];
    for (const p of pages) {
      if (p.text.trim()) {
        findings.push(...engine.scanTextSegment(p.text, 'pdf', `Page ${p.page}`, { page: p.page }));
      }
    }
    for (const m of metadataItems) {
      findings.push(...engine.scanTextSegment(m.value, 'pdf', m.label, { metadata: true }));
    }

    const unsupported: string[] = [];
    let isIncomplete = emptyPageCount > 0;
    if (emptyPageCount) unsupported.push(`${emptyPageCount} page(s) have no readable text; review them manually.`);
    if (embeddedImagesCount > 0) {
      isIncomplete = true;
      unsupported.push(
        `Detected ${embeddedImagesCount} embedded image(s) across ${embeddedImagePages} page(s); image pixels are not OCR-inspected.`
      );
    }

    const combined = pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n--- Page Break ---\n\n');
    const ev = engine.evaluatePolicyAndScore(findings, isIncomplete);

    return {
      source_type: 'pdf',
      safe_source_label: `PDF Document (${safeName})`,
      filename: safeName,
      raw_text: combined,
      page_texts: pages,
      findings,
      is_incomplete: isIncomplete,
      coverage_notes: `Scanned ${numpages} page(s), ${totalText.length} character(s) extracted${metadataItems.length ? `, ${metadataItems.length} metadata field(s)` : ''}${embeddedImagesCount ? `, ${embeddedImagesCount} uninspected embedded image(s)` : ''}.`,
      unsupported_elements: unsupported,
      ...ev,
    };
  } catch (err: any) {
    return {
      source_type: 'pdf',
      safe_source_label: `PDF Document (${safeName})`,
      raw_text: '',
      findings: [],
      is_incomplete: true,
      coverage_notes: `PDF parse error: ${err.message}`,
      unsupported_elements: [`Corrupted or encrypted PDF: ${err.message}`],
      risk_score: 50,
      policy_decision: 'warn',
      decision_summary: `Warning: PDF could not be parsed (${err.message}) — Incomplete scan.`,
      blocking_reasons: [],
      score_breakdown: [],
      formula_explanation: 'Corrupted or encrypted PDF cannot be marked Safe (caution score 50/100).',
      category_counts: {},
      total_findings: 0,
    };
  } finally {
    if (parser && typeof parser.destroy === 'function') {
      await parser.destroy().catch(() => {});
    }
  }
}

// ─── DOCX Parser (Word OpenXML via JSZip) ────────────────────────────────────

function decodeXmlEntities(xml: string): string {
  return xml
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractWordXmlParagraphs(xml: string): string[] {
  const paragraphs: string[] = [];
  const pMatches = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
  for (const pXml of pMatches) {
    const withBreaks = pXml
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:br\b[^>]*\/>/g, '\n');
    const runs = [...withBreaks.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => decodeXmlEntities(m[1]));
    const text = runs.join('').trim();
    if (text) paragraphs.push(text);
  }
  return paragraphs;
}

export async function parseAndScanDocx(buf: Buffer, filename: string, engine: DetectionEngine): Promise<ScanResult> {
  const safeName = filename.replace(/^.*[\\/]/, '');
  let JSZip: any;
  try {
    JSZip = (await import('jszip')).default;
  } catch {
    throw new Error('JSZip library unavailable for DOCX parsing.');
  }

  const zip = await JSZip.loadAsync(buf);
  const findings: Finding[] = [];
  const unsupported: string[] = [];
  const previewBlocks: string[] = [];
  let paragraphCount = 0;
  let extraSections = 0;

  // 1. Main document body
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    return {
      source_type: 'docx',
      safe_source_label: `Word Document (${safeName})`,
      filename: safeName,
      raw_text: '',
      findings: [],
      is_incomplete: true,
      coverage_notes: 'Missing word/document.xml inside DOCX archive.',
      unsupported_elements: ['Malformed or encrypted DOCX archive cannot be verified as Safe.'],
      risk_score: 50,
      policy_decision: 'warn',
      decision_summary: 'Warning: Malformed DOCX file — Incomplete scan.',
      blocking_reasons: [],
      score_breakdown: [],
      formula_explanation: 'Incomplete scan defaults to Warn (50/100).',
      category_counts: {},
      total_findings: 0,
    };
  }

  const docXml = await docFile.async('string');
  const docParas = extractWordXmlParagraphs(docXml);
  docParas.forEach((p, idx) => {
    paragraphCount++;
    previewBlocks.push(p);
    findings.push(...engine.scanTextSegment(p, 'docx', `Paragraph ${idx + 1}`, { paragraph: idx + 1 }));
  });

  // 2. Headers, Footers & Comments
  const extraFiles = Object.keys(zip.files).filter((name) =>
    /^word\/(header\d*|footer\d*|comments)\.xml$/i.test(name)
  );
  for (const partName of extraFiles) {
    const partXml = await zip.file(partName).async('string');
    const paras = extractWordXmlParagraphs(partXml);
    const shortLabel = partName.replace(/^word\//, '').replace(/\.xml$/i, '');
    if (paras.length > 0) extraSections++;
    paras.forEach((p, idx) => {
      previewBlocks.push(`[${shortLabel}] ${p}`);
      findings.push(
        ...engine.scanTextSegment(p, 'docx', `${shortLabel} (Line ${idx + 1})`, { section: shortLabel, line: idx + 1 })
      );
    });
  }

  // 3. Embedded images check in word/media/
  const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith('word/media/') && !zip.files[name].dir);
  let isIncomplete = false;
  if (mediaFiles.length > 0) {
    isIncomplete = true;
    unsupported.push(`Document contains ${mediaFiles.length} embedded media file(s) in word/media/ that cannot be OCR-inspected.`);
  }

  const rawText = previewBlocks.join('\n');
  if (!rawText.trim() && mediaFiles.length > 0) {
    isIncomplete = true;
    unsupported.push('No selectable text found; document contains only embedded images.');
  }

  const ev = engine.evaluatePolicyAndScore(findings, isIncomplete);
  return {
    source_type: 'docx',
    safe_source_label: `Word Document (${safeName})`,
    filename: safeName,
    raw_text: rawText,
    findings,
    is_incomplete: isIncomplete,
    coverage_notes: `Scanned ${paragraphCount} paragraph(s)${extraSections ? `, ${extraSections} header/footer/comment section(s)` : ''}${mediaFiles.length ? `, ${mediaFiles.length} uninspected embedded image(s)` : ''}.`,
    unsupported_elements: unsupported,
    ...ev,
  };
}

// ─── JSON Parser (JSONPath Leaf Pinning) ────────────────────────────────────

export function parseAndScanJson(buf: Buffer, filename: string, engine: DetectionEngine): ScanResult {
  const safeName = filename.replace(/^.*[\\/]/, '');
  let content: string;
  try {
    content = buf.toString('utf-8').replace(/^\uFEFF/, '');
  } catch {
    content = buf.toString('latin1');
  }

  try {
    const parsed = JSON.parse(content);
    const findings: Finding[] = [];
    let fieldCount = 0;

    const walk = (node: any, jsonPath: string, keyName?: string) => {
      if (node === null || node === undefined) return;
      if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
        fieldCount++;
        const val = String(node);
        // Check value itself
        findings.push(...engine.scanTextSegment(val, 'json', jsonPath, { path: jsonPath }));
        // Also check "key: value" pair for inline secrets like "password": "mysecret123"
        if (keyName) {
          const kvLine = `${keyName}: ${val}`;
          const kvMatches = engine.scanTextSegment(kvLine, 'json', jsonPath, { path: jsonPath });
          for (const m of kvMatches) {
            if (!findings.some((f) => f.location === m.location && f.matched_value === m.matched_value)) {
              findings.push(m);
            }
          }
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((item, idx) => walk(item, `${jsonPath}[${idx}]`));
        return;
      }
      if (typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? `${jsonPath}.${k}` : `${jsonPath}["${k}"]`;
          walk(v, nextPath, k);
        }
      }
    };

    walk(parsed, '$');
    const ev = engine.evaluatePolicyAndScore(findings);
    return {
      source_type: 'json',
      safe_source_label: `JSON Document (${safeName})`,
      filename: safeName,
      raw_text: content,
      findings,
      is_incomplete: false,
      coverage_notes: `Parsed valid JSON tree and inspected ${fieldCount} scalar field(s) with JSONPath pinning.`,
      unsupported_elements: [],
      ...ev,
    };
  } catch {
    const fallback = parseAndScanPrompt(content, engine);
    fallback.source_type = 'json';
    fallback.safe_source_label = `JSON Text (${safeName})`;
    fallback.filename = safeName;
    fallback.coverage_notes = 'Malformed JSON syntax — inspected all lines via plain text scanner.';
    return fallback;
  }
}
