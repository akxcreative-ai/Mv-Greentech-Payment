import { api } from './api';
import {
  Company,
  CompanyFilters,
  PaginationParams,
  PaginatedResponse,
  CreateCompanyInput,
  UpdateCompanyInput,
  ApiResponse,
} from '@/types';

function unwrap<T>(data: ApiResponse<T> | T): T {
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return (data as ApiResponse<T>).data;
  }
  return data as T;
}

export const companyService = {
  /**
   * Fetch companies with pagination and optional search
   */
  async getCompanies(
    filters?: CompanyFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Company>> {
    const params = {
      ...filters,
      ...pagination,
    };

    const response = await api.get<ApiResponse<PaginatedResponse<Company>> | PaginatedResponse<Company>>(
      '/companies',
      { params }
    );

    return unwrap(response.data);
  },

  /**
   * Fetch all companies (without pagination, for dropdown selects)
   */
  async getAllCompanies(): Promise<Company[]> {
    const response = await api.get<ApiResponse<Company[]> | Company[]>('/companies/all');

    return unwrap(response.data);
  },

  /**
   * Fetch company details by ID
   */
  async getCompany(id: string): Promise<Company> {
    const response = await api.get<ApiResponse<Company> | Company>(`/companies/${id}`);

    return unwrap(response.data);
  },

  /**
   * Register a new corporate entity
   */
  async createCompany(data: CreateCompanyInput): Promise<Company> {
    const response = await api.post<ApiResponse<Company> | Company>('/companies', data);

    return unwrap(response.data);
  },

  /**
   * Update existing company settings, GST/PAN or bank accounts
   */
  async updateCompany(id: string, data: UpdateCompanyInput): Promise<Company> {
    const response = await api.put<ApiResponse<Company> | Company>(`/companies/${id}`, data);

    return unwrap(response.data);
  },

  /**
   * Delete or deactivate company entity
   */
  async deleteCompany(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<ApiResponse<{ message: string }> | { message: string }>(
      `/companies/${id}`
    );

    const message =
      'data' in response.data && response.data.data?.message
        ? response.data.data.message
        : (response.data as { message: string }).message || 'Company deleted successfully';

    return { success: true, message };
  },
};

export default companyService;
