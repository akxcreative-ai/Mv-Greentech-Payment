import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  CheckSquare,
  CreditCard,
  Building2,
  Network,
  Users,
  BarChart3,
  History,
  Settings,
  Store,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  X,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Role } from '@/types';
import { cn } from '@/utils/cn';
import { Logo } from './Logo';
import { Avatar } from '@/components/ui/Avatar';

export interface NavItem {
  title: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
  badge?: string | number;
}

export interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onCloseMobile?: () => void;
  isMobile?: boolean;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggleCollapse,
  onCloseMobile,
  isMobile = false,
  className,
}) => {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const isRoleAuthorized = (roles?: Role[]) => {
    if (!roles || roles.length === 0) return true;
    if (!user) return false;
    if (user.role === Role.SUPER_ADMIN) return true;
    return roles.includes(user.role);
  };

  const mainNavItems: NavItem[] = [
    {
      title: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
    },
    {
      title: 'Payment Requests',
      path: '/payment-requests',
      icon: FileText,
    },
    {
      title: 'My Requests',
      path: '/payment-requests/my',
      icon: FileText,
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT, Role.REQUESTER],
    },
    {
      title: 'Clarifications',
      path: '/payment-requests/clarifications',
      icon: HelpCircle,
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT, Role.REQUESTER],
    },
    {
      title: 'New Request',
      path: '/payment-requests/new',
      icon: PlusCircle,
    },
    {
      title: 'Approvals',
      path: '/approvals',
      icon: CheckSquare,
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.APPROVER, Role.MANAGEMENT, Role.DIRECTOR],
    },
    {
      title: 'Payment Processing',
      path: '/payments',
      icon: CreditCard,
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT],
    },
    {
      title: 'Vendors',
      path: '/vendors',
      icon: Store,
    },
    {
      title: 'Reports & Analytics',
      path: '/reports',
      icon: BarChart3,
    },
  ];

  const adminNavItems: NavItem[] = [
    {
      title: 'Companies',
      path: '/companies',
      icon: Building2,
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
    },
    {
      title: 'Departments',
      path: '/departments',
      icon: Network,
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
    },
    {
      title: 'User Management',
      path: '/users',
      icon: Users,
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
    },
    {
      title: 'Audit Logs',
      path: '/audit-logs',
      icon: History,
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
    },
    {
      title: 'System Settings',
      path: '/settings',
      icon: Settings,
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
    },
  ];

  const visibleMainItems = mainNavItems.filter((item) => isRoleAuthorized(item.roles));
  const visibleAdminItems = adminNavItems.filter((item) => isRoleAuthorized(item.roles));

  const renderNavGroup = (title: string, items: NavItem[]) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-1">
        {!collapsed && (
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-navy-400 mb-2 select-none">
            {title}
          </p>
        )}
        <nav className="space-y-1">
          {items.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                title={collapsed ? item.title : undefined}
                className={cn(
                  'group flex items-center rounded-xl text-sm font-medium transition-all duration-150 select-none',
                  collapsed ? 'justify-center p-2.5 mx-auto' : 'px-3.5 py-2.5 justify-between',
                  isActive
                    ? 'bg-navy-800 text-white shadow-sm font-semibold border-l-3 border-cyan-400 pl-3'
                    : 'text-navy-200 hover:bg-navy-800/70 hover:text-white'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={cn(
                      'shrink-0 transition-colors',
                      collapsed ? 'w-5 h-5' : 'w-4 h-4',
                      isActive ? 'text-cyan-400' : 'text-navy-300 group-hover:text-white'
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.title}</span>}
                </div>

                {!collapsed && item.badge !== undefined && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-navy-700 text-cyan-300">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <aside
      className={cn(
        'bg-navy-950 text-white flex flex-col h-full border-r border-navy-900 transition-all duration-300 select-none shadow-xl relative',
        collapsed ? 'w-18' : 'w-64',
        className
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          'h-16 flex items-center border-b border-navy-900/80 px-4',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        <Logo compact={collapsed} size={collapsed ? 'sm' : 'md'} />

        {isMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-navy-300 hover:text-white hover:bg-navy-900 transition-colors"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Groups Container */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-navy-800">
        {renderNavGroup('Menu', visibleMainItems)}
        {renderNavGroup('Administration', visibleAdminItems)}
      </div>

      {/* Collapse Toggle Button (Desktop Only) */}
      {!isMobile && onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-navy-800 border border-navy-600 text-white flex items-center justify-center hover:bg-navy-700 hover:scale-105 shadow-md transition-all z-20"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      )}

      {/* User Information Footer */}
      <div className="p-3 bg-navy-900/60 border-t border-navy-900">
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl p-1.5',
            collapsed ? 'justify-center' : 'justify-between'
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar
              name={user?.fullName || 'User'}
              src={user?.avatarUrl}
              size={collapsed ? 'sm' : 'md'}
              status="online"
            />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {user?.fullName || 'Guest User'}
                </p>
                <p className="text-[10px] text-navy-300 truncate mt-0.5 font-medium">
                  {user?.designation || user?.role || 'Authorized Member'}
                </p>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded-lg text-navy-300 hover:text-rose-400 hover:bg-navy-800 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
