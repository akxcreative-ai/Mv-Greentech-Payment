import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Role } from '@/types';
import { LoadingSpinner } from '@/components/ui';

// Lazy or direct import of dashboards
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { ApproverDashboard } from '@/pages/approver/ApproverDashboard';
import { AccountantDashboard } from '@/pages/accountant/AccountantDashboard';

export const DashboardRouter: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Show loading indicator while session/profile is restoring
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading your personalized workspace...
        </p>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Normalize role string (handles uppercase, lowercase, enum, snake_case)
  const normalizedRole = (user.role || '').toString().toLowerCase().trim();

  // 1. Super Admin & Admin -> AdminDashboard
  if (
    normalizedRole === 'super_admin' ||
    normalizedRole === 'admin' ||
    user.role === Role.SUPER_ADMIN ||
    user.role === Role.ADMIN
  ) {
    return <AdminDashboard />;
  }

  // 2. Department Head -> ApproverDashboard (filtered by department)
  if (
    normalizedRole === 'department_head' ||
    normalizedRole === 'dept_head' ||
    normalizedRole === 'head_of_department'
  ) {
    return (
      <ApproverDashboard
        departmentId={user.departmentId}
        departmentName={user.department?.name || 'Department'}
      />
    );
  }

  // 3. Director, Approver, Management -> ApproverDashboard
  if (
    normalizedRole === 'director' ||
    normalizedRole === 'approver' ||
    normalizedRole === 'management' ||
    user.role === Role.DIRECTOR ||
    user.role === Role.APPROVER ||
    user.role === Role.MANAGEMENT
  ) {
    return <ApproverDashboard />;
  }

  // 4. Accountant -> AccountantDashboard
  if (normalizedRole === 'accountant' || user.role === Role.ACCOUNTANT) {
    return <AccountantDashboard />;
  }

  // 5. Requester / Default -> AccountantDashboard (requisition & tracking view)
  return <AccountantDashboard />;
};

export default DashboardRouter;