import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  CreditCard,
  PlusCircle,
  Bell,
  User as UserIcon,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Role } from '@/types';
import { cn } from '@/utils/cn';

export interface BottomNavProps {
  className?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({ className }) => {
  const location = useLocation();
  const { user } = useAuthStore();

  const isApprover =
    user &&
    [Role.SUPER_ADMIN, Role.ADMIN, Role.APPROVER, Role.MANAGEMENT, Role.DIRECTOR].includes(
      user.role
    );
  const isAccountant =
    user && [Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT].includes(user.role);

  // Dynamic middle action item
  const middleAction = isApprover
    ? { title: 'Approvals', path: '/approvals', icon: CheckSquare }
    : isAccountant
    ? { title: 'Process', path: '/payments', icon: CreditCard }
    : { title: 'New', path: '/payment-requests/new', icon: PlusCircle };

  const navItems = [
    { title: 'Dashboard', path: '/', icon: LayoutDashboard },
    { title: 'Requests', path: '/payment-requests', icon: FileText },
    middleAction,
    { title: 'Alerts', path: '/notifications', icon: Bell },
    { title: 'Profile', path: '/profile', icon: UserIcon },
  ];

  return (
    <nav
      className={cn(
        'lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-dark-card/95 backdrop-blur-md border-t border-slate-200 dark:border-dark-border px-2 py-1 shadow-lg',
        className
      )}
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-150 select-none flex-1',
                isActive
                  ? 'text-navy-800 dark:text-cyan-400 font-bold scale-105'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              )}
            >
              <div className="relative">
                <Icon className={cn('w-5 h-5', isActive && 'stroke-[2.5px]')} />
                {item.title === 'Alerts' && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-dark-card" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight leading-none">
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
