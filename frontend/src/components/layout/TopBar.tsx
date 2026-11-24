import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  Bell,
  Sun,
  Moon,
  ShieldCheck,
  ChevronDown,
  User as UserIcon,
  Settings,
  LogOut,
  Building,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { Logo } from './Logo';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/DropdownMenu';
import { cn } from '@/utils/cn';

export interface TopBarProps {
  onOpenMobileMenu?: () => void;
  title?: string;
  className?: string;
}

const routeTitleMap: Record<string, string> = {
  '/': 'Financial Dashboard',
  '/payment-requests': 'Payment Requests',
  '/payment-requests/new': 'New Payment Requisition',
  '/approvals': 'Pending Approvals',
  '/payments': 'Payment Processing & Settlement',
  '/vendors': 'Vendor Directory',
  '/companies': 'Company Entities',
  '/departments': 'Department Budgets',
  '/users': 'User Management & Roles',
  '/reports': 'Financial Reports & Analytics',
  '/audit-logs': 'System Audit Logs',
  '/settings': 'System Settings',
  '/notifications': 'Notification Center',
  '/profile': 'User Profile',
};

export const TopBar: React.FC<TopBarProps> = ({
  onOpenMobileMenu,
  title: customTitle,
  className,
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    const savedTheme = localStorage.getItem('mv_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('mv_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('mv_theme', 'light');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Derive page title
  const currentPath = location.pathname;
  let pageTitle = customTitle;
  if (!pageTitle) {
    if (routeTitleMap[currentPath]) {
      pageTitle = routeTitleMap[currentPath];
    } else if (currentPath.startsWith('/payment-requests/')) {
      pageTitle = 'Payment Request Details';
    } else if (currentPath.startsWith('/approvals/')) {
      pageTitle = 'Approval Workflow Details';
    } else {
      pageTitle = 'Payment Approval Gateway';
    }
  }

  return (
    <header
      className={cn(
        'h-16 bg-white dark:bg-dark-card border-b border-slate-200 dark:border-dark-border px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs transition-colors',
        className
      )}
    >
      {/* Left: Hamburger, Logo & Dynamic Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="p-2 -ml-1 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden focus:outline-none transition-colors shrink-0"
            title="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="lg:hidden shrink-0">
          <Logo compact size="sm" to="/" showSubtitle={false} />
        </div>

        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate tracking-tight">
            {pageTitle}
          </h1>
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Enterprise 256-bit Encrypted</span>
            {user?.company && (
              <>
                <span>&bull;</span>
                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                  <Building className="w-3 h-3" />
                  {user.company.name}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions, Theme, Notifications & User Avatar */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={toggleDarkMode}
          className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        {/* Notifications Shortcut */}
        <Link
          to="/notifications"
          className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-dark-card" />
        </Link>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200 dark:bg-dark-border mx-1" />

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <div className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <Avatar
                name={user?.fullName || 'User'}
                src={user?.avatarUrl}
                size="sm"
                status="online"
              />
              <div className="hidden md:flex flex-col text-left leading-none">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[120px]">
                  {user?.fullName || 'User'}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-400 font-medium truncate max-w-[120px] mt-0.5">
                  {user?.role?.replace(/_/g, ' ') || 'Member'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="right" width="w-56">
            <DropdownMenuLabel>
              <div className="leading-tight">
                <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                  {user?.fullName}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-400 truncate lowercase font-mono">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              icon={<UserIcon className="w-4 h-4" />}
              onClick={() => navigate('/profile')}
            >
              My Profile
            </DropdownMenuItem>

            <DropdownMenuItem
              icon={<Settings className="w-4 h-4" />}
              onClick={() => navigate('/settings')}
            >
              Preferences & Settings
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              icon={<LogOut className="w-4 h-4 text-rose-500" />}
              danger
              onClick={handleLogout}
            >
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default TopBar;
