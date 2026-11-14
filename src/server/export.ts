import { Buffer } from 'buffer';
import { getEngine, Sanitizer } from './engine';
import { parseAndScanXlsx, parseAndScanCsv, sanitizeXlsx } from './parsers';

/** Validate the actual release payload against today's policy, not just an old UI badge. */
export async function prepareExport(data: any, format: string) {
  if (data.is_incomplete) throw new Error('Incomplete scan. This file cannot be exported.');
  if (data.policy_decision === 'block') throw new Error('This scan is blocked. Edit the source and scan again.');
  const engine = getEngine();
  const sanitized = data.sanitized_data;
  if (data.findings?.length && !sanitized) throw new Error('Run Smart Auto-Fix before exporting.');
  if (sanitized && (sanitized.re_scan_policy_decision === 'block' || sanitized.re_scan_findings?.length)) throw new Error('Sensitive findings remain after masking. Review and scan again.');
  if (!['txt', 'csv', 'xlsx'].includes(format)) throw new Error('Unsupported export format.');
  let body: string | Buffer;
  let contentType: string;
  if (format === 'xlsx') {
    if (data.source_type !== 'xlsx' || !data.file_bytes) throw new Error('XLSX export requires an Excel source.');
    // Always produce a genuine, value-only workbook, including when there were no findings.
    const built = await sanitizeXlsx(data.file_bytes, data.findings || [], engine);
    const checked = await parseAndScanXlsx(built.buffer, 'sanitized_export.xlsx', engine);
    if (checked.is_incomplete || checked.findings.length || checked.policy_decision !== 'allow') throw new Error('The exported workbook did not pass verification.');
    body = built.buffer;
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else {
    if (format === 'csv') {
      if (data.source_type !== 'csv' || !data.csv_rows) throw new Error('CSV export is available for CSV/TSV sources. Use XLSX to preserve Excel worksheets.');
      // Normalize TSV and alternate delimiters to actual comma-separated CSV.
      body = Sanitizer.sanitizeCsv(data.csv_rows, data.findings || [], engine, ',').sanitized_content;
      contentType = 'text/csv; charset=utf-8';
    } else {
      body = sanitized?.sanitized_content ?? data.raw_text ?? '';
      contentType = 'text/plain; charset=utf-8';
    }
    const findings = data.source_type === 'csv'
      ? parseAndScanCsv(Buffer.from(String(body)), !sanitized && format !== 'csv' && data.csv_delimiter === '\t' ? 'check.tsv' : 'check.csv', engine).findings
      : engine.scanTextSegment(String(body), 'prompt', 'Export verification', {});
    if (findings.length || engine.evaluatePolicyAndScore(findings).policy_decision !== 'allow') throw new Error('The current policy found sensitive content in this export. Scan again.');
  }
  return {body, contentType, filename: `sanitized_export.${format}`};
}
