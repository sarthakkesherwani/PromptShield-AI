import React, { useState, useEffect } from 'react';
import { Sliders, Plus, X, RotateCcw, Save, CheckCircle2, Lock } from 'lucide-react';
import { PolicyRule, PolicySettings as PolicySettingsType } from '../types';
import { getSeverityBadgeProps } from '../utils/rules';
import { SubpageBanner } from './SubpageBanner';
import { UniquesButton } from './UniquesButton';

export const PolicySettings: React.FC = () => {
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [settings, setSettings] = useState<PolicySettingsType | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');

  const fetchPolicyData = async () => {
    try {
      const res = await fetch('/api/policy');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
        setSettings(data.settings || null);
      }
    } catch (err) {
      console.error('Failed to load policy', err);
    }
  };

  useEffect(() => {
    fetchPolicyData();
  }, []);

  const handleToggleRule = async (rule: PolicyRule) => {
    const updated = !rule.enabled;
    try {
      await fetch(`/api/policy/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: updated })
      });
      setRules(rules.map(r => (r.id === rule.id ? { ...r, enabled: updated } : r)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleActionChange = async (rule: PolicyRule, newAction: 'warn' | 'block') => {
    try {
      await fetch(`/api/policy/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy_action: newAction })
      });
      setRules(rules.map(r => (r.id === rule.id ? { ...r, policy_action: newAction } : r)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleWeightChange = async (rule: PolicyRule, newWeight: number) => {
    try {
      await fetch(`/api/policy/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight: newWeight })
      });
      setRules(rules.map(r => (r.id === rule.id ? { ...r, weight: newWeight } : r)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddKeyword = async (rule: PolicyRule) => {
    if (!newKeyword.trim()) return;
    const currentKeywords = rule.config.keywords || [];
    if (currentKeywords.includes(newKeyword.trim().toLowerCase())) return;

    const updatedKeywords = [...currentKeywords, newKeyword.trim().toLowerCase()];
    try {
      await fetch(`/api/policy/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { ...rule.config, keywords: updatedKeywords }
        })
      });
      setRules(rules.map(r => (r.id === rule.id ? { ...r, config: { ...r.config, keywords: updatedKeywords } } : r)));
      setNewKeyword('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveKeyword = async (rule: PolicyRule, kw: string) => {
    const currentKeywords = rule.config.keywords || [];
    const updatedKeywords = currentKeywords.filter(k => k !== kw);
    try {
      await fetch(`/api/policy/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { ...rule.config, keywords: updatedKeywords }
        })
      });
      setRules(rules.map(r => (r.id === rule.id ? { ...r, config: { ...r.config, keywords: updatedKeywords } } : r)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      const res = await fetch('/api/policy/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSaveStatus('Policy thresholds updated successfully!');
        setTimeout(() => setSaveStatus(null), 3500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Reset all detection rules and policy thresholds to system defaults?')) return;
    try {
      await fetch('/api/policy/reset', { method: 'POST' });
      fetchPolicyData();
      setSaveStatus('Reset to default policies.');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="animate-fadeIn pb-16">
      <SubpageBanner
        subtitle={`${rules.length} Rules Active`}
        chipLabel="DLP Engine"
        title="Policy Rules & Risk Thresholds ✦"
        description="Configure regex detection rules, confidential keyword dictionaries, risk weights, and strict blocking overrides."
        icon={<Sliders className="w-3.5 h-3.5 text-white" />}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-end mb-4">
          <button
            onClick={handleResetDefaults}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-white dark:bg-[#161616] border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-200 hover:border-[#ca0019] text-xs font-semibold shadow-xs cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#ca0019]" />
            <span>Reset to Defaults</span>
          </button>
        </div>

        {saveStatus && (
          <div className="mb-6 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-700/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{saveStatus}</span>
          </div>
        )}

        {/* Global Thresholds Card */}
        {settings && (
          <div className="bg-white dark:bg-[#161616] rounded-[16px] border border-[#e2e8f0] dark:border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-6 mb-8">
            <div className="flex items-start gap-3 mb-4">
              <span className="border-l-2 border-[#ca0019] h-10 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Global Policy Thresholds</h3>
                <p className="text-xs text-gray-600 dark:text-neutral-400 mt-0.5">
                  Determines how the 0–100 heuristic risk score translates into Allow, Warn, or Block decisions.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-700/40">
                <label className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase">Allow Threshold Max</label>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mb-2">Scores &le; this limit are Allowed</div>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={settings.allow_threshold}
                  onChange={(e) => setSettings({ ...settings, allow_threshold: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white dark:bg-neutral-900 border border-emerald-300 dark:border-emerald-700/50 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700/40">
                <label className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase">Warn Threshold Min</label>
                <div className="text-[11px] text-amber-700 dark:text-amber-400 mb-2">Scores in this range require review</div>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.warn_threshold}
                  onChange={(e) => setSettings({ ...settings, warn_threshold: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-700/50 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-4 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/30">
                <label className="text-xs font-bold text-[#ca0019] dark:text-red-400 uppercase">Block Threshold Min</label>
                <div className="text-[11px] text-red-700 dark:text-red-300 mb-2">Scores &ge; this limit are Blocked</div>
                <input
                  type="number"
                  min="30"
                  max="100"
                  value={settings.block_threshold}
                  onChange={(e) => setSettings({ ...settings, block_threshold: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white dark:bg-neutral-900 border border-red-300 dark:border-red-500/40 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Inviolable Constraint Toggle */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between gap-4">
              <div className="flex items-start space-x-2.5">
                <Lock className="w-4 h-4 text-[#ca0019] mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    Strict Blocking Rule Override (Mandatory Safety Principle)
                  </span>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    When enabled, any rule marked with &ldquo;Block&rdquo; immediately stops export, even if the total calculated risk score is low.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={settings.strict_blocking_override}
                  onChange={(e) => setSettings({ ...settings, strict_blocking_override: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ca0019]" />
              </label>
            </div>

            <div className="mt-5 flex justify-end">
              <UniquesButton onClick={handleSaveSettings}>
                <span className="inline-flex items-center gap-2">
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Thresholds</span>
                </span>
              </UniquesButton>
            </div>
          </div>
        )}

        {/* Active Detection Rules */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="border-l-2 border-[#ca0019] h-5" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Active Detection Rules</h3>
          </div>

          {rules.map((rule) => {
            const sevProps = getSeverityBadgeProps(rule.severity);
            const isConfidentialKeywords = rule.category === 'confidential_keyword';

            return (
              <div
                key={rule.id}
                className={`p-5 rounded-[16px] border transition-all ${
                  rule.enabled
                    ? 'bg-white dark:bg-[#161616] border-[#e2e8f0] dark:border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
                    : 'bg-slate-50 dark:bg-neutral-900/40 border-slate-200 dark:border-neutral-800 opacity-60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-neutral-800">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggleRule(rule)}
                      className="h-4 w-4 rounded border-slate-300 accent-[#ca0019] cursor-pointer"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-gray-900 dark:text-white">{rule.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sevProps.classes}`}>
                          {sevProps.label}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{rule.description}</p>
                    </div>
                  </div>

                  {/* Policy Action Selector & Weight */}
                  <div className="flex items-center space-x-3 self-end sm:self-auto">
                    <div className="flex items-center space-x-1 bg-slate-100 dark:bg-neutral-800 p-1 rounded-full">
                      <button
                        onClick={() => handleActionChange(rule, 'warn')}
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-colors cursor-pointer ${
                          rule.policy_action === 'warn'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                        }`}
                      >
                        Warn
                      </button>
                      <button
                        onClick={() => handleActionChange(rule, 'block')}
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-colors cursor-pointer ${
                          rule.policy_action === 'block'
                            ? 'bg-[#ca0019] text-white shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                        }`}
                      >
                        Block
                      </button>
                    </div>

                    <div className="flex items-center space-x-1 text-xs">
                      <span className="text-neutral-400 font-medium">Weight:</span>
                      <input
                        type="number"
                        min="5"
                        max="60"
                        value={rule.weight}
                        onChange={(e) => handleWeightChange(rule, parseInt(e.target.value) || 10)}
                        className="w-14 bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-lg px-2 py-1 text-xs font-bold text-center text-gray-900 dark:text-white"
                      />
                      <span className="text-neutral-400">pts</span>
                    </div>
                  </div>
                </div>

                {isConfidentialKeywords && (
                  <div className="mt-3 pt-2">
                    <div className="text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-2">
                      Configured Confidential Phrases &amp; Keywords:
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {(rule.config.keywords || []).map((kw: string) => (
                        <span
                          key={kw}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700 text-xs font-medium"
                        >
                          <span>&ldquo;{kw}&rdquo;</span>
                          <button
                            onClick={() => handleRemoveKeyword(rule, kw)}
                            className="hover:text-[#ca0019] ml-1 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center space-x-2 max-w-md">
                      <input
                        type="text"
                        placeholder="Add custom keyword (e.g. secret quotation, project codename)..."
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword(rule)}
                        className="flex-1 bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-full px-4 py-1.5 text-xs text-slate-800 dark:text-white placeholder:text-neutral-400"
                      />
                      <button
                        onClick={() => handleAddKeyword(rule)}
                        className="px-4 py-1.5 rounded-full bg-[#ca0019] hover:bg-[#b00016] text-white text-xs font-bold flex items-center space-x-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
