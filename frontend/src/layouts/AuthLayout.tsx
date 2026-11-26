import React from 'react';
import { Outlet } from 'react-router-dom';
import { ShieldCheck, Lock, CheckCircle, Sun, Moon } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { useUIStore } from '@/store/uiStore';

export interface AuthLayoutProps {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
}) => {
  const { darkMode, toggleDarkMode } = useUIStore();

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-dark-bg text-slate-800 dark:text-slate-100 flex flex-col justify-between selection:bg-emerald-700 selection:text-white transition-colors">
      {/* Background Decor Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-60">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-200/50 dark:bg-emerald-900/20 blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 rounded-full bg-emerald-100/60 dark:bg-emerald-950/30 blur-3xl" />
      </div>

      {/* Top Simple Brand Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <Logo size="md" />

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border px-3.5 py-1.5 rounded-full shadow-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>SOC-2 & ISO 27001 Certified System</span>
          </div>

          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-dark-card border border-transparent hover:border-slate-200 dark:hover:border-dark-border transition-colors focus:outline-none shadow-xs"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </div>
      </header>

      {/* Main Center Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg space-y-6">
          {/* Card Wrapper */}
          <div className="bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border rounded-2xl shadow-sm p-6 sm:p-8 transition-colors">
            {(title || subtitle) && (
              <div className="text-center mb-6">
                {title && (
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-sm font-normal text-slate-500 dark:text-slate-400 mt-1.5">
                    {subtitle}
                  </p>
                )}
              </div>
            )}

            {children || <Outlet />}
          </div>

          {/* Trust Highlights Under Card */}
          <div className="flex items-center justify-center gap-6 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>TLS 1.3 Transport Security</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>Multi-Level Authorization</span>
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 border-t border-slate-300/80 flex flex-col sm:flex-row items-center justify-between text-xs font-semibold text-slate-600 gap-4">
        <p>&copy; {new Date().getFullYear()} MV Greentech Payment Approval System. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-emerald-800 transition-colors">
            Privacy Policy
          </a>
          <span>&bull;</span>
          <a href="#" className="hover:text-emerald-800 transition-colors">
            Terms of Service
          </a>
          <span>&bull;</span>
          <a href="#" className="hover:text-emerald-800 transition-colors">
            Security Compliance
          </a>
        </div>
      </footer>
    </div>
  );
};

export default AuthLayout;
