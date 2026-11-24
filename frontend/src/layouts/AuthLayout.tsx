import React from 'react';
import { Outlet } from 'react-router-dom';
import { ShieldCheck, Lock, CheckCircle } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';

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
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex flex-col justify-between selection:bg-navy-800 selection:text-white">
      {/* Background Decor Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-40 dark:opacity-20">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-navy-200/50 dark:bg-navy-800/40 blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 rounded-full bg-cyan-100/50 dark:bg-cyan-900/30 blur-3xl" />
      </div>

      {/* Top Simple Brand Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <Logo size="md" />

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium bg-white/70 dark:bg-dark-card/70 border border-slate-200/80 dark:border-dark-border px-3 py-1.5 rounded-full shadow-xs backdrop-blur-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>SOC-2 & ISO 27001 Certified System</span>
        </div>
      </header>

      {/* Main Center Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6">
          {/* Card Wrapper */}
          <div className="bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border rounded-2xl shadow-xl p-6 sm:p-8 backdrop-blur-sm">
            {(title || subtitle) && (
              <div className="text-center mb-6">
                {title && (
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                    {subtitle}
                  </p>
                )}
              </div>
            )}

            {children || <Outlet />}
          </div>

          {/* Trust Highlights Under Card */}
          <div className="flex items-center justify-center gap-6 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-navy-600 dark:text-cyan-400" />
              <span>TLS 1.3 Transport Security</span>
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Multi-Level Authorization</span>
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 border-t border-slate-200/60 dark:border-dark-border/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 dark:text-slate-500 gap-4">
        <p>&copy; {new Date().getFullYear()} MV Payment Approval System. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            Privacy Policy
          </a>
          <span>&bull;</span>
          <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            Terms of Service
          </a>
          <span>&bull;</span>
          <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            Security Compliance
          </a>
        </div>
      </footer>
    </div>
  );
};

export default AuthLayout;
