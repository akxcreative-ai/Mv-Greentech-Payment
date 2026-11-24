import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Role } from '@/types';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';

export interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

/**
 * Route protection guard:
 * Verifies user authentication and optional role-level authorization.
 */
export const AuthGuard: React.FC<AuthGuardProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  // Show loading indicator while authenticating / silent refreshing token
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-dark-bg p-4">
        <Loader2 className="w-10 h-10 animate-spin text-navy-600 dark:text-cyan-400 mb-3" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Verifying secure session...
        </p>
      </div>
    );
  }

  // If not authenticated, redirect to login keeping the intended destination in router state
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If specific roles are required, verify that the authenticated user possesses authorization
  if (allowedRoles && allowedRoles.length > 0 && user) {
    const isAuthorized = allowedRoles.includes(user.role);

    if (!isAuthorized) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border shadow-xl p-8">
            <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-rose-600 mx-auto mb-5">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Access Denied
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Your account with role <strong className="text-slate-800 dark:text-slate-200 font-semibold">{user.role}</strong> does not have permission to access this resource.
            </p>
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg text-xs text-slate-500 dark:text-slate-400">
              Required roles: {allowedRoles.join(', ')}
            </div>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/"
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-navy-600 hover:bg-navy-700 text-white text-sm font-medium transition-colors shadow-sm"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Role[];
}

/**
 * Nested role guard component for in-page or sub-route authorization
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({ children, allowedRoles }) => {
  return <AuthGuard allowedRoles={allowedRoles}>{children}</AuthGuard>;
};

export default AuthGuard;
