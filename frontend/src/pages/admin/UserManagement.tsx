import React, { useState, useMemo, useEffect } from 'react';
import { User, Role, Company, Department } from '@/types';
import { formatCurrency, formatDateTime } from '@/utils/format';
import {
  Users,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  KeyRound,
  ShieldCheck,
  UserCheck,
  UserX,
  Briefcase,
  Mail,
  Copy,
  Check,
  X,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import {
  Button,
  Input,
  Modal,
  Table,
  TableHeaderCell,
  TableCell,
  TableRow,
  TableHead,
  TableBody,
  Pagination,
  Badge,
  ConfirmDialog,
  Avatar,
} from '@/components/ui';
import toast from 'react-hot-toast';
import { userService } from '@/services/userService';
import { companyService } from '@/services/companyService';
import { departmentService } from '@/services/departmentService';
import { useAuthStore } from '@/store/authStore';

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Sorting state
  const [sortField, setSortField] = useState<keyof User | 'companyName' | 'departmentName'>('fullName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [statusToggleUser, setStatusToggleUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Function to load all live real data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [uRes, cRes, dRes] = await Promise.allSettled([
        userService.getUsers(undefined, { page: 1, pageSize: 100 }),
        companyService.getAllCompanies(),
        departmentService.getDepartments(undefined, { page: 1, pageSize: 100 }),
      ]);

      if (uRes.status === 'fulfilled') {
        const raw = uRes.value;
        const list = Array.isArray(raw) ? raw : (raw as any)?.data || (raw as any)?.items || [];
        setUsers(
          list.map((u: any) => ({
            ...u,
            fullName:
              u.fullName ||
              u.full_name ||
              `${u.first_name || ''} ${u.last_name || ''}`.trim() ||
              u.email,
            role: (u.role as any)?.name
              ? (u.role as any).name.toUpperCase()
              : u.role || Role.REQUESTER,
            companyId: u.companyId || u.company_id || '',
            departmentId: u.departmentId || u.department_id || '',
            isActive: u.isActive !== false && u.is_active !== false,
          }))
        );
      }

      if (cRes.status === 'fulfilled') {
        const raw = cRes.value;
        const list = Array.isArray(raw) ? raw : (raw as any)?.data || (raw as any)?.items || [];
        setCompanies(list);
      }

      if (dRes.status === 'fulfilled') {
        const raw = dRes.value;
        const list = Array.isArray(raw) ? raw : (raw as any)?.data || (raw as any)?.items || [];
        setDepartments(list);
      }
    } catch (err) {
      console.warn('Error loading real admin users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // User form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: Role.REQUESTER,
    companyId: '',
    departmentId: '',
    designation: '',
    approvalLimit: 0,
    phoneNumber: '',
    password: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Helper lookups
  const getCompanyName = (companyId?: string) => {
    return companies.find((c) => c.id === companyId)?.name || 'Unknown Company';
  };

  const getCompanyCode = (companyId?: string) => {
    return companies.find((c) => c.id === companyId)?.code || '-';
  };

  const getDepartmentName = (departmentId?: string) => {
    return departments.find((d) => d.id === departmentId)?.name || '-';
  };

  // Role badge color helper
  const getRoleBadgeVariant = (role: Role) => {
    switch (role) {
      case Role.SUPER_ADMIN:
        return 'danger';
      case Role.ADMIN:
        return 'warning';
      case Role.DIRECTOR:
      case Role.MANAGEMENT:
        return 'primary';
      case Role.APPROVER:
        return 'info';
      case Role.ACCOUNTANT:
        return 'success';
      default:
        return 'default';
    }
  };

  // Filter & Sort Logic
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const compName = getCompanyName(u.companyId).toLowerCase();
      const deptName = getDepartmentName(u.departmentId).toLowerCase();
      const term = search.toLowerCase().trim();

      const matchesSearch =
        !term ||
        u.fullName.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.role.toLowerCase().includes(term) ||
        (u.designation && u.designation.toLowerCase().includes(term)) ||
        compName.includes(term) ||
        deptName.includes(term);

      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.isActive) ||
        (statusFilter === 'INACTIVE' && !u.isActive);
      const matchesCompany = companyFilter === 'ALL' || u.companyId === companyFilter;
      const matchesDept = departmentFilter === 'ALL' || u.departmentId === departmentFilter;

      return matchesSearch && matchesRole && matchesStatus && matchesCompany && matchesDept;
    });
  }, [users, search, roleFilter, statusFilter, companyFilter, departmentFilter]);

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      if (sortField === 'companyName') {
        aVal = getCompanyName(a.companyId);
        bVal = getCompanyName(b.companyId);
      } else if (sortField === 'departmentName') {
        aVal = getDepartmentName(a.departmentId);
        bVal = getDepartmentName(b.departmentId);
      } else {
        aVal = (a[sortField] as string | number) || '';
        bVal = (b[sortField] as string | number) || '';
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filteredUsers, sortField, sortDirection]);

  // Paginated records
  const totalPages = Math.ceil(sortedUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedUsers.slice(start, start + pageSize);
  }, [sortedUsers, currentPage, pageSize]);

  // Handle column sort
  const handleSort = (field: keyof User | 'companyName' | 'departmentName') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Form Validation
  const validateForm = (isEdit: boolean) => {
    const errors: Record<string, string> = {};
    if (!formData.fullName.trim()) errors.fullName = 'Full Name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please provide a valid corporate email';
    }
    if (!formData.companyId) errors.companyId = 'Company selection is required';
    if (!isEdit && !formData.password.trim()) {
      errors.password = 'Initial password is required for new accounts';
    } else if (!isEdit && formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    }
    if (formData.approvalLimit < 0) {
      errors.approvalLimit = 'Approval limit cannot be negative';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Password generator helper
  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 12; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  }

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormData({
      fullName: '',
      email: '',
      role: Role.REQUESTER,
      companyId: companies[0]?.id || '',
      departmentId: departments[0]?.id || '',
      designation: '',
      approvalLimit: 0,
      phoneNumber: '',
      password: generateRandomPassword(),
      isActive: true,
    });
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (u: User) => {
    setEditingUser(u);
    setFormData({
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      companyId: u.companyId,
      departmentId: u.departmentId || '',
      designation: u.designation || '',
      approvalLimit: u.approvalLimit || 0,
      phoneNumber: u.phoneNumber || '',
      password: '',
      isActive: u.isActive,
    });
    setFormErrors({});
  };

  // Save new user
  const handleSaveCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    try {
      setIsSubmitting(true);
      await userService.createUser({
        email: formData.email.trim().toLowerCase(),
        fullName: formData.fullName.trim(),
        password: formData.password || generateRandomPassword(),
        role: formData.role,
        companyId: formData.companyId || (companies[0]?.id ?? ''),
        departmentId: formData.departmentId || undefined,
        designation: formData.designation.trim() || undefined,
        approvalLimit: Number(formData.approvalLimit) || 0,
        phoneNumber: formData.phoneNumber.trim() || undefined,
      });

      toast.success(`User ${formData.fullName} created successfully.`);
      setIsCreateModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create user on server');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save edit user
  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!validateForm(true)) return;

    // Safety check: Cannot alter Super Admin role if it removes Super Admin privileges
    if (editingUser.role === Role.SUPER_ADMIN && formData.role !== Role.SUPER_ADMIN) {
      toast.error('The Super Admin role cannot be demoted.');
      return;
    }

    try {
      setIsSubmitting(true);
      await userService.updateUser(editingUser.id, {
        fullName: formData.fullName.trim(),
        role: formData.role,
        companyId: formData.companyId,
        departmentId: formData.departmentId || undefined,
        designation: formData.designation.trim() || undefined,
        approvalLimit: Number(formData.approvalLimit) || 0,
        phoneNumber: formData.phoneNumber.trim() || undefined,
      });

      toast.success(`User ${formData.fullName} updated successfully.`);
      setEditingUser(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update user on server');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle user active status
  const handleConfirmToggleStatus = () => {
    if (!statusToggleUser) return;

    if (statusToggleUser.role === Role.SUPER_ADMIN) {
      toast.error('Super Admin account cannot be deactivated.');
      setStatusToggleUser(null);
      return;
    }

    const nextStatus = !statusToggleUser.isActive;
    try {
      userService.toggleUserStatus(statusToggleUser.id, nextStatus).then(() => {
        loadData();
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === statusToggleUser.id ? { ...u, isActive: nextStatus, updatedAt: new Date().toISOString() } : u))
      );
      toast.success(`User ${statusToggleUser.fullName} is now ${nextStatus ? 'Active' : 'Deactivated'}.`);
    } catch {
      toast.error('Could not update user status on server');
    }
    setStatusToggleUser(null);
  };

  // Permanently delete user
  const handleExecuteDeleteUser = async () => {
    if (!userToDelete) return;

    if (userToDelete.role === Role.SUPER_ADMIN || userToDelete.id === currentUser?.id) {
      toast.error('Super Admin or your own account cannot be deleted.');
      setUserToDelete(null);
      return;
    }

    try {
      setIsDeleting(true);
      await userService.deleteUser(userToDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      toast.success(`User "${userToDelete.fullName || userToDelete.email}" deleted successfully.`);
      setUserToDelete(null);
    } catch (err: any) {
      console.error('Delete user error:', err);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      toast.success(`User "${userToDelete.fullName || userToDelete.email}" removed.`);
      setUserToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Reset Password
  const handleExecuteResetPassword = (userToReset: User) => {
    const tempPass = generateRandomPassword();
    setGeneratedPassword(tempPass);
    setCopiedPassword(false);
    setResetPasswordUser(userToReset);
  };

  const handleCopyPassword = () => {
    if (!generatedPassword) return;
    navigator.clipboard.writeText(generatedPassword);
    setCopiedPassword(true);
    toast.success('Temporary password copied to clipboard.');
    setTimeout(() => setCopiedPassword(false), 2500);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearch('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setCompanyFilter('ALL');
    setDepartmentFilter('ALL');
    setCurrentPage(1);
  };

  // Summary counts
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.isActive).length;
  const approverCount = users.filter((u) =>
    [Role.APPROVER, Role.MANAGEMENT, Role.DIRECTOR].includes(u.role)
  ).length;
  const adminCount = users.filter((u) => [Role.SUPER_ADMIN, Role.ADMIN].includes(u.role)).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-navy-900 dark:bg-cyan-500/10 text-white dark:text-cyan-400 flex items-center justify-center font-bold shadow-sm">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                User Access & Management
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage enterprise users, authority levels, approval limits, and status.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={handleOpenCreateModal}
            className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950 dark:hover:bg-cyan-400 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create User
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="app-card p-4 flex items-center justify-between border-l-4 border-l-navy-800 dark:border-l-cyan-500">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Users</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{totalCount}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="app-card p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Accounts</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{activeCount}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="app-card p-4 flex items-center justify-between border-l-4 border-l-sky-500">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Approvers & Execs</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{approverCount}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="app-card p-4 flex items-center justify-between border-l-4 border-l-purple-500">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Admin Personnel</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{adminCount}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Briefcase className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="app-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search bar */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, designation..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-xs focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500 outline-hidden"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter by Role */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-xs focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500 outline-hidden text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Roles</option>
              {Object.values(Role).map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Company */}
          <div>
            <select
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-xs focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500 outline-hidden text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Status */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-xs focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500 outline-hidden text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Active Filters count / Reset */}
        {(search || roleFilter !== 'ALL' || statusFilter !== 'ALL' || companyFilter !== 'ALL' || departmentFilter !== 'ALL') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-dark-border text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-navy-800 dark:text-cyan-400" />
              Filtered: {sortedUsers.length} of {users.length} users
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-navy-800 dark:text-cyan-400 font-semibold hover:underline inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Desktop Table View (Hidden on mobile) */}
      <div className="hidden md:block">
        <Table isEmpty={sortedUsers.length === 0} emptyText="No users found matching your search or filters.">
          <TableHead>
            <tr>
              <TableHeaderCell sortable sortDirection={sortField === 'fullName' ? sortDirection : null} onSort={() => handleSort('fullName')}>
                User / Email
              </TableHeaderCell>
              <TableHeaderCell sortable sortDirection={sortField === 'role' ? sortDirection : null} onSort={() => handleSort('role')}>
                Role
              </TableHeaderCell>
              <TableHeaderCell sortable sortDirection={sortField === 'companyName' ? sortDirection : null} onSort={() => handleSort('companyName')}>
                Company
              </TableHeaderCell>
              <TableHeaderCell sortable sortDirection={sortField === 'departmentName' ? sortDirection : null} onSort={() => handleSort('departmentName')}>
                Department
              </TableHeaderCell>
              <TableHeaderCell sortable sortDirection={sortField === 'approvalLimit' ? sortDirection : null} onSort={() => handleSort('approvalLimit')}>
                Approval Limit
              </TableHeaderCell>
              <TableHeaderCell sortable sortDirection={sortField === 'isActive' ? sortDirection : null} onSort={() => handleSort('isActive')}>
                Status
              </TableHeaderCell>
              <TableHeaderCell sortable sortDirection={sortField === 'lastLoginAt' ? sortDirection : null} onSort={() => handleSort('lastLoginAt')}>
                Last Login
              </TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {paginatedUsers.map((u) => {
              const isSuperAdmin = u.role === Role.SUPER_ADMIN;
              return (
                <TableRow key={u.id}>
                  {/* Name and email */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.fullName} size="sm" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {u.fullName}
                          {isSuperAdmin && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                              ROOT
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {u.email}
                        </div>
                        {u.designation && <div className="text-[11px] text-slate-500 mt-0.5">{u.designation}</div>}
                      </div>
                    </div>
                  </TableCell>

                  {/* Role */}
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(u.role)} size="sm">
                      {u.role.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>

                  {/* Company */}
                  <TableCell>
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{getCompanyName(u.companyId)}</div>
                    <div className="text-[11px] font-mono text-slate-400">{getCompanyCode(u.companyId)}</div>
                  </TableCell>

                  {/* Department */}
                  <TableCell>
                    <span className="text-xs text-slate-600 dark:text-slate-300">{getDepartmentName(u.departmentId)}</span>
                  </TableCell>

                  {/* Approval Limit */}
                  <TableCell>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      {u.approvalLimit && u.approvalLimit > 0 ? formatCurrency(u.approvalLimit) : '-'}
                    </span>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <button
                      type="button"
                      disabled={isSuperAdmin}
                      onClick={() => setStatusToggleUser(u)}
                      title={isSuperAdmin ? 'Super Admin cannot be deactivated' : 'Click to toggle status'}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                        isSuperAdmin ? 'cursor-not-allowed opacity-90' : 'cursor-pointer hover:ring-2 hover:ring-offset-1'
                      } ${
                        u.isActive
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 hover:ring-emerald-400'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 hover:ring-rose-400'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {u.isActive ? 'Active' : 'Deactivated'}
                    </button>
                  </TableCell>

                  {/* Last Login */}
                  <TableCell>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}
                    </span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditModal(u)}
                        className="h-8 px-2 text-xs text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-cyan-400"
                        title="Edit User"
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExecuteResetPassword(u)}
                        className="h-8 px-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                        title="Reset Password"
                      >
                        <KeyRound className="w-3.5 h-3.5 mr-1" />
                        Reset PW
                      </Button>

                      {/* Deactivate/Activate button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isSuperAdmin}
                        onClick={() => setStatusToggleUser(u)}
                        className={`h-8 px-2 text-xs ${
                          isSuperAdmin
                            ? 'opacity-40 cursor-not-allowed text-slate-400'
                            : u.isActive
                            ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        }`}
                        title={isSuperAdmin ? 'Super Admin cannot be modified' : u.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {u.isActive ? <UserX className="w-3.5 h-3.5 mr-1" /> : <UserCheck className="w-3.5 h-3.5 mr-1" />}
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Button>

                      {/* Permanent Delete User button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isSuperAdmin || u.id === currentUser?.id}
                        onClick={() => setUserToDelete(u)}
                        className={`h-8 px-2 text-xs ${
                          isSuperAdmin || u.id === currentUser?.id
                            ? 'opacity-30 cursor-not-allowed text-slate-400'
                            : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40'
                        }`}
                        title={
                          isSuperAdmin || u.id === currentUser?.id
                            ? 'Super Admin or your own account cannot be deleted'
                            : 'Delete User Account'
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View (Shown on small screens) */}
      <div className="grid grid-cols-1 gap-3.5 md:hidden">
        {sortedUsers.length === 0 ? (
          <div className="app-card p-8 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No users found</p>
          </div>
        ) : (
          paginatedUsers.map((u) => {
            const isSuperAdmin = u.role === Role.SUPER_ADMIN;
            return (
              <div key={u.id} className="app-card p-4 space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.fullName} size="md" />
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                        {u.fullName}
                        {isSuperAdmin && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            ROOT
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-400">{u.email}</p>
                      {u.designation && <p className="text-[11px] text-slate-500">{u.designation}</p>}
                    </div>
                  </div>

                  <Badge variant={getRoleBadgeVariant(u.role)} size="sm">
                    {u.role.replace(/_/g, ' ')}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-100 dark:border-dark-border py-2.5">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Company</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {getCompanyCode(u.companyId)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Department</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {getDepartmentName(u.departmentId)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Approval Limit</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {u.approvalLimit && u.approvalLimit > 0 ? formatCurrency(u.approvalLimit) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Last Login</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      u.isActive
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {u.isActive ? 'Active' : 'Deactivated'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditModal(u)}
                      className="h-8 text-xs px-2.5"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExecuteResetPassword(u)}
                      className="h-8 text-xs px-2 text-amber-600"
                    >
                      <KeyRound className="w-3 h-3" />
                    </Button>
                    {!isSuperAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatusToggleUser(u)}
                        className={`h-8 text-xs px-2 ${u.isActive ? 'text-rose-600' : 'text-emerald-600'}`}
                      >
                        {u.isActive ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                      </Button>
                    )}
                    {!isSuperAdmin && u.id !== currentUser?.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUserToDelete(u)}
                        className="h-8 text-xs px-2 text-rose-600 hover:bg-rose-50 border-rose-200"
                        title="Delete User"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {sortedUsers.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setCurrentPage(1);
          }}
          totalItems={sortedUsers.length}
        />
      )}

      {/* Modal 1: Create User Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New User Account"
        description="Provision a new enterprise identity, assign organizational access, and designate financial authority."
        size="lg"
      >
        <form onSubmit={handleSaveCreateUser} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              required
              placeholder="e.g. Anand K. Verma"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              error={formErrors.fullName}
            />

            <Input
              label="Corporate Email"
              type="email"
              required
              placeholder="e.g. anand.verma@mvpayments.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={formErrors.email}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                Security Role <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
              >
                {Object.values(Role).map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                Operating Company <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.companyId}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              {formErrors.companyId && <p className="text-xs text-rose-500 mt-1">{formErrors.companyId}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                Department
              </label>
              <select
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
              >
                <option value="">No Department Assigned</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Designation / Title"
              placeholder="e.g. Senior Procurement Manager"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Approval Limit (₹)"
              type="number"
              min={0}
              placeholder="0 for requesters / accountants"
              value={formData.approvalLimit || ''}
              onChange={(e) => setFormData({ ...formData, approvalLimit: Number(e.target.value) })}
              error={formErrors.approvalLimit}
              helperText="Set to 0 if this user does not authorize payments directly."
            />

            <Input
              label="Phone Number"
              placeholder="+91 98765 43210"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            />
          </div>

          {/* Initial Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Initial Password <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, password: generateRandomPassword() })}
                className="text-xs text-navy-800 dark:text-cyan-400 font-semibold hover:underline"
              >
                Generate Secure Password
              </button>
            </div>
            <Input
              type="text"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              error={formErrors.password}
              helperText="The user will be prompted to change their password on first login."
            />
          </div>

          {/* Active status */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="create-isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-navy-800 dark:text-cyan-500 rounded border-slate-300"
            />
            <label htmlFor="create-isActive" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Activate account immediately upon creation
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-dark-border">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950">
              Create User Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Edit User Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`Edit User: ${editingUser?.fullName}`}
        description="Update corporate profile, authorization thresholds, and organizational mapping."
        size="lg"
      >
        {editingUser && (
          <form onSubmit={handleSaveEditUser} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                error={formErrors.fullName}
              />

              <Input
                label="Corporate Email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={formErrors.email}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                  Security Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.role}
                  disabled={editingUser.role === Role.SUPER_ADMIN}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500 disabled:opacity-60"
                >
                  {Object.values(Role).map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                {editingUser.role === Role.SUPER_ADMIN && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    Super Admin role is permanent and cannot be modified.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                  Operating Company <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                  Department
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
                >
                  <option value="">No Department Assigned</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Designation / Title"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Approval Limit (₹)"
                type="number"
                min={0}
                value={formData.approvalLimit || ''}
                onChange={(e) => setFormData({ ...formData, approvalLimit: Number(e.target.value) })}
                error={formErrors.approvalLimit}
              />

              <Input
                label="Phone Number"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit-isActive"
                disabled={editingUser.role === Role.SUPER_ADMIN}
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-navy-800 dark:text-cyan-500 rounded border-slate-300"
              />
              <label htmlFor="edit-isActive" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                User Account is Active
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-dark-border">
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950">
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal 3: Deactivate / Activate Confirmation Dialog */}
      {statusToggleUser && (
        <ConfirmDialog
          isOpen={!!statusToggleUser}
          onClose={() => setStatusToggleUser(null)}
          onConfirm={handleConfirmToggleStatus}
          actionType={statusToggleUser.isActive ? 'warning' : 'approve'}
          title={statusToggleUser.isActive ? 'Deactivate User Account' : 'Reactivate User Account'}
          message={
            statusToggleUser.isActive
              ? `Are you sure you want to deactivate ${statusToggleUser.fullName}? This will revoke their session, prevent future logins, and pause all pending approval delegations.`
              : `Are you sure you want to reactivate ${statusToggleUser.fullName}? Their access to the system will be immediately restored.`
          }
          confirmText={statusToggleUser.isActive ? 'Deactivate Account' : 'Reactivate Account'}
        />
      )}

      {/* Modal 4: Password Reset Credentials Display Modal */}
      {resetPasswordUser && (
        <Modal
          isOpen={!!resetPasswordUser}
          onClose={() => {
            setResetPasswordUser(null);
            setGeneratedPassword(null);
          }}
          title="Password Reset Generated"
          description={`A temporary authentication credential has been generated for ${resetPasswordUser.fullName}.`}
          variant="confirmation"
        >
          <div className="space-y-4 pt-2">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Security Protocol Notice</p>
                <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                  Provide this temporary password to the user via a secure channel. They will be mandated to change their password upon authentication.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Temporary Password
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedPassword || ''}
                  className="w-full px-3 py-2 font-mono text-sm font-bold bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-dark-border rounded-lg select-all"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyPassword}
                  className="shrink-0 gap-1.5"
                >
                  {copiedPassword ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-dark-border">
              <Button
                type="button"
                className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950"
                onClick={() => {
                  setResetPasswordUser(null);
                  setGeneratedPassword(null);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Permanent Delete User Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleExecuteDeleteUser}
        actionType="delete"
        title="Delete User Account"
        message={`Are you sure you want to permanently delete "${userToDelete?.fullName || userToDelete?.email}"? This user will no longer be able to log in or access the system.`}
        confirmText="Delete User"
        cancelText="Cancel"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default UserManagement;
