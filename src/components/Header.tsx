import React, { useState } from 'react';
import { Shield, Menu, X, FileCheck, History, Sliders, Sparkles, ChevronRight } from 'lucide-react';

interface HeaderProps {
  currentTab: 'scanner' | 'audit' | 'policy';
  onSelectTab: (tab: 'scanner' | 'audit' | 'policy') => void;
  onOpenDemos: () => void;
  rulesCount: number;
  isDarkMode: boolean;
  onToggleDarkMode: (point?: { x: number; y: number }) => void;
  onWarmTheme?: () => void;
  themeToggleRef?: React.RefObject<HTMLButtonElement | null>;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenDemos,
  rulesCount,
  isDarkMode,
  onToggleDarkMode,
  onWarmTheme,
  themeToggleRef,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    { id: 'scanner' as const, label: 'SCANNER', mobileLabel: 'Scanner Workspace', icon: <FileCheck className="w-4 h-4" /> },
    { id: 'audit' as const, label: 'AUDIT LOGS', mobileLabel: 'Audit History', icon: <History className="w-4 h-4" /> },
    { id: 'policy' as const, label: 'POLICY RULES', mobileLabel: `Policy Rules (${rulesCount})`, icon: <Sliders className="w-4 h-4" /> },
  ];

  const handleNav = (tab: 'scanner' | 'audit' | 'policy') => {
    onSelectTab(tab);
    setDrawerOpen(false);
  };

  return (
    <>
      <nav className="lg:px-8 xl:px-16 py-4 md:px-8 sm:px-6 px-5 grid grid-cols-2 lg:grid-cols-3 sticky top-0 z-[100] bg-white/80 dark:bg-neutral-900/80 border-b border-black/5 dark:border-neutral-800/50 items-center shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        {/* Left: Brand Logo */}
        <div className="flex items-center justify-start">
          <button
            onClick={() => handleNav('scanner')}
            className="group flex items-center gap-2.5 text-left cursor-pointer focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-[#ca0019] flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-105">
              <Shield className="w-5 h-5 text-white stroke-[2.2]" />
            </div>
            <div className="leading-tight">
              <div className="text-lg font-bold tracking-tight text-slate-900 dark:text-white transition-colors">
                <span className="text-[#ca0019]">Prompt</span>Shield
              </div>
              <div className="text-[10px] font-semibold tracking-widest uppercase text-neutral-500 dark:text-neutral-400">
                AI Privacy Guard
              </div>
            </div>
          </button>
        </div>

        {/* Center: Desktop Uppercase Links with Sliding Crimson Underline */}
        <div className="hidden lg:flex items-center justify-center gap-1 xl:gap-2 whitespace-nowrap">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className="group px-3.5 xl:px-5 py-2.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <div className="relative inline-block whitespace-nowrap">
                  <span
                    className={`relative z-10 text-sm font-bold tracking-wider transition-colors duration-300 whitespace-nowrap ${
                      isActive
                        ? 'text-[#ca0019] dark:text-red-500'
                        : 'text-neutral-700 dark:text-neutral-300 group-hover:text-[#ca0019] dark:group-hover:text-red-500'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span
                    className={`absolute -bottom-1 left-0 w-full h-0.5 bg-[#ca0019] transition-transform duration-300 ease-out ${
                      isActive
                        ? 'scale-x-100 origin-left'
                        : 'scale-x-0 origin-right group-hover:scale-x-100 group-hover:origin-left'
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Theme Toggle + Demo Walkthrough Pill + Drawer Trigger */}
        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <button
            onClick={onOpenDemos}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#ca0019] hover:bg-[#b00016] text-white text-xs font-semibold tracking-wide transition-all duration-200 shadow-sm hover:ring-2 hover:ring-[#ca0019] hover:ring-offset-2 dark:hover:ring-offset-neutral-900 cursor-pointer active:scale-95"
            title="Open synthetic sample test cases (customers.xlsx, blocked quotation, etc.)"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Demo Script</span>
          </button>

          <button
            ref={themeToggleRef}
            onPointerEnter={onWarmTheme}
            onFocus={onWarmTheme}
            onClick={(e) => onToggleDarkMode(e.detail === 0 ? undefined : { x: e.clientX, y: e.clientY })}
            className="w-10 h-10 rounded-full hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80 cursor-pointer border border-neutral-200/80 dark:border-neutral-700/80 flex items-center justify-center text-slate-800 dark:text-amber-400 transition-transform duration-200 hover:-rotate-12 hover:scale-105 active:scale-95"
            aria-label="Toggle Dark Mode"
            aria-pressed={isDarkMode}
            title="Toggle Dark Mode (T)"
          >
            <svg className="theme-toggle__icon w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path className="theme-toggle__body" d="M12 7a5 5 0 1 1 0 10a5 5 0 1 1 0-10z" />
              <g className="theme-toggle__rays">
                <line x1="12" y1="1.5" x2="12" y2="3.5" />
                <line x1="12" y1="20.5" x2="12" y2="22.5" />
                <line x1="1.5" y1="12" x2="3.5" y2="12" />
                <line x1="20.5" y1="12" x2="22.5" y2="12" />
                <line x1="4.58" y1="4.58" x2="6" y2="6" />
                <line x1="18" y1="18" x2="19.42" y2="19.42" />
                <line x1="4.58" y1="19.42" x2="6" y2="18" />
                <line x1="18" y1="6" x2="19.42" y2="4.58" />
              </g>
            </svg>
          </button>

          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="p-2.5 rounded-xl hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80 transition-all duration-300 cursor-pointer border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
            aria-label="Open Navigation Menu"
          >
            {drawerOpen ? (
              <X className="w-5 h-5 text-black dark:text-white" />
            ) : (
              <Menu className="w-5 h-5 text-black dark:text-white" />
            )}
          </button>
        </div>
      </nav>

      {/* Signature Slide-Out Right Floating Drawer (matching theuniques.in MUI Drawer) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className="relative z-10 m-2 sm:m-4 w-[calc(100vw-32px)] sm:w-[290px] h-[calc(100%-16px)] sm:h-[calc(100%-32px)] rounded-2xl border border-neutral-200/60 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden animate-fadeIn"
            style={{
              background: isDarkMode ? 'rgba(30, 30, 30, 0.98)' : 'rgba(255, 248, 248, 0.98)',
              backdropFilter: 'blur(25px)',
            }}
          >
            {/* Close Button */}
            <div className="pt-4 px-4 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Navigation
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors text-neutral-500 hover:text-[#ca0019]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="flex-1 px-3 pt-4 pb-2 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-lg relative overflow-hidden transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-[#ca0019]/10 text-[#ca0019] font-semibold shadow-sm'
                        : 'text-neutral-700 dark:text-neutral-200 hover:bg-[#ca0019]/5 hover:text-[#ca0019] hover:translate-x-1'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#ca0019] rounded-r" />
                    )}
                    <div className="flex items-center gap-3 text-sm">
                      <span className={isActive ? 'text-[#ca0019]' : 'text-neutral-400'}>
                        {item.icon}
                      </span>
                      <span>{item.mobileLabel}</span>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-[#ca0019]" />}
                  </button>
                );
              })}
            </div>

            {/* Bottom CTA inside drawer */}
            <div className="p-4 border-t border-neutral-200/60 dark:border-neutral-800 space-y-3">
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  onOpenDemos();
                }}
                className="w-full py-3 px-4 rounded-lg bg-[#ca0019] hover:bg-black text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors duration-300 cursor-pointer shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>Open Demo Script</span>
              </button>
              <div className="text-[11px] text-center text-neutral-500 dark:text-neutral-400">
                Zero-Exposure Rule-Based Scanner • {rulesCount} Active Rules
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
