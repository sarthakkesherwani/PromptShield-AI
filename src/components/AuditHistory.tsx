import React, { useState, useEffect } from 'react';
import { History, Shield, Trash2, Download, RefreshCw } from 'lucide-react';
import { AuditRecord, AuditStats } from '../types';
import { getDecisionBadgeProps } from '../utils/rules';
import { SubpageBanner } from './SubpageBanner';

export const AuditHistory: React.FC = () => {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterDecision, setFilterDecision] = useState<string>('all');

  const fetchAuditData = async () => {
    setIsLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch('/api/audit?limit=200'),
        fetch('/api/audit/stats')
      ]);
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
      if (statsRes.ok) {
        const sdata = await statsRes.json();
        setStats(sdata);
      }
    } catch (err) {
      console.error('Failed to load audit data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  const handleClear = async () => {
    if (!window.confirm('Are you sure you want to clear all audit records?')) return;
    try {
      await fetch('/api/audit', { method: 'DELETE' });
      fetchAuditData();
    } catch (err) {
      console.error('Failed to clear logs', err);
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const header = ['ID', 'Timestamp', 'Source Type', 'Safe Label', 'Risk Score', 'Policy Decision', 'Action Taken', 'Total Findings', 'Incomplete Scan'];
    const rows = logs.map(l => [
      l.id,
      l.timestamp,
      l.source_type,
      `"${l.safe_source_label.replace(/"/g, '""')}"`,
      l.risk_score,
      l.policy_decision,
      l.action_taken,
      l.total_findings,
      l.incomplete_scan ? 'Yes' : 'No'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [header.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `promptshield_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = filterDecision === 'all'
    ? logs
    : logs.filter(l => l.policy_decision === filterDecision);

  return (
    <div className="animate-fadeIn pb-16">
      <SubpageBanner
        subtitle="Zero-Exposure"
        chipLabel="Audit Metadata"
        title="Audit History → Compliance Trail ✦"
        description="Browser-saved scan decisions, risk scores, and sanitization actions. Clear history anytime on this device."
        icon={<History className="w-3.5 h-3.5 text-white" />}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Strict Privacy Guarantee Card (Signature Crimson / Charcoal Aesthetic) */}
        <div className="p-5 rounded-[16px] bg-neutral-900 dark:bg-[#161616] text-white border border-neutral-800 shadow-md mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#ca0019]/20 border border-[#ca0019]/40 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-[#ca0019]" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-red-400">
                Zero-Exposure Privacy Guarantee
              </h4>
              <p className="text-xs text-neutral-300 mt-1 leading-relaxed max-w-3xl">
                This audit log <strong>never stores raw prompts, sensitive matched values, personal filenames, uploaded file contents, or placeholder decipher keys</strong>. Only safe metadata is recorded.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={fetchAuditData}
              className="p-2.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-200 hover:border-[#ca0019] cursor-pointer transition-colors"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleExportCSV}
              disabled={logs.length === 0}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-white text-neutral-900 hover:bg-neutral-100 font-semibold text-xs disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleClear}
              disabled={logs.length === 0}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-[#ca0019] hover:bg-[#b00016] text-white font-semibold text-xs disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* KPI Stats Grid matching Counts-1nft8zvi */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Scans', value: stats.total_scans, color: 'text-gray-900 dark:text-white' },
              { label: 'Avg Risk Score', value: `${stats.avg_risk_score} / 100`, color: 'text-[#ca0019]' },
              {
                label: 'Allowed / Warned',
                value: (
                  <span>
                    <span className="text-emerald-600 dark:text-emerald-400">{stats.decisions.allow}</span>
                    <span className="text-neutral-400 mx-1">/</span>
                    <span className="text-amber-600 dark:text-amber-400">{stats.decisions.warn}</span>
                  </span>
                ),
                color: ''
              },
              { label: 'Blocked Violations', value: stats.decisions.block, color: 'text-[#ca0019]' },
            ].map((card, i) => (
              <div
                key={i}
                className="p-5 rounded-[16px] bg-white dark:bg-[#161616] border border-[#e2e8f0] dark:border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.03)] relative overflow-hidden group hover:-translate-y-0.5 transition-all"
              >
                <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  {card.label}
                </div>
                <div className={`text-2xl sm:text-3xl font-bold mt-1.5 ${card.color}`}>
                  {card.value}
                </div>
                <div className="absolute bottom-0 left-0 h-0.5 w-1/4 bg-[#ca0019]/30 group-hover:w-full group-hover:bg-[#ca0019] transition-all duration-500" />
              </div>
            ))}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mr-1">Filter:</span>
          {['all', 'allow', 'warn', 'block'].map(d => (
            <button
              key={d}
              onClick={() => setFilterDecision(d)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold capitalize transition-colors cursor-pointer ${
                filterDecision === d
                  ? 'bg-[#ca0019] text-white'
                  : 'bg-white dark:bg-[#161616] border border-slate-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-[#ca0019]'
              }`}
            >
              {d} {d !== 'all' && stats ? `(${stats.decisions[d as keyof typeof stats.decisions] || 0})` : ''}
            </button>
          ))}
        </div>

        {/* Logs Table */}
        <div className="bg-white dark:bg-[#161616] rounded-[16px] border border-[#e2e8f0] dark:border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-neutral-400">
              <History className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-700 mb-2" />
              <p className="text-sm">No audit records found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-neutral-800 text-left text-xs">
                <thead className="bg-slate-50 dark:bg-neutral-900 text-slate-700 dark:text-neutral-300 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3.5">Scan ID</th>
                    <th className="px-4 py-3.5">Timestamp</th>
                    <th className="px-4 py-3.5">Source &amp; Label</th>
                    <th className="px-4 py-3.5">Findings by Category</th>
                    <th className="px-4 py-3.5">Risk Score</th>
                    <th className="px-4 py-3.5">Policy Decision</th>
                    <th className="px-4 py-3.5">Action Taken</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80 bg-white dark:bg-[#161616]">
                  {filteredLogs.map(log => {
                    const badge = getDecisionBadgeProps(log.policy_decision);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-neutral-900/50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-neutral-200">
                          {log.id}
                        </td>
                        <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-900 dark:text-white">{log.safe_source_label}</span>
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700">
                            {log.source_type}
                          </span>
                          {log.incomplete_scan && (
                            <span className="block text-[10px] font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                              Incomplete scan
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {log.total_findings === 0 ? (
                            <span className="text-neutral-400">0 findings</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(log.finding_counts).map(([cat, cnt]) => (
                                <span key={cat} className="px-1.5 py-0.5 bg-slate-100 dark:bg-neutral-800 rounded text-[11px] font-mono text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700">
                                  {cat}: {cnt}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-bold font-mono text-sm ${
                            log.risk_score >= 70 ? 'text-[#ca0019]' : log.risk_score > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {log.risk_score}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border ${badge.bg}`}>
                            {log.policy_decision}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-neutral-600 dark:text-neutral-400 capitalize">
                          {log.action_taken.replace('_', ' ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
