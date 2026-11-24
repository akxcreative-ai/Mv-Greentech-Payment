import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { notificationService } from '@/services/notificationService';
import { NotificationFilters, PaginationParams } from '@/types';

export const NOTIFICATIONS_KEY = ['notifications'];
export const UNREAD_COUNT_KEY = ['notifications', 'unread-count'];

/**
 * Hook to fetch paginated notifications with polling every 30 seconds
 */
export const useNotifications = (
  filters?: NotificationFilters,
  pagination?: PaginationParams
) => {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, filters, pagination],
    queryFn: () => notificationService.getNotifications(filters, pagination),
    refetchInterval: 30000, // 30-second background polling
    refetchIntervalInBackground: false,
    staleTime: 1000 * 15,
  });
};

/**
 * Hook to poll unread notifications count every 30 seconds for header bell badge
 */
export const useUnreadNotificationCount = () => {
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 30000, // 30-second background polling
    refetchIntervalInBackground: false,
    staleTime: 1000 * 15,
  });
};

/**
 * Hook to mark an individual notification as read
 */
export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update notification');
    },
  });
};

/**
 * Hook to mark all unread notifications as read
 */
export const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      toast.success('All notifications marked as read');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to mark all as read');
    },
  });
};

/**
 * Hook to delete a notification
 */
export const useDeleteNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationService.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      toast.success('Notification removed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete notification');
    },
  });
};
