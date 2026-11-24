import { api } from './api';
import {
  AuditLog,
  AuditLogFilters,
  PaginationParams,
  PaginatedResponse,
  ApiResponse,
} from '@/types';

function unwrap<T>(data: ApiResponse<T> | T): T {
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return (data as ApiResponse<T>).data;
  }
  return data as T;
}

export const auditService = {
  /**
   * Fetch system audit logs with event type, actor, date range filters and pagination
   */
  async getAuditLogs(
    filters?: AuditLogFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<AuditLog>> {
    const params = {
      ...filters,
      ...pagination,
    };

    const response = await api.get<ApiResponse<PaginatedResponse<AuditLog>> | PaginatedResponse<AuditLog>>(
      '/audit-logs',
      { params }
    );

    return unwrap(response.data);
  },

  /**
   * Alias for getAuditLogs
   */
  async list(
    filters?: AuditLogFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<AuditLog>> {
    return this.getAuditLogs(filters, pagination);
  },

  /**
   * Fetch single audit log record details
   */
  async getAuditLog(id: string): Promise<AuditLog> {
    const response = await api.get<ApiResponse<AuditLog> | AuditLog>(`/audit-logs/${id}`);

    return unwrap(response.data);
  },

  /**
   * Fetch immutable audit trail for a specific entity (e.g. PAYMENT_REQUEST, VENDOR, USER)
   */
  async getEntityAuditLogs(entityType: string, entityId: string): Promise<AuditLog[]> {
    const response = await api.get<ApiResponse<AuditLog[]> | AuditLog[]>(
      `/audit-logs/entity/${entityType}/${entityId}`
    );

    const result = unwrap(response.data);
    if (Array.isArray(result)) {
      return result;
    }
    return [];
  },
};

export default auditService;
