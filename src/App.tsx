/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  Shield,
  AlertTriangle,
  FileSpreadsheet,
  FileCode,
  Search,
  Sparkles,
  Lock,
  Activity,
  CheckCircle2,
  ShieldAlert,
  Layers,
  Eye,
} from 'lucide-react';

import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { RiskMeter } from './components/RiskMeter';
import { FindingsList } from './components/FindingsList';
import { BeforeAfterViewer } from './components/BeforeAfterViewer';
import { ExportControls } from './components/ExportControls';
import { AuditHistory } from './components/AuditHistory';
import { PolicySettings } from './components/PolicySettings';
import { DemoSamplesModal } from './components/DemoSamplesModal';
import { UniquesButton } from './components/UniquesButton';
import { InkTransition } from './ink/inkTransition';
import type { Theme } from './ink/types';

import { ScanResult, AutoFixResult, Finding, AuditStats } from './types';

const CAPABILITY_TAGS = [
  'Email Detection',
  'Phone Numbers',
  'Account IDs',
  'API Keys & Tokens',
  'Confidential Keywords',
  'DeepFile Guard',
  'Smart Auto-Fix',
  'Formula Safety',
  'Zero-Exposure Audit',
];

const MARQUEE_CARDS = [
  { tag: 'XLSX Guard', title: 'Sheet1!B2 Cell Pinning', desc: 'Inspects spreadsheets without executing formulas.', badge: 'Structural Export' },
  { tag: 'PDF Guard', title: 'Page-Level Text Audit', desc: 'Honest text extraction — zero fake black-box overlays.', badge: 'PyMuPDF / Parse' },
  { tag: 'Auto-Fix', title: '[EMAIL_1] Consistency', desc: 'Repeated sensitive values get deterministic placeholders.', badge: 'Re-Scan Verified' },
  { tag: 'Policy Gate', title: 'Strict Block Override', desc: 'Low risk scores never override critical secret rules.', badge: 'Backend Enforced' },
  { tag: 'Audit Trail', title: 'Zero Raw PII Saved', desc: 'Logs metadata counts only — raw prompts stay ephemeral.', badge: 'Compliance Ready' },
  { tag: 'CSV Guard', title: 'Row & Column Tracking', desc: 'Handles quoted fields and masks sensitive columns cleanly.', badge: 'RFC-4180 Safe' },
];

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentTab, setCurrentTab] = useState<'scanner' | 'audit' | 'policy'>('scanner');
  const [inputMode, setInputMode] = useState<'prompt' | 'file'>('prompt');
  const [promptText, setPromptText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [autoFixResult, setAutoFixResult] = useState<AutoFixResult | null>(null);
  const [userConfirmed, setUserConfirmed] = useState(false);

  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [rulesCount, setRulesCount] = useState(5);
  const [auditStats, setAuditStats] = useState<AuditStats>({
    total_scans: 0,
    avg_risk_score: 0,
    decisions: { allow: 0, warn: 0, block: 0 },
    sources: {},
    actions: {},
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const themeToggleRef = useRef<HTMLButtonElement>(null);
  const inkRef = useRef<InkTransition | null>(null);
  const themeRef = useRef<Theme>('light');
  const [footerHeight, setFooterHeight] = useState(320);

  // Sync dark mode ref & class on <html>
  useEffect(() => {
    themeRef.current = isDarkMode ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // Initialize WebGL2 Ink Bleed Theme Transition controller once
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.id = 'ink-bleed-canvas';
    canvas.className = 'ink-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    const ink = new InkTransition(canvas, themeToggleRef.current, themeRef.current);
    inkRef.current = ink;

    const TEXT_ENTRY =
      'input:not([type="range"]):not([type="checkbox"]):not([type="button"]), textarea, select, [contenteditable="true"]';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest(TEXT_ENTRY)) return;
      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleToggleDarkMode();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      ink.destroy();
      inkRef.current = null;
      canvas.remove();
    };
  }, []);

  const handleToggleDarkMode = (point?: { x: number; y: number }) => {
    const applyThemeDom = (next: Theme) => {
      themeRef.current = next;
      document.documentElement.classList.toggle('dark', next === 'dark');
      setIsDarkMode(next === 'dark');
    };
    if (inkRef.current) {
      inkRef.current.attachToggle(themeToggleRef.current, themeRef.current);
      void inkRef.current.toggle(themeRef.current, applyThemeDom, point);
    } else {
      applyThemeDom(themeRef.current === 'dark' ? 'light' : 'dark');
    }
  };

  // Measure sticky reveal footer height (exact layout-bottom-clip pattern from theuniques.in)
  useEffect(() => {
    const updateFooterHeight = () => {
      if (footerRef.current) {
        setFooterHeight(footerRef.current.offsetHeight);
      }
    };
    updateFooterHeight();
    window.addEventListener('resize', updateFooterHeight);
    return () => window.removeEventListener('resize', updateFooterHeight);
  }, [currentTab]);

  // Scroll to top when switching tabs
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab]);

  // Refresh pre-captured ink snapshot lazily when visible UI state changes
  useEffect(() => {
    inkRef.current?.invalidateCache(themeRef.current);
  }, [currentTab, inputMode, scanResult, autoFixResult]);

  const refreshStats = () => {
    fetch('/api/audit/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.total_scans === 'number') setAuditStats(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetch('/api/policy')
      .then((res) => res.json())
      .then((data) => {
        if (data.rules) setRulesCount(data.rules.length);
      })
      .catch(() => {});
    refreshStats();
  }, []);

  const scrollToScanner = () => {
    setCurrentTab('scanner');
    setTimeout(() => {
      scannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleScanPrompt = async () => {
    if (!promptText.trim()) return;
    setIsScanning(true);
    setScanError(null);
    setScanResult(null);
    setAutoFixResult(null);
    setUserConfirmed(false);
    setSelectedFinding(null);

    try {
      const res = await fetch('/api/scan/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to scan prompt.');
      }

      const data: ScanResult = await res.json();
      setScanResult(data);
      refreshStats();
    } catch (err: any) {
      setScanError(err.message || 'Error occurred during prompt scan.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanFile = async (fileToScan?: File) => {
    const file = fileToScan || selectedFile;
    if (!file) return;

    setIsScanning(true);
    setScanError(null);
    setScanResult(null);
    setAutoFixResult(null);
    setUserConfirmed(false);
    setSelectedFinding(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/scan/file', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to scan file.');
      }

      const data: ScanResult = await res.json();
      setScanResult(data);
      refreshStats();
    } catch (err: any) {
      setScanError(err.message || 'Error occurred during file scan.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleRunAutoFix = async () => {
    if (!scanResult) return;
    setIsAutoFixing(true);

    try {
      const res = await fetch('/api/autofix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: scanResult.session_id }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Auto-fix failed.');
      }

      const data: AutoFixResult = await res.json();
      setAutoFixResult(data);
      refreshStats();
    } catch (err: any) {
      alert(err.message || 'Error executing auto-fix.');
    } finally {
      setIsAutoFixing(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      handleScanFile(file);
    }
  };

  const handleLoadDemoFile = async (filename: string) => {
    setCurrentTab('scanner');
    setInputMode('file');
    try {
      const res = await fetch(`/api/demo/file/${filename}`);
      if (!res.ok) throw new Error('Could not fetch demo file.');
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type });
      setSelectedFile(file);
      await handleScanFile(file);
      setTimeout(() => {
        scannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoadPromptSample = (text: string) => {
    setCurrentTab('scanner');
    setInputMode('prompt');
    setPromptText(text);
    setTimeout(() => {
      scannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div className="relative min-h-screen bg-slate-200 dark:bg-[#111111]">
      {/* Sticky Top Navbar */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenDemos={() => setIsDemoModalOpen(true)}
        rulesCount={rulesCount}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onWarmTheme={() => inkRef.current?.warm(themeRef.current)}
        themeToggleRef={themeToggleRef}
      />

      {/* Main Content Surface with layout-bottom-clip over Fixed Footer */}
      <div
        className="relative z-10 bg-white dark:bg-[#0a0a0a] layout-bottom-clip overflow-x-clip min-h-screen"
        style={{
          marginBottom: `${footerHeight}px`,
          filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.1))',
        }}
      >
        {currentTab === 'audit' && <AuditHistory />}
        {currentTab === 'policy' && <PolicySettings />}

        {currentTab === 'scanner' && (
          <div>
            {/* ═══════════════════════════════════════════════════════════════════════ */}
            {/* SECTION 1: HERO (Exact structure of theuniques.in Home Hero)            */}
            {/* ═══════════════════════════════════════════════════════════════════════ */}
            <section className="w-full flex flex-col items-center justify-center bg-transparent relative pt-12 sm:pt-16 pb-6">
              <div className="relative z-10 w-full flex flex-col items-center">
                {/* Centered Brand Stamp */}
                <div className="text-lg font-medium text-gray-900 dark:text-white flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-xl bg-[#ca0019] flex items-center justify-center shadow-sm">
                    <Shield className="w-5 h-5 text-white stroke-[2.2]" />
                  </div>
                  <div>
                    <span className="text-[#ca0019] font-semibold">Prompt</span>Shield AI Community Guard
                  </div>
                </div>

                {/* Centered Hero Headline + Brushstroke Highlight */}
                <div className="text-center px-6 pt-10 pb-8">
                  <button
                    onClick={() => setIsDemoModalOpen(true)}
                    className="text-sm font-medium px-3.5 py-1 border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-full w-max mx-auto text-[#ca0019] mb-4 inline-block hover:border-[#ca0019] transition-colors cursor-pointer"
                  >
                    Pre-Upload AI Privacy Guard ✨
                  </button>

                  <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-[1.4]">
                    Inspect Prompts &amp; Files Before <br className="hidden sm:inline" />
                    <span className="brush-bg text-white [--brush-color:#ca0019] inline-block mt-2">
                      Sending to AI Models.
                    </span>
                  </h1>

                  <p className="text-gray-600 dark:text-neutral-400 my-5 max-w-2xl mx-auto text-base leading-relaxed">
                    Experience zero-leak AI workflows with PromptShield AI — deep file inspection, deterministic numbered placeholders, and strict compliance enforcement.
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
                    <UniquesButton onClick={scrollToScanner}>
                      Launch Scanner
                    </UniquesButton>
                    <button
                      onClick={() => setIsDemoModalOpen(true)}
                      className="px-6 py-2.5 rounded-full border border-slate-300 dark:border-neutral-700 text-sm font-semibold text-gray-800 dark:text-neutral-200 hover:border-[#ca0019] hover:text-[#ca0019] transition-colors cursor-pointer bg-white dark:bg-neutral-900"
                    >
                      View Demo Script
                    </button>
                  </div>
                </div>

                {/* Capability Tag Strip */}
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-gray-400 dark:text-neutral-500 text-sm mb-8 px-4 max-w-4xl">
                  {CAPABILITY_TAGS.map((tag, idx) => (
                    <span key={idx}>{tag}</span>
                  ))}
                </div>
              </div>

              {/* Smooth Horizontal Marquee Feature Strip */}
              <div className="w-full overflow-hidden py-4 relative z-10 bg-transparent">
                <div className="animate-marquee flex gap-4">
                  {[...MARQUEE_CARDS, ...MARQUEE_CARDS].map((card, idx) => (
                    <div
                      key={idx}
                      className="min-w-[280px] max-w-[290px] mx-2 p-5 rounded-xl shadow-md bg-white dark:bg-[#161616] border border-slate-200/80 dark:border-white/[0.08] flex flex-col justify-between relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-10 h-10 bg-[#ca0019]/5 rounded-bl-2xl" />
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#ca0019]">
                          {card.tag}
                        </span>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mt-1">
                          {card.title}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-neutral-400 mt-1.5 leading-relaxed">
                          {card.desc}
                        </p>
                      </div>
                      <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                          {card.badge}
                        </span>
                        <span className="w-2 h-2 rounded-full bg-[#ca0019]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════════ */}
            {/* SECTION 2: INTERACTIVE SCANNER WORKSPACE                                */}
            {/* ═══════════════════════════════════════════════════════════════════════ */}
            <section id="scanner-workspace" ref={scannerRef} className="py-10 sm:py-14 relative">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header matching WhyUs-CBiS3OHg.js */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                  <div>
                    <div className="flex mb-2 items-center">
                      <span className="border-l-2 border-[#ca0019] h-5 mr-3" />
                      <span className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-neutral-300">
                        Active Inspection Engine
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                      Prompt &amp; <span className="text-[#ca0019]">DeepFile Guard</span> Scanner
                    </h2>
                  </div>

                  {/* Quick Test Pills */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 font-semibold">Quick Test:</span>
                    <button
                      onClick={() => handleLoadDemoFile('customers.xlsx')}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#161616] hover:border-[#ca0019] text-gray-800 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700 flex items-center space-x-1.5 cursor-pointer transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#ca0019]" />
                      <span>customers.xlsx</span>
                    </button>
                    <button
                      onClick={() =>
                        handleLoadPromptSample(
                          'INTERNAL ONLY & STRICTLY CONFIDENTIAL: Project Titan acquisition secret quotation is $4,850,000. Use production API key sk-live99482710492817491028 to query the confidential partner ledger.'
                        )
                      }
                      className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#ca0019]/10 hover:bg-[#ca0019] text-[#ca0019] hover:text-white border border-[#ca0019]/20 cursor-pointer transition-colors"
                    >
                      Blocked Sample
                    </button>
                    <button
                      onClick={() =>
                        handleLoadPromptSample(
                          'Support escalation: Customer Priya Sharma (email: priya.sharma@example.com, phone: +1-555-0199) requested an urgent renewal for account ACC-67890. Please draft an email to resolve this.'
                        )
                      }
                      className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40 cursor-pointer transition-colors"
                    >
                      Warn Sample
                    </button>
                  </div>
                </div>

                {/* Main Input Card */}
                <div className="bg-white dark:bg-[#161616] rounded-[20px] border border-[#e2e8f0] dark:border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] p-6 sm:p-8 mb-8">
                  {/* Tabs: Prompt vs File */}
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-neutral-800 pb-4 mb-6">
                    <button
                      onClick={() => setInputMode('prompt')}
                      className={`flex items-center space-x-2 px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        inputMode === 'prompt'
                          ? 'bg-[#ca0019] text-white shadow-sm'
                          : 'text-neutral-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>Prompt Text Scanner</span>
                    </button>

                    <button
                      onClick={() => setInputMode('file')}
                      className={`flex items-center space-x-2 px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        inputMode === 'file'
                          ? 'bg-[#ca0019] text-white shadow-sm'
                          : 'text-neutral-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>DeepFile Guard (PDF / DOCX / XLSX / CSV / JSON / TXT)</span>
                    </button>
                  </div>

                  {/* Error Message */}
                  {scanError && (
                    <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/30 text-red-900 dark:text-red-200 text-xs flex items-center space-x-3">
                      <AlertTriangle className="w-5 h-5 text-[#ca0019] shrink-0" />
                      <span className="font-semibold">{scanError}</span>
                    </div>
                  )}

                  {/* Mode 1: Prompt Text Input */}
                  {inputMode === 'prompt' && (
                    <div>
                      <div className="relative">
                        <textarea
                          value={promptText}
                          onChange={(e) => setPromptText(e.target.value)}
                          placeholder="Paste your AI prompt, system instructions, or confidential query here to scan for sensitive information..."
                          rows={6}
                          className="w-full rounded-2xl border border-slate-200 dark:border-neutral-800 p-4 font-mono text-xs text-slate-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#ca0019] focus:border-[#ca0019] transition-all bg-slate-50/50 dark:bg-neutral-900"
                        />
                        <div className="text-[11px] text-neutral-400 text-right mt-1.5">
                          {promptText.length} characters &bull; {promptText.split('\n').length} lines
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <button
                          onClick={() => setPromptText('')}
                          disabled={!promptText}
                          className="text-xs font-semibold text-neutral-400 hover:text-[#ca0019] disabled:opacity-40 cursor-pointer"
                        >
                          Clear Prompt
                        </button>

                        <UniquesButton
                          onClick={handleScanPrompt}
                          disabled={isScanning || !promptText.trim()}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Search className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                            <span>{isScanning ? 'Inspecting...' : 'Scan Prompt'}</span>
                          </span>
                        </UniquesButton>
                      </div>
                    </div>
                  )}

                  {/* Mode 2: DeepFile Guard File Upload */}
                  {inputMode === 'file' && (
                    <div>
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleFileDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 dark:border-neutral-700 hover:border-[#ca0019] bg-slate-50/60 dark:bg-neutral-900/50 hover:bg-red-50/20 dark:hover:bg-red-950/10 rounded-2xl p-8 text-center cursor-pointer transition-all"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.docx,.xlsx,.csv,.tsv,.json,.txt,.md,.log,.yaml,.yml,.xml,.html,.sql,.env,.ini,.conf,.dat"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setSelectedFile(file);
                              handleScanFile(file);
                            }
                            e.target.value = '';
                          }}
                          className="hidden"
                        />

                        <div className="w-14 h-14 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[#ca0019] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
                          <UploadCloud className="w-7 h-7 stroke-[2.2]" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                          {selectedFile ? selectedFile.name : 'Click to upload or drag & drop any document'}
                        </h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                          Supported: PDF, Word (.docx), Excel (.xlsx), CSV/TSV, JSON, TXT, Markdown, Logs, YAML, XML, SQL, ENV (up to 15MB)
                        </p>
                      </div>

                      {selectedFile && (
                        <div className="mt-4 p-3.5 rounded-xl bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <FileCode className="w-5 h-5 text-[#ca0019]" />
                            <div>
                              <div className="text-xs font-bold text-gray-900 dark:text-white">{selectedFile.name}</div>
                              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                {(selectedFile.size / 1024).toFixed(1)} KB &bull; {selectedFile.type || 'Document'}
                              </div>
                            </div>
                          </div>

                          <UniquesButton
                            onClick={() => handleScanFile()}
                            disabled={isScanning}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Search className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                              <span>{isScanning ? 'Parsing...' : 'Scan File'}</span>
                            </span>
                          </UniquesButton>
                        </div>
                      )}

                      {/* Preloaded Demo File Shortcuts */}
                      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-neutral-800">
                        <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                          Or load synthetic demo test files:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2.5">
                          <button
                            onClick={() => handleLoadDemoFile('customers.xlsx')}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-[#ca0019] text-left transition-all cursor-pointer"
                          >
                            <div className="font-bold text-xs text-gray-900 dark:text-white flex items-center space-x-1.5">
                              <FileSpreadsheet className="w-4 h-4 text-[#ca0019]" />
                              <span>customers.xlsx</span>
                            </div>
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                              Rahul &amp; Priya records at Sheet1!B2, Sheet1!C2
                            </div>
                          </button>

                          <button
                            onClick={() => handleLoadDemoFile('customer_escalations.pdf')}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-[#ca0019] text-left transition-all cursor-pointer"
                          >
                            <div className="font-bold text-xs text-gray-900 dark:text-white flex items-center space-x-1.5">
                              <FileText className="w-4 h-4 text-[#ca0019]" />
                              <span>customer_escalations.pdf</span>
                            </div>
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                              Page numbers with customer contacts
                            </div>
                          </button>

                          <button
                            onClick={() => handleLoadDemoFile('unsupported_binary.dat')}
                            className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-700/40 bg-purple-50/30 dark:bg-purple-950/20 hover:border-purple-400 text-left transition-all cursor-pointer"
                          >
                            <div className="font-bold text-xs text-purple-950 dark:text-purple-200 flex items-center space-x-1.5">
                              <AlertTriangle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              <span>unsupported_binary.dat</span>
                            </div>
                            <div className="text-[11px] text-purple-800 dark:text-purple-300 mt-0.5">
                              Triggers Incomplete / Unsupported warning
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* SCAN RESULTS DISPLAY */}
                {scanResult && (
                  <div className="animate-fadeIn">
                    <RiskMeter
                      score={scanResult.risk_score}
                      decision={scanResult.policy_decision}
                      decisionSummary={scanResult.decision_summary}
                      blockingReasons={scanResult.blocking_reasons}
                      scoreBreakdown={scanResult.score_breakdown}
                      formulaExplanation={scanResult.formula_explanation}
                      sourceLabel={scanResult.safe_source_label}
                      isIncomplete={scanResult.is_incomplete}
                      coverageNotes={scanResult.coverage_notes}
                      unsupportedElements={scanResult.unsupported_elements}
                    />

                    <FindingsList
                      findings={scanResult.findings}
                      selectedFindingId={selectedFinding?.id}
                      onSelectFinding={setSelectedFinding}
                    />

                    <BeforeAfterViewer
                      originalContent={scanResult.raw_text || ''}
                      autoFixResult={autoFixResult}
                      findings={scanResult.findings}
                      isAutoFixing={isAutoFixing}
                      onRunAutoFix={handleRunAutoFix}
                      userConfirmed={userConfirmed}
                      onToggleUserConfirmed={setUserConfirmed}
                      canProceed={autoFixResult ? autoFixResult.can_proceed : scanResult.policy_decision === 'allow'}
                    />

                    <ExportControls
                      sessionId={scanResult.session_id}
                      sourceType={scanResult.source_type}
                      policyDecision={scanResult.policy_decision}
                      reScanPolicyDecision={autoFixResult?.re_scan_policy_decision}
                      userConfirmed={userConfirmed}
                      canExport={Boolean(autoFixResult || scanResult.findings.length === 0)}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════════ */}
            {/* SECTION 3: LIVE TELEMETRY COUNTS (Exact Counts-1nft8zvi.js section)     */}
            {/* ═══════════════════════════════════════════════════════════════════════ */}
            <section className="pt-8 sm:pt-12 pb-8 sm:pb-12 bg-transparent relative overflow-hidden">
              {/* Background Decorative Elements matching theuniques.in */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#ca0019]/5 rounded-full -z-10" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#ca0019]/5 rounded-full -z-10" />
              <div className="absolute top-20 left-10 w-24 h-24 border border-[#ca0019]/10 rounded-xl rotate-12 -z-10" />
              <div className="absolute bottom-20 right-10 w-32 h-32 border border-[#ca0019]/10 rounded-xl -rotate-12 -z-10" />
              <div
                className="absolute inset-0 opacity-5 -z-10"
                style={{
                  backgroundImage: 'radial-gradient(#ca0019 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />

              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
                {/* Centered Eyebrow + Title */}
                <div className="text-center mb-12 relative flex flex-col items-center">
                  <div className="inline-block relative">
                    <h2 className="text-sm font-semibold text-[#ca0019] uppercase tracking-wide mb-2 relative z-10">
                      Live Telemetry
                    </h2>
                    <div className="absolute h-2 w-full bottom-0 left-0 bg-[#ca0019]/10 -z-0" />
                  </div>
                  <p className="mt-4 text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white relative inline-block">
                    <span>Making Privacy </span>
                    <span>Effortless</span>
                    <span className="absolute -right-6 -top-6 text-6xl text-[#ca0019]/10 font-serif">
                      &rdquo;
                    </span>
                  </p>
                </div>

                {/* 4 Stat Cards Grid */}
                <div className="grid grid-cols-2 gap-3.5 sm:gap-6 lg:gap-8 lg:grid-cols-4">
                  {[
                    { value: auditStats.total_scans, label: 'Total Inspections', icon: <Activity className="h-5 w-5" /> },
                    { value: auditStats.avg_risk_score, label: 'Avg Risk Score', icon: <Eye className="h-5 w-5" /> },
                    { value: auditStats.decisions.allow, label: 'Allowed Payloads', icon: <CheckCircle2 className="h-5 w-5" /> },
                    { value: auditStats.decisions.block, label: 'Blocked Violations', icon: <ShieldAlert className="h-5 w-5" /> },
                  ].map((stat, idx) => (
                    <div
                      key={idx}
                      className="bg-white/60 dark:bg-[#161616] backdrop-blur-lg p-4 sm:p-6 rounded-lg shadow-[0_4px_20px_-4px_rgba(202,0,25,0.1)] hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-slate-200/70 dark:border-white/[0.08] group relative overflow-hidden flex flex-col items-center sm:items-start text-center sm:text-left"
                    >
                      <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 pointer-events-none">
                        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-[#ca0019]/5 to-transparent" />
                        <div className="absolute top-0 right-0 w-3 h-3 sm:w-4 sm:h-4 bg-[#ca0019]/10 rounded-bl-xl" />
                      </div>

                      <div className="flex items-center justify-center sm:justify-start w-full mb-3 sm:mb-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-[#ca0019]/20 to-[#ca0019]/10 flex items-center justify-center sm:mr-4 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                          <span className="text-[#ca0019] group-hover:rotate-12 transition-transform duration-300">
                            {stat.icon}
                          </span>
                        </div>
                        <div className="hidden sm:block h-px flex-grow bg-gradient-to-r from-[#ca0019]/30 via-gray-200 dark:via-neutral-700 to-transparent" />
                      </div>

                      <div className="mb-2 sm:mb-3 w-full">
                        <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white inline-flex items-center">
                          <span>{stat.value}</span>
                          <span className="text-base sm:text-lg font-bold text-[#ca0019] ml-1 animate-pulse">
                            +
                          </span>
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-gray-600 dark:text-neutral-400 font-medium leading-snug">
                        {stat.label}
                      </p>

                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 h-0.5 w-1/3 sm:w-1/5 bg-[#ca0019]/30 group-hover:w-full group-hover:bg-[#ca0019] transition-all duration-500 ease-out" />
                    </div>
                  ))}
                </div>

                {/* Centered Divider Dot */}
                <div className="mt-12 relative">
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 w-24 h-px bg-gradient-to-r from-transparent via-[#ca0019]/30 to-transparent" />
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 w-3 h-3 bg-white dark:bg-[#0a0a0a] border-2 border-[#ca0019]/30 rounded-full -mt-1.5" />
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════════ */}
            {/* SECTION 4: BENTO ARCHITECTURE GRID (Exact WhyUs-CBiS3OHg.js section)    */}
            {/* ═══════════════════════════════════════════════════════════════════════ */}
            <section className="w-full pt-6 sm:pt-10 pb-10 sm:pb-14">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col justify-start">
                  <div className="flex mb-4 items-center">
                    <span className="border-l-2 border-[#ca0019] h-6 mr-3" />
                    <span className="text-sm md:text-lg font-bold capitalize text-gray-900 dark:text-white">
                      Deterministic Protection
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-4xl font-semibold leading-relaxed text-gray-900 dark:text-white">
                    Driving <span className="brush-bg text-white">Security</span> Through
                    <span className="text-[#ca0019] text-2xl md:text-5xl md:py-2 block mb-4">
                      Explainable Policy Enforcement
                    </span>
                  </h2>
                </div>

                <div className="grid grid-cols-3 gap-6 mt-4">
                  {/* Large White Card 1 */}
                  <div className="col-span-3 lg:col-span-2">
                    <div className="bg-white dark:bg-[#161616] border border-slate-200/80 dark:border-white/[0.08] shadow-xl rounded-xl overflow-hidden h-full p-6 sm:p-8 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-[#ca0019]/10 text-[#ca0019] flex items-center justify-center">
                          <Layers className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#ca0019]">
                          DeepFile Guard
                        </span>
                      </div>
                      <h5 className="font-semibold text-xl capitalize mb-2 text-gray-900 dark:text-white">
                        Exact Cell, Row &amp; Page Pinning
                      </h5>
                      <p className="text-sm text-gray-600 dark:text-neutral-400 leading-relaxed">
                        Pins Excel matches down to exact worksheet coordinates (e.g. <code>Sheet1!B2</code>), tracks CSV row/column pairs, extracts PDF page numbers honestly, and flags unreadable binary files instead of claiming Safe.
                      </p>
                    </div>
                  </div>

                  {/* Crimson Highlight Card 1 */}
                  <div className="col-span-3 lg:col-span-1">
                    <div className="bg-[#ca0019] text-white shadow-xl rounded-xl overflow-hidden h-full p-6 flex flex-col justify-center">
                      <div className="mb-4">
                        <Sparkles className="w-8 h-8" />
                      </div>
                      <h5 className="font-semibold capitalize mb-2 text-xl">
                        Smart Auto-Fix
                      </h5>
                      <p className="text-sm text-white/90 leading-relaxed">
                        Substitutes allowed identifiers with deterministic placeholders like <code>[EMAIL_1]</code> and <code>[ACCOUNT_1]</code>, then immediately re-scans before permitting export.
                      </p>
                    </div>
                  </div>

                  {/* Crimson Highlight Card 2 */}
                  <div className="col-span-3 lg:col-span-1">
                    <div className="bg-red-800 text-white shadow-xl rounded-xl overflow-hidden h-full p-6 flex flex-col justify-center">
                      <div className="mb-4">
                        <Lock className="w-8 h-8" />
                      </div>
                      <h3 className="font-semibold capitalize mb-2 text-xl">
                        Backend Policy Gate
                      </h3>
                      <p className="text-sm text-white/90 leading-relaxed">
                        Blocked API keys and confidential keywords are enforced directly on the server — low risk scores or Auto-Fix never silently override a strict block rule.
                      </p>
                    </div>
                  </div>

                  {/* Large White Card 2 */}
                  <div className="col-span-3 lg:col-span-2">
                    <div className="bg-white dark:bg-[#161616] border border-slate-200/80 dark:border-white/[0.08] shadow-xl rounded-xl overflow-hidden h-full p-6 sm:p-8 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-[#ca0019]/10 text-[#ca0019] flex items-center justify-center">
                          <Shield className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#ca0019]">
                          Zero-Exposure Compliance
                        </span>
                      </div>
                      <h3 className="font-semibold capitalize mb-2 text-xl text-gray-900 dark:text-white">
                        Privacy-Preserving Audit Trail
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-neutral-400 leading-relaxed">
                        Every scan, auto-fix, and export logs anonymous telemetry counts and risk scores only. Raw prompts, uploaded payloads, and placeholder mapping keys expire ephemerally.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════════ */}
            {/* SECTION 5: BOTTOM CTA CLIP BANNER (Exact CallToAction-Bn3vS-43.js)      */}
            {/* ═══════════════════════════════════════════════════════════════════════ */}
            <div className="pt-2 sm:pt-4 pb-12 sm:pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="relative w-full mx-auto my-2 sm:my-4">
                <div
                  className="cta-clip w-full lg:h-72 h-80 flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #1a0407 0%, #7d0010 50%, #ca0019 100%)',
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                      backgroundSize: '24px 24px',
                    }}
                  />
                  <div className="relative z-10 text-center px-6">
                    <h1 className="text-3xl sm:text-4xl font-bold py-2 text-white">
                      Test Live Protection{' '}
                      <span className="brush-bg text-white [--brush-color:#000]">Today</span>
                    </h1>
                    <p className="text-white/90 p-2 sm:p-3 text-base sm:text-lg max-w-xl mx-auto">
                      Walk through customers.xlsx cell scanning, strict blocking, and safe exports in under two minutes.
                    </p>
                    <div className="flex justify-center items-center mt-2">
                      <UniquesButton
                        onClick={() => setIsDemoModalOpen(true)}
                        bgColor="#ca0019"
                        color="#ffffff"
                        iconColor="#000000"
                      >
                        Open Demo Script
                      </UniquesButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Sticky-Reveal Footer (Exact layout-bottom-clip reveal pattern from G6) */}
      <div ref={footerRef} className="fixed bottom-0 left-0 w-full z-0">
        <Footer
          onSelectTab={setCurrentTab}
          onOpenDemos={() => setIsDemoModalOpen(true)}
        />
      </div>

      {/* Demo Walkthrough Modal */}
      <DemoSamplesModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        onLoadPrompt={handleLoadPromptSample}
        onLoadDemoFile={handleLoadDemoFile}
      />
    </div>
  );
}
