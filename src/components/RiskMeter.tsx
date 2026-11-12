import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, Info, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { PolicyDecision, ScoreBreakdownItem } from '../types';
import { getDecisionBadgeProps } from '../utils/rules';

interface RiskMeterProps {
  score: number;
  decision: PolicyDecision;
  decisionSummary: string;
  blockingReasons: string[];
  scoreBreakdown: ScoreBreakdownItem[];
  formulaExplanation: string;
  sourceLabel?: string;
  isIncomplete: boolean;
  coverageNotes?: string;
  unsupportedElements?: string[];
}

export const RiskMeter: React.FC<RiskMeterProps> = ({
  score,
  decision,
  decisionSummary,
  blockingReasons,
  scoreBreakdown,
  formulaExplanation,
  sourceLabel,
  isIncomplete,
  coverageNotes,
  unsupportedElements = []
}) => {
  const [showFormula, setShowFormula] = useState(false);
  const badgeProps = getDecisionBadgeProps(decision);

  const getMeterColor = (val: number, dec: PolicyDecision) => {
    if (dec === 'block') return 'bg-[#ca0019]';
    if (val === 0) return 'bg-emerald-500';
    if (val <= 30) return 'bg-amber-400';
    if (val <= 69) return 'bg-amber-500';
    return 'bg-[#ca0019]';
  };

  return (
    <div className="bg-white dark:bg-[#161616] rounded-[16px] border border-[#e2e8f0] dark:border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] p-6 mb-6 transition-all relative overflow-hidden">
      {/* Top-right geometric corner accent matching theuniques.in */}
      <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none">
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-[#ca0019]/5 to-transparent" />
        <div className="absolute top-0 right-0 w-4 h-4 bg-[#ca0019]/10 rounded-bl-xl" />
      </div>

      {/* Top Header: Decision Badge & Score */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex items-center space-x-3.5">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            decision === 'allow'
              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : decision === 'warn'
              ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
              : 'bg-[#ca0019]/10 text-[#ca0019]'
          }`}>
            {decision === 'allow' && <ShieldCheck className="w-7 h-7 stroke-[2.2]" />}
            {decision === 'warn' && <AlertTriangle className="w-7 h-7 stroke-[2.2]" />}
            {decision === 'block' && <ShieldAlert className="w-7 h-7 stroke-[2.2]" />}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border ${badgeProps.bg}`}>
                POLICY: {badgeProps.label}
              </span>
              {isIncomplete && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50 flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  <span>Incomplete Scan / Unsupported</span>
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-gray-800 dark:text-neutral-200 mt-1.5">
              {decisionSummary}
            </p>
          </div>
        </div>

        {/* Risk Score Pill */}
        <div className="flex items-center space-x-3 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 px-4 py-2.5 rounded-xl self-start sm:self-auto">
          <div className="text-right">
            <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Heuristic Risk Score
            </div>
            <div className="flex items-baseline space-x-1 justify-end">
              <span className={`text-2xl font-bold ${
                decision === 'block'
                  ? 'text-[#ca0019]'
                  : score === 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {score}
              </span>
              <span className="text-xs font-medium text-neutral-400">/ 100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Progress Bar */}
      <div className="pt-4">
        <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1.5 font-medium">
          <span>0 (Safe / Allowed)</span>
          <span>11–69 (Warning Review)</span>
          <span>70–100 (Blocking Policy Threshold)</span>
        </div>
        <div className="w-full h-3 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden border border-slate-200 dark:border-neutral-700 flex">
          <div
            className={`h-full transition-all duration-500 rounded-full ${getMeterColor(score, decision)}`}
            style={{ width: `${Math.max(4, score)}%` }}
          />
        </div>
      </div>

      {/* Always-Visible Document Inspection & Coverage Summary */}
      {coverageNotes && (
        <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-slate-700 dark:text-neutral-200">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isIncomplete ? 'bg-purple-500' : 'bg-emerald-500'}`} />
            {sourceLabel && <span className="font-bold">{sourceLabel}:</span>}
            <span>{coverageNotes}</span>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            {isIncomplete ? 'Partial Coverage' : 'Full Text Coverage'}
          </span>
        </div>
      )}

      {/* Blocking Reasons Alert if any */}
      {blockingReasons && blockingReasons.length > 0 && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-500/20 text-red-950 dark:text-red-200 text-xs">
          <div className="flex items-center space-x-2 font-bold mb-1 text-[#ca0019] dark:text-red-400">
            <Lock className="w-4 h-4" />
            <span>Strict Blocking Violations (Low score cannot override blocking rules):</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 pl-1">
            {blockingReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* DeepFile Guard Incomplete Scan Warning */}
      {isIncomplete && unsupportedElements.length > 0 && (
        <div className="mt-3 p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-700/40 text-purple-900 dark:text-purple-200 text-xs">
          <div className="font-bold flex items-center space-x-1.5 mb-1">
            <AlertTriangle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>DeepFile Guard: Incomplete File Coverage</span>
          </div>
          <p className="mb-1 opacity-90">
            Some content could not be converted to plain selectable text streams:
          </p>
          <ul className="list-disc list-inside space-y-0.5 pl-1">
            {unsupportedElements.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] opacity-80 italic">
            Per policy, incomplete or uninspected files are marked with caution rather than assumed Safe.
          </p>
        </div>
      )}

      {/* Transparent Formula & Breakdown Toggle */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-neutral-800">
        <button
          onClick={() => setShowFormula(!showFormula)}
          className="flex items-center space-x-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:text-[#ca0019] dark:hover:text-red-400 transition-colors cursor-pointer"
        >
          <Info className="w-3.5 h-3.5 text-[#ca0019]" />
          <span>Transparent Heuristic Scoring Explanation</span>
          {showFormula ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showFormula && (
          <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs text-slate-700 dark:text-neutral-300 space-y-2.5">
            <p className="font-mono text-slate-800 dark:text-neutral-200 text-[11px] bg-white dark:bg-[#161616] p-2.5 rounded-lg border border-slate-200 dark:border-neutral-800">
              {formulaExplanation}
            </p>

            {scoreBreakdown && scoreBreakdown.length > 0 ? (
              <div>
                <div className="font-semibold text-slate-800 dark:text-white mb-1.5">Point Contributions by Category:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {scoreBreakdown.map((item, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-white dark:bg-[#161616] border border-slate-200 dark:border-neutral-800 flex justify-between items-center">
                      <div>
                        <span className="font-semibold capitalize text-slate-900 dark:text-white">{item.category}</span>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {item.count} finding(s) (base: {item.base_weight} &times; {item.multiplier})
                        </div>
                      </div>
                      <span className="font-bold text-[#ca0019] text-sm">+{item.points_added} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-neutral-500">Zero sensitive findings detected. Total score: 0 points.</p>
            )}

            {coverageNotes && (
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 border-t border-slate-200 dark:border-neutral-800 pt-2">
                <span className="font-medium text-slate-700 dark:text-neutral-200">Scan Coverage:</span> {coverageNotes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
