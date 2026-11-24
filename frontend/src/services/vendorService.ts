import { api } from './api';
import {
  Vendor,
  VendorFilters,
  PaginationParams,
  PaginatedResponse,
  CreateVendorInput,
  UpdateVendorInput,
  ApiResponse,
} from '@/types';

function unwrap<T>(data: ApiResponse<T> | T): T {
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return (data as ApiResponse<T>).data;
  }
  return data as T;
}

function normalizePaginated<T>(raw: any): PaginatedResponse<T> {
  const unwrapped = unwrap(raw);
  const items = Array.isArray(unwrapped)
    ? unwrapped
    : unwrapped?.items || unwrapped?.data || [];
  return {
    data: items,
    total: unwrapped?.total ?? items.length,
    page: unwrapped?.page ?? 1,
    pageSize: unwrapped?.page_size ?? unwrapped?.pageSize ?? items.length,
    totalPages: unwrapped?.pages ?? unwrapped?.totalPages ?? 1,
  };
}

export const vendorService = {
  /**
   * Fetch approved vendors with optional search, category filters, and pagination
   */
  async getVendors(
    filters?: VendorFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Vendor>> {
    const params = {
      ...filters,
      ...pagination,
    };

    const response = await api.get<any>('/vendors', { params });
    return normalizePaginated<Vendor>(response.data);
  },

  /**
   * Fetch all active vendors (for dropdown selectors)
   */
  async getAllVendors(): Promise<Vendor[]> {
    try {
      const response = await api.get<any>('/vendors/all');
      const d = unwrap(response.data);
      return Array.isArray(d) ? d : d?.items || d?.data || [];
    } catch {
      const fallback = await api.get<any>('/vendors?page_size=100');
      const d = unwrap(fallback.data);
      return Array.isArray(d) ? d : d?.items || d?.data || [];
    }
  },

  /**
   * Fetch vendor details including bank details and tax registrations
   */
  async getVendor(id: string): Promise<Vendor> {
    const response = await api.get<ApiResponse<Vendor> | Vendor>(`/vendors/${id}`);

    return unwrap(response.data);
  },

  /**
   * Onboard and register a new vendor
   */
  async createVendor(data: CreateVendorInput): Promise<Vendor> {
    const response = await api.post<ApiResponse<Vendor> | Vendor>('/vendors', data);

    return unwrap(response.data);
  },

  /**
   * Update existing vendor contact, GST, or bank account details
   */
  async updateVendor(id: string, data: UpdateVendorInput): Promise<Vendor> {
    const response = await api.put<ApiResponse<Vendor> | Vendor>(`/vendors/${id}`, data);

    return unwrap(response.data);
  },

  /**
   * Delete or deactivate vendor master record
   */
  async deleteVendor(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<ApiResponse<{ message: string }> | { message: string }>(
      `/vendors/${id}`
    );

    const message =
      'data' in response.data && response.data.data?.message
        ? response.data.data.message
        : (response.data as { message: string }).message || 'Vendor deleted successfully';

    return { success: true, message };
  },
};

export default vendorService;
