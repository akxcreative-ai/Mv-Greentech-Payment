import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Role } from '@/types';
import { useAuthStore } from '@/store/authStore';
import MainLayout from '@/components/layout/MainLayout';
import AuthGuard, { RoleGuard } from '@/components/layout/AuthGuard';

// Public Pages
import Login from '@/pages/auth/Login';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import ResetPassword from '@/pages/auth/ResetPassword';
import SetupPage from '@/pages/auth/SetupPage';

// Protected Pages
import DashboardRouter from '@/pages/common/DashboardRouter';
import PaymentRequestsList from '@/pages/common/PaymentRequestsList';
import MyRequests from '@/pages/accountant/MyRequests';
import PendingClarification from '@/pages/accountant/PendingClarification';
import CreatePaymentRequest from '@/pages/accountant/CreatePaymentRequest';
import PaymentRequestDetail from '@/pages/common/PaymentRequestDetail';
import PendingApprovals from '@/pages/approver/PendingApprovals';
import ApprovalDetail from '@/pages/approver/ApprovalDetail';
import ApprovalHistory from '@/pages/approver/ApprovalHistory';
import PaymentProcessing from '@/pages/accountant/PaymentProcessing';
import CompletedPayments from '@/pages/accountant/CompletedPayments';
import PaymentTracking from '@/pages/common/PaymentTracking';
import Vendors from '@/pages/common/Vendors';
import Companies from '@/pages/admin/Companies';
import Departments from '@/pages/admin/Departments';
import UserManagement from '@/pages/admin/UserManagement';
import Reports from '@/pages/common/Reports';
import AuditLogs from '@/pages/admin/AuditLogs';
import Settings from '@/pages/admin/Settings';
import Notifications from '@/pages/common/Notifications';
import Profile from '@/pages/common/Profile';
import NotFound from '@/pages/common/NotFound';

export const App: React.FC = () => {
  useEffect(() => {
    useAuthStore.getState().checkAuth();
  }, []);

  const adminRoles = [Role.SUPER_ADMIN, Role.ADMIN];
  const approverRoles = [
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.APPROVER,
    Role.MANAGEMENT,
    Role.DIRECTOR,
  ];
  const accountantRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT];

  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/setup" element={<SetupPage />} />

      {/* Protected Routes wrapped in AuthGuard */}
      <Route
        path="/"
        element={
          <AuthGuard>
            <MainLayout />
          </AuthGuard>
        }
      >
        {/* / -> DashboardRouter (role-based) */}
        <Route index element={<DashboardRouter />} />

        {/* /payment-requests, /payment-requests/new, /payment-requests/:id */}
        <Route path="payment-requests" element={<PaymentRequestsList />} />
        <Route path="payment-requests/new" element={<CreatePaymentRequest />} />
        <Route path="payment-requests/:id" element={<PaymentRequestDetail />} />
        <Route path="payment-requests/my" element={<MyRequests />} />
        <Route path="payment-requests/clarifications" element={<PendingClarification />} />

        {/* /clarifications */}
        <Route path="clarifications" element={<PendingClarification />} />

        {/* /approvals, /approvals/:id */}
        <Route
          path="approvals"
          element={
            <RoleGuard allowedRoles={approverRoles}>
              <PendingApprovals />
            </RoleGuard>
          }
        />
        <Route
          path="approvals/history"
          element={
            <RoleGuard allowedRoles={approverRoles}>
              <ApprovalHistory />
            </RoleGuard>
          }
        />
        <Route
          path="approvals/:id"
          element={
            <RoleGuard allowedRoles={approverRoles}>
              <ApprovalDetail />
            </RoleGuard>
          }
        />

        {/* /payments, /payments/completed */}
        <Route
          path="payments"
          element={
            <RoleGuard allowedRoles={accountantRoles}>
              <PaymentProcessing />
            </RoleGuard>
          }
        />
        <Route
          path="payments/completed"
          element={
            <RoleGuard allowedRoles={accountantRoles}>
              <CompletedPayments />
            </RoleGuard>
          }
        />

        {/* Payment Tracking */}
        <Route path="payment-tracking" element={<PaymentTracking />} />
        <Route path="payment-tracking/:id" element={<PaymentTracking />} />

        {/* /vendors */}
        <Route path="vendors" element={<Vendors />} />

        {/* /companies, /departments, /users (admin) */}
        <Route
          path="companies"
          element={
            <RoleGuard allowedRoles={adminRoles}>
              <Companies />
            </RoleGuard>
          }
        />
        <Route
          path="departments"
          element={
            <RoleGuard allowedRoles={adminRoles}>
              <Departments />
            </RoleGuard>
          }
        />
        <Route
          path="users"
          element={
            <RoleGuard allowedRoles={adminRoles}>
              <UserManagement />
            </RoleGuard>
          }
        />

        {/* /reports, /audit-logs (admin), /settings (admin) */}
        <Route path="reports" element={<Reports />} />
        <Route
          path="audit-logs"
          element={
            <RoleGuard allowedRoles={adminRoles}>
              <AuditLogs />
            </RoleGuard>
          }
        />
        <Route
          path="settings"
          element={
            <RoleGuard allowedRoles={adminRoles}>
              <Settings />
            </RoleGuard>
          }
        />

        {/* /notifications, /profile */}
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />

        {/* 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Catch-all Redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
