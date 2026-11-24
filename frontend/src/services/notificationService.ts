import { api } from './api';
import {
  Notification,
  NotificationFilters,
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

export const notificationService = {
  /**
   * Fetch current user's system notifications
   */
  async getNotifications(
    filters?: NotificationFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Notification>> {
    const params = {
      ...filters,
      ...pagination,
    };

    const response = await api.get<ApiResponse<PaginatedResponse<Notification>> | PaginatedResponse<Notification>>(
      '/notifications',
      { params }
    );

    return unwrap(response.data);
  },

  /**
   * Alias for getNotifications
   */
  async list(
    filters?: NotificationFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Notification>> {
    return this.getNotifications(filters, pagination);
  },

  /**
   * Fetch count of unread notifications for badge indicators
   */
  async getUnreadCount(): Promise<number> {
    const response = await api.get<ApiResponse<{ count: number }> | { count: number }>(
      '/notifications/unread-count'
    );

    if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
      return (response.data as ApiResponse<{ count: number }>).data.count;
    }
    return (response.data as { count: number }).count ?? 0;
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(id: string): Promise<Notification> {
    const response = await api.patch<ApiResponse<Notification> | Notification>(
      `/notifications/${id}/read`
    );

    return unwrap(response.data);
  },

  /**
   * Alias for markAsRead
   */
  async markRead(id: string): Promise<Notification> {
    return this.markAsRead(id);
  },

  /**
   * Mark all unread notifications as read
   */
  async markAllAsRead(): Promise<{ success: boolean; count?: number }> {
    const response = await api.post<ApiResponse<{ count: number }> | { count: number }>(
      '/notifications/mark-all-read'
    );

    const count =
      response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data
        ? (response.data as ApiResponse<{ count: number }>).data.count
        : (response.data as { count: number }).count ?? 0;

    return { success: true, count };
  },

  /**
   * Delete or dismiss a notification
   */
  async deleteNotification(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<ApiResponse<{ message: string }> | { message: string }>(
      `/notifications/${id}`
    );

    const message =
      response.data && typeof response.data === 'object' && 'data' in response.data && (response.data as { data: { message: string } }).data?.message
        ? (response.data as { data: { message: string } }).data.message
        : (response.data as { message: string }).message || 'Notification deleted';

    return { success: true, message };
  },
};

export default notificationService;
