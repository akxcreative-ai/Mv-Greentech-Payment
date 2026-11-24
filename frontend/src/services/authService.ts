import { api } from './api';
import {
  User,
  Role,
  LoginResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  ApiResponse,
} from '@/types';

// Helper to normalize backend user to frontend User format
export function normalizeUser(rawUser: any): User {
  if (!rawUser) return rawUser;

  // Extract role string
  let roleStr = '';
  if (typeof rawUser.role === 'string') {
    roleStr = rawUser.role;
  } else if (rawUser.role && typeof rawUser.role.name === 'string') {
    roleStr = rawUser.role.name;
  } else if (rawUser.role_id) {
    roleStr = 'SUPER_ADMIN';
  }

  // Map backend role names to frontend Role enum
  let mappedRole: Role = Role.SUPER_ADMIN;
  const upperRole = roleStr.toUpperCase().replace(/\s+/g, '_');

  if (upperRole.includes('SUPER_ADMIN')) {
    mappedRole = Role.SUPER_ADMIN;
  } else if (upperRole.includes('DIRECTOR') || upperRole.includes('APPROVER')) {
    mappedRole = Role.DIRECTOR;
  } else if (upperRole.includes('ACCOUNTANT')) {
    mappedRole = Role.ACCOUNTANT;
  } else if (upperRole.includes('DEPARTMENT') || upperRole.includes('REQUESTER')) {
    mappedRole = Role.REQUESTER;
  } else if (upperRole.includes('ADMIN')) {
    mappedRole = Role.ADMIN;
  }

  const fullName =
    rawUser.fullName ||
    rawUser.full_name ||
    `${rawUser.first_name || ''} ${rawUser.last_name || ''}`.trim() ||
    rawUser.email ||
    'User';

  return {
    id: String(rawUser.id || ''),
    email: rawUser.email || '',
    fullName,
    name: fullName,
    role: mappedRole,
    companyId: rawUser.companyId || rawUser.company_id || 'comp_mv_global',
    departmentId: rawUser.departmentId || rawUser.department_id || 'dept_finance',
    designation: rawUser.designation || mappedRole,
    approvalLimit: rawUser.approvalLimit || rawUser.approval_limit || 10000000,
    isActive: rawUser.isActive !== false && rawUser.is_active !== false,
    createdAt: rawUser.createdAt || rawUser.created_at || new Date().toISOString(),
    updatedAt: rawUser.updatedAt || rawUser.updated_at || new Date().toISOString(),
  };
}

export const authService = {
  /**
   * Authenticate user with email and password
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await api.post<any>('/auth/login', {
      email,
      password,
    });

    const data = response.data?.data || response.data;
    const token = data.access_token || data.token;
    const refreshToken = data.refresh_token || data.refreshToken;
    const user = normalizeUser(data.user);

    return {
      token,
      refreshToken,
      user,
    };
  },

  /**
   * Log out current user session and revoke refresh token
   */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.warn('Logout API request encountered an error:', error);
    }
  },

  /**
   * Refresh JWT authentication token using httpOnly cookie or stored refresh token
   */
  async refreshToken(): Promise<{ token: string; user?: User }> {
    const response = await api.post<any>('/auth/refresh');

    const data = response.data?.data || response.data;
    const token = data.access_token || data.token;
    const user = data.user ? normalizeUser(data.user) : undefined;

    return { token, user };
  },

  /**
   * Request password reset link for forgotten password
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const payload: ForgotPasswordRequest = { email };
    const response = await api.post<ApiResponse<{ message: string }> | { message: string }>(
      '/auth/forgot-password',
      payload
    );

    const message =
      'data' in response.data && response.data.data?.message
        ? response.data.data.message
        : (response.data as { message: string }).message || 'Password reset link sent to your email';

    return { success: true, message };
  },

  /**
   * Reset user password with token received via email
   */
  async resetPassword(token: string, password: string): Promise<{ success: boolean; message: string }> {
    const payload: ResetPasswordRequest = {
      token,
      newPassword: password,
      confirmPassword: password,
    };
    const response = await api.post<ApiResponse<{ message: string }> | { message: string }>(
      '/auth/reset-password',
      payload
    );

    const message =
      'data' in response.data && response.data.data?.message
        ? response.data.data.message
        : (response.data as { message: string }).message || 'Password has been reset successfully';

    return { success: true, message };
  },

  /**
   * Change password for currently authenticated user
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const payload: ChangePasswordRequest = {
      currentPassword,
      newPassword,
    };
    const response = await api.post<ApiResponse<{ message: string }> | { message: string }>(
      '/auth/change-password',
      payload
    );

    const message =
      'data' in response.data && response.data.data?.message
        ? response.data.data.message
        : (response.data as { message: string }).message || 'Password updated successfully';

    return { success: true, message };
  },

  /**
   * Retrieve current authenticated user profile
   */
  async getProfile(): Promise<User> {
    const response = await api.get<any>('/auth/me');

    const data = response.data?.data || response.data;
    return normalizeUser(data);
  },
};

export default authService;
