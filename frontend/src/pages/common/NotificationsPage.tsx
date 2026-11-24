import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  CreditCard,
  AlertTriangle,
  FileText,
  Trash2,
  ExternalLink,
  Filter,
} from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  Badge,
  Pagination,
  EmptyState,
  Tabs,
  TabItem,
} from '@/components/ui';
import { Notification, NotificationType } from '@/types';
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useDeleteNotification,
} from '@/hooks';
import { formatDateTime } from '@/utils/format';

// Fallback enterprise notifications for comprehensive presentation
export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();

  // Local state for interactive filtering and pagination
  const [activeTab, setActiveTab] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [localNotifications, setLocalNotifications] = useState<Notification[]>([]);

  // TanStack Query Hooks
  const { data: apiResponse } = useNotifications(
    activeTab === 'unread' ? { isRead: false } : undefined,
    { page: currentPage, pageSize }
  );

  const markAsReadMutation = useMarkNotificationAsRead();
  const markAllMutation = useMarkAllNotificationsAsRead();
  const deleteMutation = useDeleteNotification();

  // Real API notifications without mock fallback
  const allItems: Notification[] = useMemo(() => {
    if (apiResponse && apiResponse.data) {
      return Array.isArray(apiResponse.data) ? apiResponse.data : (apiResponse.data as any).items || [];
    }
    return localNotifications;
  }, [apiResponse, localNotifications]);

  // Filter based on active tab
  const filteredItems = useMemo(() => {
    switch (activeTab) {
      case 'unread':
        return allItems.filter((item) => !item.isRead);
      case 'approvals':
        return allItems.filter(
          (item) =>
            item.type === NotificationType.APPROVAL_REQUIRED ||
            item.type === NotificationType.PAYMENT_APPROVED ||
            item.type === NotificationType.PAYMENT_REJECTED
        );
      case 'payments':
        return allItems.filter(
          (item) =>
            item.type === NotificationType.PAYMENT_PROCESSED ||
            item.type === NotificationType.PAYMENT_FAILED
        );
      case 'clarifications':
        return allItems.filter(
          (item) =>
            item.type === NotificationType.CLARIFICATION_REQUESTED ||
            item.type === NotificationType.CLARIFICATION_RESPONDED
        );
      default:
        return allItems;
    }
  }, [allItems, activeTab]);

  // Paginate filtered items
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Count unread notifications
  const unreadCount = allItems.filter((i) => !i.isRead).length;

  // Tabs Configuration
  const tabs: TabItem[] = [
    { id: 'all', label: 'All Notifications', badge: allItems.length },
    { id: 'unread', label: 'Unread', badge: unreadCount > 0 ? unreadCount : undefined },
    { id: 'approvals', label: 'Approvals & Decisions' },
    { id: 'payments', label: 'Payments & Banking' },
    { id: 'clarifications', label: 'Clarifications' },
  ];

  // Helper: Get notification type presentation metadata
  const getTypeMeta = (type: NotificationType) => {
    switch (type) {
      case NotificationType.APPROVAL_REQUIRED:
        return {
          icon: <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
          bgColor: 'bg-amber-100 dark:bg-amber-950/60',
          borderColor: 'border-l-amber-500',
          badgeText: 'Approval Required',
          badgeVariant: 'warning' as const,
        };
      case NotificationType.PAYMENT_APPROVED:
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
          bgColor: 'bg-emerald-100 dark:bg-emerald-950/60',
          borderColor: 'border-l-emerald-500',
          badgeText: 'Approved',
          badgeVariant: 'success' as const,
        };
      case NotificationType.PAYMENT_REJECTED:
        return {
          icon: <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
          bgColor: 'bg-rose-100 dark:bg-rose-950/60',
          borderColor: 'border-l-rose-500',
          badgeText: 'Rejected',
          badgeVariant: 'danger' as const,
        };
      case NotificationType.CLARIFICATION_REQUESTED:
      case NotificationType.CLARIFICATION_RESPONDED:
        return {
          icon: <HelpCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
          bgColor: 'bg-purple-100 dark:bg-purple-950/60',
          borderColor: 'border-l-purple-500',
          badgeText: 'Clarification',
          badgeVariant: 'purple' as const,
        };
      case NotificationType.PAYMENT_PROCESSED:
        return {
          icon: <CreditCard className="w-4 h-4 text-teal-600 dark:text-teal-400" />,
          bgColor: 'bg-teal-100 dark:bg-teal-950/60',
          borderColor: 'border-l-teal-500',
          badgeText: 'Disbursed',
          badgeVariant: 'success' as const,
        };
      case NotificationType.PAYMENT_FAILED:
        return {
          icon: <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
          bgColor: 'bg-rose-100 dark:bg-rose-950/60',
          borderColor: 'border-l-rose-600',
          badgeText: 'Disbursement Failed',
          badgeVariant: 'danger' as const,
        };
      case NotificationType.PAYMENT_REQUEST_CREATED:
        return {
          icon: <FileText className="w-4 h-4 text-navy-700 dark:text-cyan-400" />,
          bgColor: 'bg-navy-100 dark:bg-navy-950/60',
          borderColor: 'border-l-navy-600',
          badgeText: 'Request Created',
          badgeVariant: 'primary' as const,
        };
      case NotificationType.SYSTEM_ALERT:
      default:
        return {
          icon: <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
          bgColor: 'bg-indigo-100 dark:bg-indigo-950/60',
          borderColor: 'border-l-indigo-500',
          badgeText: 'System Alert',
          badgeVariant: 'info' as const,
        };
    }
  };

  // Click single notification
  const handleItemClick = (notification: Notification) => {
    // 1. Mark as read
    if (!notification.isRead) {
      setLocalNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item))
      );
      markAsReadMutation.mutate(notification.id);
    }

    // 2. Navigate to related entity
    if (notification.link) {
      navigate(notification.link);
    } else {
      navigate('/payment-requests');
    }
  };

  // Mark all as read
  const handleMarkAllRead = () => {
    setLocalNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    markAllMutation.mutate();
    toast.success('All notifications marked as read');
  };

  // Delete notification
  const handleDeleteNotification = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setLocalNotifications((prev) => prev.filter((item) => item.id !== id));
    deleteMutation.mutate(id);
    toast.success('Notification removed');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <span>Notifications Center</span>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-navy-800 dark:bg-cyan-500 text-white">
                {unreadCount} New
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time audit alerts, multi-tier signature requests, and disbursement status tracking.
          </p>
        </div>

        {/* Header Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || markAllMutation.isPending}
            isLoading={markAllMutation.isPending}
            leftIcon={<CheckCheck className="w-4 h-4 text-navy-800 dark:text-cyan-400" />}
            className="text-xs shadow-xs"
          >
            Mark all as read
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(tabId) => {
          setActiveTab(tabId);
          setCurrentPage(1);
        }}
        variant="pills"
        className="w-full sm:w-auto"
      />

      {/* Notification List Container */}
      <Card>
        <CardContent className="p-0">
          {paginatedItems.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<Bell className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
                title={
                  activeTab === 'unread'
                    ? 'All Caught Up!'
                    : 'No Notifications Found'
                }
                description={
                  activeTab === 'unread'
                    ? 'You have addressed all pending workflow alerts and signature notifications.'
                    : 'There are no notification events matching this filter category.'
                }
                action={
                  activeTab !== 'all' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('all')}
                      leftIcon={<Filter className="w-3.5 h-3.5" />}
                    >
                      View All Notifications
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-dark-border">
              {paginatedItems.map((item) => {
                const meta = getTypeMeta(item.type);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-4 sm:p-5 flex items-start gap-4 cursor-pointer transition-all border-l-4 group ${
                      meta.borderColor
                    } ${
                      !item.isRead
                        ? 'bg-navy-50/40 dark:bg-navy-950/20 hover:bg-navy-50/70 dark:hover:bg-navy-950/40'
                        : 'bg-white dark:bg-dark-card hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Notification Type Icon Avatar */}
                    <div
                      className={`w-10 h-10 rounded-xl ${meta.bgColor} flex items-center justify-center shrink-0 shadow-xs`}
                    >
                      {meta.icon}
                    </div>

                    {/* Content Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2
                            className={`text-xs sm:text-sm tracking-tight text-slate-900 dark:text-white ${
                              !item.isRead ? 'font-bold' : 'font-semibold'
                            }`}
                          >
                            {item.title}
                          </h2>
                          <Badge variant={meta.badgeVariant} size="sm">
                            {meta.badgeText}
                          </Badge>
                          {!item.isRead && (
                            <span className="w-2 h-2 rounded-full bg-navy-800 dark:bg-cyan-400 shrink-0 animate-pulse" />
                          )}
                        </div>

                        <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                          {formatDateTime(item.createdAt)}
                        </span>
                      </div>

                      <p
                        className={`text-xs leading-relaxed ${
                          !item.isRead
                            ? 'text-slate-800 dark:text-slate-200'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.message}
                      </p>

                      {/* Bottom quick actions */}
                      <div className="flex items-center gap-4 mt-2.5 text-[11px] text-slate-400 dark:text-slate-500">
                        {item.link && (
                          <span className="inline-flex items-center gap-1 font-medium text-navy-700 dark:text-cyan-400 hover:underline">
                            Open Requisition Details
                            <ExternalLink className="w-3 h-3" />
                          </span>
                        )}

                        <span className="opacity-40">&bull;</span>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteNotification(e, item.id)}
                          className="hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 transition"
                          title="Delete notification"
                        >
                          <Trash2 className="w-3 h-3" />
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          totalItems={totalItems}
        />
      )}
    </div>
  );
};

export default NotificationsPage;
