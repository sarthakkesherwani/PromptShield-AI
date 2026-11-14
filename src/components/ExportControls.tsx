import React, { useState } from 'react';
import { Copy, Download, CheckCircle2, AlertTriangle, Lock, Send } from 'lucide-react';
import { PolicyDecision } from '../types';

type ExportFormat = 'txt' | 'csv' | 'xlsx';
interface ExportControlsProps {
  sessionId?: string;
  sourceType: string;
  policyDecision: PolicyDecision;
  reScanPolicyDecision?: PolicyDecision;
  userConfirmed: boolean;
  canExport: boolean;
  isIncomplete?: boolean;
}

export const ExportControls: React.FC<ExportControlsProps> = ({sessionId, sourceType, policyDecision, reScanPolicyDecision, userConfirmed, canExport, isIncomplete}) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const blocked = policyDecision === 'block' || reScanPolicyDecision === 'block';
  const ready = Boolean(sessionId && userConfirmed && canExport && !blocked && !isIncomplete);
  const primary: ExportFormat = sourceType === 'xlsx' ? 'xlsx' : sourceType === 'csv' ? 'csv' : 'txt';
  const reason = isIncomplete ? 'Export unavailable: some content could not be inspected.' : blocked ? 'Export blocked by policy. Edit your source and scan again.' : !canExport ? 'First run Smart Auto-Fix and check the re-scan result.' : !userConfirmed ? 'Review the preview, then tick the confirmation above to unlock export.' : 'Ready. The exported content is checked again against your current policy.';

  const getExport = async (format: ExportFormat) => {
    const response = await fetch('/api/export', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({session_id:sessionId, export_format:format, user_confirmed:userConfirmed})});
    if (!response.ok) throw new Error((await response.json()).detail || 'Export failed. Please scan again.');
    return response;
  };
  const run = async (action: string, work: () => Promise<void>) => {
    if (!ready || busy) return;
    setBusy(action); setError(''); setMessage('');
    try { await work(); } catch (err: any) { setError(err.message || 'Could not complete the export. Try downloading TXT.'); }
    finally { setBusy(null); }
  };
  const download = (format: ExportFormat) => run(format, async () => {
    const response = await getExport(format);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url; link.download = `sanitized_export.${format}`;
    document.body.appendChild(link); link.click(); link.remove();
    // Mobile browsers may consume the object URL after the click handler finishes.
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    setMessage(`Download started: sanitized_export.${format}. Check your browser's downloads.`);
  });
  const copy = () => run('copy', async () => {
    const response = await getExport('txt');
    try { await navigator.clipboard.writeText(await response.text()); }
    catch { throw new Error('Clipboard access is unavailable. Download TXT instead.'); }
    setMessage('Sanitized text copied.');
  });
  const simulate = () => run('demo', async () => {
    const response = await fetch('/api/simulate-submit', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({session_id:sessionId,user_confirmed:userConfirmed})});
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Demo rejected by policy.');
    setMessage('Demo passed. No content was sent to an AI provider.');
  });
  const secondary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200';
  return <section aria-labelledby="export-title" className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-neutral-800 dark:bg-[#161616]">
    <div className="flex items-center gap-3">
      <span className="rounded-xl bg-red-50 p-2.5 text-[#ca0019] dark:bg-red-950/30"><Download className="h-5 w-5" /></span>
      <div><h3 id="export-title" className="font-bold text-slate-900 dark:text-white">Export your reviewed content</h3><p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">A local download. Your original file stays unchanged.</p></div>
    </div>
    <p className={`my-4 flex items-start gap-2 rounded-xl p-3 text-sm ${ready ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'bg-slate-50 text-slate-700 dark:bg-neutral-900 dark:text-neutral-300'}`}>
      {ready ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/> : <Lock className="mt-0.5 h-4 w-4 shrink-0"/>}{reason}
    </p>
    <p className="mb-4 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
      {sourceType === 'xlsx' ? 'XLSX keeps worksheets and cell positions as a value-only copy. Formulas, formatting, links, and original document metadata are not copied. TXT is a text preview, not an Excel file.' : sourceType === 'csv' ? 'CSV uses commas, preserves quoted fields and rows, and prefixes formula-like cells with an apostrophe so spreadsheets treat them as text.' : sourceType === 'pdf' || sourceType === 'docx' ? 'Exports extracted text as TXT. This does not create a redacted PDF or a formatted Word document.' : 'TXT contains the reviewed text with detected sensitive values replaced by placeholders where masking was required.'}
    </p>
    <div className="flex flex-wrap gap-2.5">
      <button disabled={!ready || Boolean(busy)} onClick={() => download(primary)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#ca0019] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-4 w-4"/>{busy === primary ? 'Preparing…' : `Download ${primary.toUpperCase()}`}</button>
      {primary !== 'txt' && <button disabled={!ready || Boolean(busy)} onClick={() => download('txt')} className={secondary}>Download TXT preview</button>}
      <button disabled={!ready || Boolean(busy)} onClick={copy} className={secondary}><Copy className="h-4 w-4"/>{busy === 'copy' ? 'Copying…' : 'Copy text'}</button>
    </div>
    {error && <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4 shrink-0"/>{error}</p>}
    {message && <p role="status" className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
    <details className="mt-5 border-t border-slate-100 pt-4 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"><summary className="cursor-pointer">Optional: test the AI handoff</summary><p className="my-3">A simulated policy check only. No AI provider is connected.</p><button disabled={!ready || Boolean(busy)} onClick={simulate} className={secondary}><Send className="h-4 w-4"/>Run handoff demo</button></details>
  </section>;
};
