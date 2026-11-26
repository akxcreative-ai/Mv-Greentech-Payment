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
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between selection:bg-emerald-700 selection:text-white">
      {/* Background Decor Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-60">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 rounded-full bg-emerald-100/60 blur-3xl" />
      </div>

      {/* Top Simple Brand Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <Logo size="md" />

        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-3.5 py-1.5 rounded-full shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>SOC-2 & ISO 27001 Certified System</span>
        </div>
      </header>

      {/* Main Center Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg space-y-6">
          {/* Card Wrapper */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 sm:p-8">
            {(title || subtitle) && (
              <div className="text-center mb-6">
                {title && (
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-sm font-normal text-slate-500 mt-1.5">
                    {subtitle}
                  </p>
                )}
              </div>
            )}

            {children || <Outlet />}
          </div>

          {/* Trust Highlights Under Card */}
          <div className="flex items-center justify-center gap-6 text-xs font-medium text-slate-500">
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-700" />
              <span>TLS 1.3 Transport Security</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-700" />
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
