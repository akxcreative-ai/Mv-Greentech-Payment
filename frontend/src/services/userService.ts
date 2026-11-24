import { api } from './api';
import {
  User,
  UserFilters,
  PaginationParams,
  PaginatedResponse,
  CreateUserInput,
  UpdateUserInput,
  ApiResponse,
} from '@/types';

function unwrap<T>(data: ApiResponse<T> | T): T {
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return (data as ApiResponse<T>).data;
  }
  return data as T;
}

export const userService = {
  /**
   * Fetch users with role, department, company filters and pagination
   */
  async getUsers(
    filters?: UserFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<User>> {
    const params = {
      ...filters,
      ...pagination,
    };

    const response = await api.get<ApiResponse<PaginatedResponse<User>> | PaginatedResponse<User>>(
      '/users',
      { params }
    );

    return unwrap(response.data);
  },

  /**
   * Fetch single user by ID
   */
  async getUser(id: string): Promise<User> {
    const response = await api.get<ApiResponse<User> | User>(`/users/${id}`);

    return unwrap(response.data);
  },

  /**
   * Create a new enterprise user account
   */
  async createUser(data: CreateUserInput): Promise<User> {
    const response = await api.post<ApiResponse<User> | User>('/users', data);

    return unwrap(response.data);
  },

  /**
   * Update user profile, roles, or approval limits
   */
  async updateUser(id: string, data: UpdateUserInput): Promise<User> {
    const response = await api.put<ApiResponse<User> | User>(`/users/${id}`, data);

    return unwrap(response.data);
  },

  /**
   * Delete or deactivate user account
   */
  async deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<ApiResponse<{ message: string }> | { message: string }>(
      `/users/${id}`
    );

    const message =
      'data' in response.data && response.data.data?.message
        ? response.data.data.message
        : (response.data as { message: string }).message || 'User deleted successfully';

    return { success: true, message };
  },

  /**
   * Toggle user active/suspended status
   */
  async toggleUserStatus(id: string, isActive: boolean): Promise<User> {
    const response = await api.patch<ApiResponse<User> | User>(`/users/${id}/status`, {
      isActive,
    });

    return unwrap(response.data);
  },

  /**
   * Retrieve eligible approvers for a department and optional transaction threshold
   */
  async getApprovers(departmentId?: string, amount?: number): Promise<User[]> {
    const response = await api.get<ApiResponse<User[]> | User[]>('/users/approvers', {
      params: { departmentId, amount },
    });

    return unwrap(response.data);
  },
};

export default userService;
