import React from 'react';
import { Sparkles, ArrowRight, AlertCircle, Info, RefreshCw } from 'lucide-react';
import { AutoFixResult, Finding } from '../types';
import { getDecisionBadgeProps } from '../utils/rules';
import { UniquesButton } from './UniquesButton';

interface BeforeAfterViewerProps {
  originalContent: string;
  autoFixResult: AutoFixResult | null;
  findings: Finding[];
  isAutoFixing: boolean;
  onRunAutoFix: () => void;
  userConfirmed: boolean;
  onToggleUserConfirmed: (checked: boolean) => void;
  canProceed: boolean;
  blockReason?: string;
}

export const BeforeAfterViewer: React.FC<BeforeAfterViewerProps> = ({
  originalContent,
  autoFixResult,
  findings,
  isAutoFixing,
  onRunAutoFix,
  userConfirmed,
  onToggleUserConfirmed,
  blockReason,
  canProceed,
}) => {
  const reScanDecision = autoFixResult?.re_scan_policy_decision || 'warn';
  const badgeProps = getDecisionBadgeProps(reScanDecision);

  return (
    <div className="bg-white dark:bg-[#161616] rounded-[16px] border border-[#e2e8f0] dark:border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] p-6 mb-6">
      {/* Header and Auto-Fix Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex items-start gap-3">
          <span className="border-l-2 border-[#ca0019] h-10 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-[#ca0019]" />
              <span>Smart Auto-Fix &amp; Review</span>
            </h3>
            <p className="text-xs text-gray-600 dark:text-neutral-400 mt-0.5">
              Abstracts sensitive items into numbered placeholders with strict re-scan validation.
            </p>
          </div>
        </div>

        <UniquesButton
          onClick={onRunAutoFix}
          disabled={isAutoFixing || findings.length === 0 || Boolean(blockReason)}
        >
          <span className="inline-flex items-center gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${isAutoFixing ? 'animate-spin' : ''}`} />
            <span>{isAutoFixing ? 'Masking...' : 'Run Smart Auto-Fix'}</span>
          </span>
        </UniquesButton>
      </div>

      {blockReason && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{blockReason}</p>}
      {/* Auto-Fix Summary / Placeholder mapping strip */}
      {autoFixResult && (
        <div className="my-4 p-4 rounded-xl bg-neutral-900 text-neutral-100 border border-neutral-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
            <div>
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Assigned Numbered Placeholders ({Object.keys(autoFixResult.placeholder_map).length} unique entities)
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(autoFixResult.placeholder_map).map(([raw, ph], i) => (
                  <span
                    key={i}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-xs font-mono"
                    title={`Raw value: ${raw}`}
                  >
                    <span className="text-neutral-400 truncate max-w-[140px]">{raw}</span>
                    <ArrowRight className="w-3 h-3 text-neutral-500" />
                    <span className="font-bold text-red-400">{ph}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Re-Scan Verification Badge */}
            <div className="shrink-0 bg-neutral-800 p-3 rounded-lg border border-neutral-700 text-right">
              <div className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">
                Re-Scan Verification
              </div>
              <div className="flex items-center justify-end space-x-1.5 mt-1">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${badgeProps.bg}`}>
                  {autoFixResult.re_scan_policy_decision.toUpperCase()}
                </span>
                <span className="text-xs text-neutral-200 font-bold">
                  Score: {autoFixResult.re_scan_risk_score}/100
                </span>
              </div>
              <div className="text-[10px] text-neutral-400 mt-1 max-w-[180px] leading-tight">
                {autoFixResult.re_scan_summary}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-neutral-400 mt-2.5 flex items-center space-x-1.5">
            <Info className="w-3.5 h-3.5 text-[#ca0019] shrink-0" />
            <span>
              Deterministic Mapping: Identical repeated values within the scan share the same consistent placeholder.
            </span>
          </p>
        </div>
      )}

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* Left: Original Content */}
        <div className="flex flex-col border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-neutral-900">
          <div className="px-4 py-2.5 bg-slate-100 dark:bg-neutral-800/80 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider flex items-center space-x-1.5">
              <span>Original Content</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-neutral-700 text-slate-700 dark:text-neutral-200">
                {findings.length} Finding(s)
              </span>
            </span>
            <span className="text-[11px] text-neutral-500">Unmodified Source</span>
          </div>
          <div className="p-4 font-mono text-xs text-slate-800 dark:text-neutral-200 whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed bg-white dark:bg-[#141416]">
            {originalContent || <span className="text-neutral-400 italic">No content available to preview.</span>}
          </div>
        </div>

        {/* Right: Sanitized Content */}
        <div className="flex flex-col border border-red-200 dark:border-red-500/20 rounded-xl overflow-hidden bg-red-50/20 dark:bg-neutral-900">
          <div className="px-4 py-2.5 bg-red-50/70 dark:bg-red-950/30 border-b border-red-200/70 dark:border-red-500/20 flex items-center justify-between">
            <span className="text-xs font-bold text-[#ca0019] dark:text-red-400 uppercase tracking-wider flex items-center space-x-1.5">
              <span>Sanitized Preview</span>
              {autoFixResult && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ca0019] text-white font-bold">
                  Auto-Fixed
                </span>
              )}
            </span>
            <span className="text-[11px] text-red-700 dark:text-red-300">
              {autoFixResult ? 'Numbered Placeholders Applied' : findings.length ? 'Pending Auto-Fix' : 'No masking needed'}
            </span>
          </div>
          <div className="p-4 font-mono text-xs text-slate-800 dark:text-neutral-200 whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed bg-white dark:bg-[#141416]">
            {autoFixResult ? (
              autoFixResult.sanitized_content
            ) : (
              findings.length === 0 && !blockReason ? originalContent : <div className="text-neutral-400 italic py-6 text-center">{blockReason ? 'Export remains locked for this scan.' : 'Run Smart Auto-Fix to generate a masked preview.'}</div>
            )}
          </div>
        </div>
      </div>

      {autoFixResult?.export_note && <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">{autoFixResult.export_note}</p>}
      {/* Explicit Legal & Anonymization Note */}
      <div className="mt-4 p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700/40 text-amber-900 dark:text-amber-200 text-xs flex items-start space-x-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">Notice on Personal Information &amp; Names:</div>
          <p className="mt-0.5 opacity-90">
            Detected names and contextual details are included in masking. The context model can miss unfamiliar wording; review the full preview because automatic masking does not guarantee complete anonymity.
          </p>
        </div>
      </div>

      {/* Explicit User Confirmation Checkbox */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between">
        <label className="flex items-start space-x-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={userConfirmed}
            disabled={!canProceed}
            onChange={(e) => onToggleUserConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#ca0019] focus:ring-[#ca0019] accent-[#ca0019] cursor-pointer"
          />
          <span className="text-xs font-semibold text-gray-800 dark:text-neutral-200 group-hover:text-black dark:group-hover:text-white select-none">
            I have reviewed the before/after comparison and verify that all sensitive details are masked before export or simulated submission.
          </span>
        </label>
      </div>
    </div>
  );
};
