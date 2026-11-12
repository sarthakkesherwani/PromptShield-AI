import React, { useState } from 'react';
import { Mail, Phone, CreditCard, Key, ShieldAlert, AlertCircle, MapPin, Lock, ShieldCheck, IdCard } from 'lucide-react';
import { Finding } from '../types';
import { getSeverityBadgeProps } from '../utils/rules';

interface FindingsListProps {
  findings: Finding[];
  onSelectFinding?: (finding: Finding) => void;
  selectedFindingId?: string;
}

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  onSelectFinding,
  selectedFindingId
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(findings.map((f) => f.category)))];

  const filteredFindings = selectedCategory === 'all'
    ? findings
    : findings.filter((f) => f.category === selectedCategory);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'email':
        return <Mail className="w-4 h-4 text-[#ca0019]" />;
      case 'phone':
        return <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'account_id':
        return <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'gov_id':
        return <IdCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'credit_card':
        return <CreditCard className="w-4 h-4 text-[#ca0019]" />;
      case 'api_key':
        return <Key className="w-4 h-4 text-[#ca0019]" />;
      case 'confidential_keyword':
        return <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-neutral-600" />;
    }
  };

  if (findings.length === 0) {
    return (
      <div className="bg-white dark:bg-[#161616] rounded-[16px] border border-[#e2e8f0] dark:border-white/[0.08] p-8 text-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-6">
        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white">No Sensitive Findings Detected</h3>
        <p className="text-sm text-gray-600 dark:text-neutral-400 max-w-md mx-auto mt-1">
          The document or prompt text satisfies all active policy rules. No emails, phone numbers, account identifiers, API keys, or confidential phrases were matched.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#161616] rounded-[16px] border border-[#e2e8f0] dark:border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex items-start gap-3">
          <span className="border-l-2 border-[#ca0019] h-10 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>DeepFile Guard Findings</span>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#ca0019] text-white">
                {findings.length}
              </span>
            </h3>
            <p className="text-xs text-gray-600 dark:text-neutral-400 mt-0.5">
              Rule-based matches with exact source file coordinates and severity levels.
            </p>
          </div>
        </div>

        {/* Category filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#ca0019] text-white'
                  : 'bg-slate-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-red-50 hover:text-[#ca0019]'
              }`}
            >
              {cat === 'all' ? `All (${findings.length})` : `${cat.replace('_', ' ')} (${findings.filter(f => f.category === cat).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Findings cards */}
      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
        {filteredFindings.map((finding) => {
          const sevProps = getSeverityBadgeProps(finding.severity);
          const isSelected = selectedFindingId === finding.id;

          return (
            <div
              key={finding.id}
              onClick={() => onSelectFinding?.(finding)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#ca0019] bg-red-50/40 dark:bg-red-950/20 shadow-sm ring-1 ring-[#ca0019]'
                  : 'border-slate-200 dark:border-neutral-800 hover:border-[#ca0019]/50 bg-white dark:bg-neutral-900/60 hover:bg-slate-50/60 dark:hover:bg-neutral-900'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-[#ca0019]/10 mt-0.5 shrink-0">
                    {getCategoryIcon(finding.category)}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-gray-900 dark:text-white capitalize">
                        {finding.category.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${sevProps.classes}`}>
                        {sevProps.label}
                      </span>
                      {finding.is_blocking && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#ca0019]/10 text-[#ca0019] border border-[#ca0019]/30 flex items-center space-x-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Strict Blocking Rule</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-600 dark:text-neutral-400 mt-1">
                      {finding.explanation}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                      <span className="text-neutral-600 dark:text-neutral-300 font-mono text-[11px] bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded border border-slate-200 dark:border-neutral-700">
                        Match: &ldquo;{finding.matched_value}&rdquo;
                      </span>
                      {finding.placeholder && (
                        <span className="text-[#ca0019] dark:text-red-400 font-mono text-[11px] font-bold bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded border border-red-200 dark:border-red-500/30">
                          &rarr; {finding.placeholder}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Location Badge */}
                <div className="shrink-0 text-right">
                  <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-neutral-900 dark:bg-neutral-800 text-white font-mono text-xs font-semibold shadow-xs border border-neutral-800 dark:border-neutral-700">
                    <MapPin className="w-3 h-3 text-[#ca0019]" />
                    <span>{finding.location}</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wider mt-1">
                    {finding.location_type.toUpperCase()} Source
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
