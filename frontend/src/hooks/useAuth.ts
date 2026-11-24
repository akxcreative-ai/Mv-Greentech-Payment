import { useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Role, PaymentRequest } from '@/types';

export const useAuth = () => {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const setUser = useAuthStore((state) => state.setUser);
  const updateUser = useAuthStore((state) => state.updateUser);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const storeHasRole = useAuthStore((state) => state.hasRole);

  const hasRole = useCallback(
    (roles: Role | Role[]): boolean => {
      return storeHasRole(roles);
    },
    [storeHasRole]
  );

  const isRole = useCallback(
    (roles: Role | Role[]): boolean => {
      return storeHasRole(roles);
    },
    [storeHasRole]
  );

  // Computed convenience booleans based on Role enum
  const isSuperAdmin = user?.role === Role.SUPER_ADMIN;
  const isAdmin = user?.role === Role.ADMIN || isSuperAdmin;
  const isApprover =
    user?.role === Role.APPROVER ||
    user?.role === Role.MANAGEMENT ||
    user?.role === Role.DIRECTOR ||
    isAdmin;
  const isAccountant = user?.role === Role.ACCOUNTANT || isAdmin;
  const isRequester = user?.role === Role.REQUESTER;

  /**
   * Verify if user has approval threshold covering specified amount
   */
  const canApproveAmount = useCallback(
    (amount: number): boolean => {
      if (!user) return false;
      if (isSuperAdmin) return true;
      if (!isApprover) return false;
      if (user.approvalLimit === undefined || user.approvalLimit === null) return false;
      return user.approvalLimit >= amount;
    },
    [user, isSuperAdmin, isApprover]
  );

  /**
   * Check if current user can approve the given payment request
   */
  const canApproveRequest = useCallback(
    (request: PaymentRequest): boolean => {
      if (!user) return false;
      if (request.status !== 'SUBMITTED' && request.status !== 'UNDER_REVIEW') return false;
      // Requester cannot approve their own request
      if (request.requesterId === user.id) return false;
      return canApproveAmount(request.amount);
    },
    [user, canApproveAmount]
  );

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    setUser,
    updateUser,
    refreshToken,
    checkAuth,
    hasRole,
    isRole,
    isSuperAdmin,
    isAdmin,
    isApprover,
    isAccountant,
    isRequester,
    canApproveAmount,
    canApproveRequest,
  };
};

export default useAuth;
