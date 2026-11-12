import React from 'react';
import { X, Sparkles, FileSpreadsheet, FileText, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface DemoSamplesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadPrompt: (text: string) => void;
  onLoadDemoFile: (fileName: string) => void;
}

export const DemoSamplesModal: React.FC<DemoSamplesModalProps> = ({
  isOpen,
  onClose,
  onLoadPrompt,
  onLoadDemoFile
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-[#161616] rounded-[24px] border border-slate-200 dark:border-neutral-800 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-neutral-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#ca0019] flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Hackathon Demo Script &amp; Synthetic Test Scenarios
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Click any scenario to instantly test PromptShield AI&apos;s detection, scoring, and auto-fix.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-[#ca0019] hover:bg-red-50 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Core Evaluation Case: customers.xlsx */}
        <div className="my-5 p-4 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#ca0019]" />
                <span className="font-bold text-sm text-gray-900 dark:text-white">
                  Scenario 1: Synthetic customers.xlsx
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ca0019] text-white">
                  Core Evaluation
                </span>
              </div>
              <p className="text-xs text-gray-700 dark:text-neutral-300 mt-1.5 leading-relaxed">
                Contains Rahul (<code>rahul@example.com</code>, <code>ACC-12345</code>) and Priya (<code>priya@example.com</code>, <code>ACC-67890</code>).
                DeepFile Guard pins exact cell locations at <strong>Sheet1!B2, Sheet1!C2, Sheet1!B3, Sheet1!C3</strong>, assigns <code>[EMAIL_1]</code>, <code>[ACCOUNT_1]</code>, and exports a structural XLSX.
              </p>
            </div>

            <div className="flex flex-row sm:flex-col gap-1.5 shrink-0">
              <button
                onClick={() => {
                  onLoadDemoFile('customers.xlsx');
                  onClose();
                }}
                className="px-4 py-1.5 rounded-full bg-[#ca0019] hover:bg-[#b00016] text-white font-bold text-xs shadow-sm flex items-center space-x-1 cursor-pointer"
              >
                <span>Scan XLSX Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <a
                href="/api/demo/file/customers.xlsx"
                download="customers.xlsx"
                className="px-4 py-1 rounded-full bg-white dark:bg-neutral-900 border border-red-200 dark:border-neutral-700 text-[#ca0019] dark:text-red-400 hover:bg-red-50 font-semibold text-[11px] text-center"
              >
                Download File
              </a>
            </div>
          </div>
        </div>

        {/* Prompt Test Scenarios */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
            Prompt Evaluation Scenarios
          </h4>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-xs text-gray-900 dark:text-white">Normal Prompt (Allowed)</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/40 rounded-full">
                  Score: 0 &bull; ALLOW
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 max-w-lg">
                &ldquo;Can you explain how Dijkstra&apos;s shortest path algorithm works and provide a clean Python implementation?&rdquo;
              </p>
            </div>
            <button
              onClick={() => {
                onLoadPrompt("Can you explain how Dijkstra's shortest path algorithm works and provide a clean Python implementation with time complexity analysis?");
                onClose();
              }}
              className="px-4 py-1.5 rounded-full bg-neutral-900 dark:bg-neutral-800 text-white hover:bg-[#ca0019] text-xs font-bold shrink-0 ml-3 cursor-pointer transition-colors"
            >
              Load
            </button>
          </div>

          <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-700/40 bg-amber-50/30 dark:bg-amber-950/20 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-xs text-amber-950 dark:text-amber-200">Sensitive Escalation Prompt (Warning)</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/40 rounded-full">
                  WARN
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5 max-w-lg">
                Customer support note containing personal email (<code>priya.sharma@example.com</code>), telephone number, and account ID (<code>ACC-67890</code>).
              </p>
            </div>
            <button
              onClick={() => {
                onLoadPrompt("Support escalation: Customer Priya Sharma (email: priya.sharma@example.com, phone: +1-555-0199) requested an urgent renewal for account ACC-67890. Please draft an email to resolve this.");
                onClose();
              }}
              className="px-4 py-1.5 rounded-full bg-amber-600 text-white hover:bg-amber-500 text-xs font-bold shrink-0 ml-3 cursor-pointer"
            >
              Load
            </button>
          </div>

          <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/40 dark:bg-red-950/20 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-[#ca0019]" />
                <span className="font-bold text-xs text-red-950 dark:text-red-200">Confidential Quotation Sample (Strict Block)</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-[#ca0019] text-white rounded-full">
                  Score: 100 &bull; BLOCK
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5 max-w-lg">
                Contains prohibited terms: &ldquo;INTERNAL ONLY&rdquo;, &ldquo;CONFIDENTIAL&rdquo;, &ldquo;secret quotation&rdquo;, and production API key <code>sk-live9948271...</code>.
              </p>
            </div>
            <button
              onClick={() => {
                onLoadPrompt("INTERNAL ONLY & STRICTLY CONFIDENTIAL: Project Titan acquisition secret quotation is $4,850,000. Use production API key sk-live99482710492817491028 to query the confidential partner ledger.");
                onClose();
              }}
              className="px-4 py-1.5 rounded-full bg-[#ca0019] text-white hover:bg-[#b00016] text-xs font-bold shrink-0 ml-3 cursor-pointer"
            >
              Load
            </button>
          </div>
        </div>

        {/* File Format Test Scenarios */}
        <div className="mt-5 space-y-3">
          <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
            File Format Test Scenarios
          </h4>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#ca0019]" />
                <span className="font-bold text-xs text-gray-900 dark:text-white">customer_escalations.pdf</span>
                <span className="text-[10px] text-neutral-500">Page number tracking</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Multi-page operations memo with page numbers and email contacts.
              </p>
            </div>
            <button
              onClick={() => {
                onLoadDemoFile('customer_escalations.pdf');
                onClose();
              }}
              className="px-4 py-1.5 rounded-full bg-neutral-900 dark:bg-neutral-800 text-white hover:bg-[#ca0019] text-xs font-bold shrink-0 cursor-pointer transition-colors"
            >
              Scan PDF
            </button>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-xs text-gray-900 dark:text-white">customers.csv</span>
                <span className="text-[10px] text-neutral-500">Row and column tracking</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Comma-separated file with header detection: Row 2 Col 2, Row 3 Col 3.
              </p>
            </div>
            <button
              onClick={() => {
                onLoadDemoFile('customers.csv');
                onClose();
              }}
              className="px-4 py-1.5 rounded-full bg-neutral-900 dark:bg-neutral-800 text-white hover:bg-[#ca0019] text-xs font-bold shrink-0 cursor-pointer transition-colors"
            >
              Scan CSV
            </button>
          </div>

          <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-700/40 bg-purple-50/40 dark:bg-purple-950/20 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-purple-700 dark:text-purple-400" />
                <span className="font-bold text-xs text-purple-950 dark:text-purple-200">unsupported_binary.dat</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full">
                  Incomplete / Unsupported Test
                </span>
              </div>
              <p className="text-[11px] text-purple-900 dark:text-purple-300 mt-0.5">
                Demonstrates that unparsed files produce an explicit &ldquo;Incomplete scan / Unsupported&rdquo; error rather than falsely claiming &ldquo;Safe&rdquo;.
              </p>
            </div>
            <button
              onClick={() => {
                onLoadDemoFile('unsupported_binary.dat');
                onClose();
              }}
              className="px-4 py-1.5 rounded-full bg-purple-700 text-white hover:bg-purple-600 text-xs font-bold shrink-0 cursor-pointer"
            >
              Test Unsupported
            </button>
          </div>
        </div>

        {/* Hackathon Demo Script */}
        <div className="mt-6 p-4 rounded-2xl bg-neutral-900 text-neutral-200 text-xs border border-neutral-800">
          <div className="font-bold text-[#ca0019] uppercase tracking-wider mb-2">
            2-Minute Hackathon Demo Script for Judges:
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-neutral-300">
            <li><strong>Step 1:</strong> Click <em>Scan XLSX Now</em> above to load <code>customers.xlsx</code>. Show findings at <code>Sheet1!B2, Sheet1!C2, Sheet1!B3, Sheet1!C3</code>.</li>
            <li><strong>Step 2:</strong> Click <em>Run Smart Auto-Fix</em>. Point out numbered placeholders <code>[EMAIL_1]</code>, <code>[ACCOUNT_1]</code> and re-scan clearance.</li>
            <li><strong>Step 3:</strong> Tick user review confirmation and click <em>Download Sanitized XLSX</em> or <em>Send to AI (Simulated)</em>.</li>
            <li><strong>Step 4:</strong> Load the <em>Confidential Quotation Sample</em>. Notice it immediately flags <strong>BLOCK</strong> due to strict API key and confidential keyword rules. Auto-Fix will NOT bypass this policy.</li>
            <li><strong>Step 5:</strong> Switch to <em>Audit History</em>. Demonstrate that all records are anonymized with ZERO raw prompts or sensitive personal data stored.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
