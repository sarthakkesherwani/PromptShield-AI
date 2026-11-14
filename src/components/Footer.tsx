import React from 'react';
import { Shield, Lock, FileSpreadsheet, History } from 'lucide-react';

interface FooterProps {
  onSelectTab: (tab: 'scanner' | 'audit' | 'policy') => void;
  onOpenDemos: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab, onOpenDemos }) => {
  return (
    <footer className="bg-slate-200 dark:bg-[#111111] dark:border-t dark:border-gray-800 lg:p-6 md:p-6 sm:p-6 p-4 py-12">
      <div className="max-w-7xl py-4 mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 border-b border-slate-300 dark:border-gray-800">
        {/* Col 1: Brand Summary */}
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#ca0019] flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              <span className="text-[#ca0019]">Prompt</span>Shield AI
            </span>
          </div>
          <p className="text-sm mb-4 text-slate-700 dark:text-gray-300 leading-relaxed">
            PromptShield AI is a hybrid rules and context ML privacy guard designed to detect sensitive data, enforce policies, and generate reviewable sanitized copies without saving raw PII.
          </p>
        </div>

        {/* Col 2: NAVIGATE */}
        <div className="px-3">
          <h4 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">NAVIGATE</h4>
          <ul className="text-sm space-y-2 text-slate-600 dark:text-gray-400">
            <li>
              <button
                onClick={() => onSelectTab('scanner')}
                className="hover:text-slate-900 dark:hover:text-white hover:underline transition-colors cursor-pointer"
              >
                Scanner Home
              </button>
            </li>
            <li>
              <button
                onClick={() => onSelectTab('audit')}
                className="hover:text-slate-900 dark:hover:text-white hover:underline transition-colors cursor-pointer"
              >
                Audit History
              </button>
            </li>
            <li>
              <button
                onClick={() => onSelectTab('policy')}
                className="hover:text-slate-900 dark:hover:text-white hover:underline transition-colors cursor-pointer"
              >
                Policy Rules
              </button>
            </li>
            <li>
              <button
                onClick={onOpenDemos}
                className="hover:text-slate-900 dark:hover:text-white hover:underline transition-colors cursor-pointer"
              >
                Demo Walkthrough
              </button>
            </li>
          </ul>
        </div>

        {/* Col 3: GUARD ENGINE */}
        <div className="px-3">
          <h4 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">GUARD ENGINE</h4>
          <ul className="text-sm space-y-2 text-slate-600 dark:text-gray-400">
            <li>DeepFile Guard (PDF/XLSX/CSV)</li>
            <li>Smart Auto-Fix Masking</li>
            <li>Mandatory Re-Scan Gate</li>
            <li>Strict Block Enforcement</li>
          </ul>
        </div>

        {/* Col 4: COMPLIANCE */}
        <div className="px-3">
          <h4 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">COMPLIANCE</h4>
          <ul className="text-sm space-y-2 text-slate-600 dark:text-gray-400">
            <li>Zero-Exposure Audit Logs</li>
            <li>No Raw Prompt Storage</li>
            <li>Formula Injection Guard</li>
            <li>Simulated AI Gateway</li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="max-w-7xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="text-sm text-center md:text-left text-slate-600 dark:text-gray-400">
          &copy; {new Date().getFullYear()} PromptShield AI Privacy Guard. Rules + Context ML &amp; Safe Export.
        </div>

        <div className="flex justify-center md:justify-end items-center space-x-3">
          <button
            onClick={() => onSelectTab('scanner')}
            title="Scanner"
            className="w-8 h-8 rounded-full flex justify-center items-center bg-slate-900 dark:bg-slate-700 hover:bg-[#ca0019] dark:hover:bg-[#ca0019] transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={() => onSelectTab('audit')}
            title="Audit History"
            className="w-8 h-8 rounded-full flex justify-center items-center bg-slate-900 dark:bg-slate-700 hover:bg-[#ca0019] dark:hover:bg-[#ca0019] transition-colors cursor-pointer"
          >
            <History className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={() => onSelectTab('policy')}
            title="Policy Settings"
            className="w-8 h-8 rounded-full flex justify-center items-center bg-slate-900 dark:bg-slate-700 hover:bg-[#ca0019] dark:hover:bg-[#ca0019] transition-colors cursor-pointer"
          >
            <Lock className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </footer>
  );
};
