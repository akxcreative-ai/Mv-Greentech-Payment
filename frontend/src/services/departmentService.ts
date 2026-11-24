import { api } from './api';
import {
  Department,
  DepartmentFilters,
  PaginationParams,
  PaginatedResponse,
  CreateDepartmentInput,
  UpdateDepartmentInput,
  ApiResponse,
} from '@/types';

function unwrap<T>(data: ApiResponse<T> | T): T {
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return (data as ApiResponse<T>).data;
  }
  return data as T;
}

export const departmentService = {
  /**
   * Fetch departments with company filtering and pagination
   */
  async getDepartments(
    filters?: DepartmentFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Department>> {
    const params = {
      ...filters,
      ...pagination,
    };

    const response = await api.get<ApiResponse<PaginatedResponse<Department>> | PaginatedResponse<Department>>(
      '/departments',
      { params }
    );

    return unwrap(response.data);
  },

  /**
   * Fetch all departments belonging to a specific company
   */
  async getDepartmentsByCompany(companyId: string): Promise<Department[]> {
    const response = await api.get<ApiResponse<Department[]> | Department[]>('/departments', {
      params: { companyId, all: true },
    });

    return unwrap(response.data);
  },

  /**
   * Fetch department details by ID
   */
  async getDepartment(id: string): Promise<Department> {
    const response = await api.get<ApiResponse<Department> | Department>(`/departments/${id}`);

    return unwrap(response.data);
  },

  /**
   * Create a new cost center or department
   */
  async createDepartment(data: CreateDepartmentInput): Promise<Department> {
    const response = await api.post<ApiResponse<Department> | Department>('/departments', data);

    return unwrap(response.data);
  },

  /**
   * Update department name, code, or budget allocation
   */
  async updateDepartment(id: string, data: UpdateDepartmentInput): Promise<Department> {
    const response = await api.put<ApiResponse<Department> | Department>(`/departments/${id}`, data);

    return unwrap(response.data);
  },

  /**
   * Delete or archive department
   */
  async deleteDepartment(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<ApiResponse<{ message: string }> | { message: string }>(
      `/departments/${id}`
    );

    const message =
      'data' in response.data && response.data.data?.message
        ? response.data.data.message
        : (response.data as { message: string }).message || 'Department deleted successfully';

    return { success: true, message };
  },
};

export default departmentService;
