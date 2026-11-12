import React, { useState } from 'react';
import { Download, Send, CheckCircle2, AlertTriangle, FileText, FileSpreadsheet, Lock } from 'lucide-react';
import { PolicyDecision } from '../types';
import { UniquesButton } from './UniquesButton';

interface ExportControlsProps {
  sessionId?: string;
  sourceType: 'prompt' | 'pdf' | 'docx' | 'xlsx' | 'csv' | 'json' | 'txt';
  policyDecision: PolicyDecision;
  reScanPolicyDecision?: PolicyDecision;
  userConfirmed: boolean;
  canExport: boolean;
  onSimulateSubmitSuccess?: (data: any) => void;
}

export const ExportControls: React.FC<ExportControlsProps> = ({
  sessionId,
  sourceType,
  policyDecision,
  reScanPolicyDecision,
  userConfirmed,
  canExport,
  onSimulateSubmitSuccess
}) => {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<any | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const effectiveDecision = reScanPolicyDecision || policyDecision;
  const isBlocked = effectiveDecision === 'block';
  const isAllowedToProceed = userConfirmed && !isBlocked && canExport;

  const handleDownload = async (format: 'txt' | 'csv' | 'xlsx') => {
    if (!sessionId) return;
    setErrorMessage(null);
    setIsExporting(format);

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          export_format: format,
          user_confirmed: userConfirmed
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Backend export policy rejected.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sanitized_export.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setErrorMessage(err.message || 'Export failed.');
    } finally {
      setIsExporting(null);
    }
  };

  const handleCopy = async () => {
    if (!isAllowedToProceed || !sessionId) return;
    setCopyStatus('');
    setErrorMessage(null);
    try {
      const response = await fetch('/api/export', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({session_id: sessionId, export_format: 'txt', user_confirmed: userConfirmed}) });
      if (!response.ok) throw new Error((await response.json()).detail || 'Export is not approved.');
      await navigator.clipboard.writeText(await response.text());
      setCopyStatus('Copied sanitized text');
    } catch { setErrorMessage('Could not copy. Use Download Sanitized TXT instead.'); }
  };

  const handleSimulateSubmit = async () => {
    if (!sessionId) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      const response = await fetch('/api/simulate-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_confirmed: userConfirmed
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Backend policy rejected simulated submission.');
      }

      const data = await response.json();
      setSubmitResponse(data);
      onSimulateSubmitSuccess?.(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Simulated submission rejected.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#161616] rounded-[16px] border border-[#e2e8f0] dark:border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex items-start gap-3">
          <span className="border-l-2 border-[#ca0019] h-10 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>Approved Export &amp; Simulated Submission</span>
            </h3>
            <p className="text-xs text-gray-600 dark:text-neutral-400 mt-0.5">
              Review the sanitized result before copying or downloading. AI submission below is a demo.
            </p>
          </div>
        </div>

        {isBlocked && (
          <div className="px-3.5 py-1.5 rounded-full bg-[#ca0019]/10 border border-[#ca0019]/30 text-[#ca0019] text-xs font-bold flex items-center space-x-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>Policy Blocked: Action Disabled</span>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="my-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/30 text-red-900 dark:text-red-200 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-[#ca0019] shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {sourceType === 'pdf' && (
        <div className="my-3 p-3 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-300 text-xs">
          <span className="font-bold text-[#ca0019]">PDF Sanitization Notice:</span> PromptShield exports a verified sanitized text extraction (.txt). We deliberately do not draw visual black overlay boxes on PDF pages, as layered underlying text streams can still be extracted from unflattened PDFs.
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button disabled={!isAllowedToProceed} onClick={handleCopy} className="rounded-full border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-800 disabled:opacity-40 dark:border-neutral-700 dark:text-white">Copy sanitized text</button>
        <span role="status" className="text-xs text-emerald-700 dark:text-emerald-400">{copyStatus}</span>
      </div>
      {/* Action Buttons */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => handleDownload('txt')}
          disabled={!isAllowedToProceed || isExporting !== null}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-full font-bold text-xs tracking-wide transition-all ${
            !isAllowedToProceed
              ? 'bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 border border-slate-200 dark:border-neutral-700 cursor-not-allowed'
              : 'bg-white dark:bg-neutral-900 hover:border-[#ca0019] text-slate-800 dark:text-white border border-slate-300 dark:border-neutral-700 cursor-pointer active:scale-95'
          }`}
        >
          <FileText className="w-4 h-4 text-[#ca0019]" />
          <span>{isExporting === 'txt' ? 'Exporting...' : 'Download Sanitized TXT'}</span>
        </button>

        {(sourceType === 'csv' || sourceType === 'xlsx') && (
          <button
            onClick={() => handleDownload('csv')}
            disabled={!isAllowedToProceed || isExporting !== null}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-full font-bold text-xs tracking-wide transition-all ${
              !isAllowedToProceed
                ? 'bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 border border-slate-200 dark:border-neutral-700 cursor-not-allowed'
                : 'bg-white dark:bg-neutral-900 hover:border-[#ca0019] text-slate-800 dark:text-white border border-slate-300 dark:border-neutral-700 cursor-pointer active:scale-95'
            }`}
          >
            <Download className="w-4 h-4 text-[#ca0019]" />
            <span>{isExporting === 'csv' ? 'Exporting...' : 'Download Sanitized CSV'}</span>
          </button>
        )}

        {sourceType === 'xlsx' && (
          <button
            onClick={() => handleDownload('xlsx')}
            disabled={!isAllowedToProceed || isExporting !== null}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-full font-bold text-xs tracking-wide transition-all ${
              !isAllowedToProceed
                ? 'bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 border border-slate-200 dark:border-neutral-700 cursor-not-allowed'
                : 'bg-white dark:bg-neutral-900 hover:border-[#ca0019] text-slate-800 dark:text-white border border-slate-300 dark:border-neutral-700 cursor-pointer active:scale-95'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{isExporting === 'xlsx' ? 'Exporting...' : 'Download Sanitized XLSX'}</span>
          </button>
        )}

        <div className="ml-auto">
          <UniquesButton
            onClick={handleSimulateSubmit}
            disabled={!isAllowedToProceed || isSubmitting}
            title="Send sanitized content to AI model gateway (Simulated Pre-Upload Check)"
          >
            <span className="inline-flex items-center gap-2">
              <Send className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-pulse' : ''}`} />
              <span>{isSubmitting ? 'Submitting...' : 'Send to AI (Simulated)'}</span>
            </span>
          </UniquesButton>
        </div>
      </div>

      {!userConfirmed && (
        <p className="text-[11px] text-neutral-400 mt-3 italic">
          * Export and simulated submission require ticking the review confirmation checkbox above.
        </p>
      )}

      {/* Simulated AI Gateway Response Card */}
      {submitResponse && (
        <div className="mt-5 p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              <span>AI Gateway Submission Successful (Simulated)</span>
            </div>
            <span className="text-[10px] text-neutral-400">
              Masked {submitResponse.masked_entities_count} PII entity(ies)
            </span>
          </div>

          <div className="mt-3 text-xs space-y-2">
            <div>
              <span className="text-neutral-400 font-semibold">Gateway Payload Preview: </span>
              <span className="font-mono text-red-400">{submitResponse.submitted_payload_snippet}</span>
            </div>
            <div className="p-3 bg-neutral-800/80 rounded-lg border border-neutral-700/80 mt-2">
              <div className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider mb-1">
                Simulated AI Model Response:
              </div>
              <p className="text-neutral-200 italic leading-relaxed">
                &ldquo;{submitResponse.simulated_ai_response}&rdquo;
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
