import React, { useState, useMemo } from 'react';
import { Department, Company } from '@/types';
import { formatCurrency } from '@/utils/format';
import {
  Network,
  Plus,
  Search,
  Filter,
  Edit2,
  Power,
  RotateCcw,
  UserCheck,
  Building2,
  PieChart,
  X,
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
  ConfirmDialog,
} from '@/components/ui';
import toast from 'react-hot-toast';
import { departmentService } from '@/services/departmentService';
import { companyService } from '@/services/companyService';

export const DepartmentManagement: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [dRes, cRes] = await Promise.allSettled([
        departmentService.getDepartments(undefined, { page: 1, pageSize: 100 }),
        companyService.getAllCompanies(),
      ]);

      if (dRes.status === 'fulfilled') {
        const raw = dRes.value;
        const list = Array.isArray(raw) ? raw : (raw as any)?.data || (raw as any)?.items || [];
        setDepartments(list);
      }

      if (cRes.status === 'fulfilled') {
        const raw = cRes.value;
        const list = Array.isArray(raw) ? raw : (raw as any)?.data || (raw as any)?.items || [];
        setCompanies(list);
      }
    } catch (err) {
      console.warn('Could not load departments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Sorting
  const [sortField, setSortField] = useState<keyof Department | 'companyName'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [statusToggleDept, setStatusToggleDept] = useState<Department | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    companyId: companies[0]?.id || '',
    headName: '',
    budget: 0,
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Lookups
  const getCompanyName = (companyId?: string) => {
    return companies.find((c) => c.id === companyId)?.name || 'Unknown Company';
  };

  const getCompanyCode = (companyId?: string) => {
    return companies.find((c) => c.id === companyId)?.code || '-';
  };

  // Filter & Search
  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      const compName = getCompanyName(d.companyId).toLowerCase();
      const term = search.toLowerCase().trim();

      const matchesSearch =
        !term ||
        d.name.toLowerCase().includes(term) ||
        d.code.toLowerCase().includes(term) ||
        (d.headName && d.headName.toLowerCase().includes(term)) ||
        compName.includes(term);

      const matchesCompany = companyFilter === 'ALL' || d.companyId === companyFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && d.isActive) ||
        (statusFilter === 'INACTIVE' && !d.isActive);

      return matchesSearch && matchesCompany && matchesStatus;
    });
  }, [departments, search, companyFilter, statusFilter]);

  // Sort
  const sortedDepartments = useMemo(() => {
    return [...filteredDepartments].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      if (sortField === 'companyName') {
        aVal = getCompanyName(a.companyId);
        bVal = getCompanyName(b.companyId);
      } else {
        aVal = (a[sortField] as string | number) || '';
        bVal = (b[sortField] as string | number) || '';
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filteredDepartments, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedDepartments.length / pageSize) || 1;
  const paginatedDepartments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedDepartments.slice(start, start + pageSize);
  }, [sortedDepartments, currentPage, pageSize]);

  const handleSort = (field: keyof Department | 'companyName') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Validation
  const validateForm = (isEdit: boolean) => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Department Name is required';
    if (!formData.code.trim()) {
      errors.code = 'Department Code is required';
    } else if (!/^[A-Z0-9_-]{2,12}$/i.test(formData.code.trim())) {
      errors.code = 'Code must be 2-12 alphanumeric characters (e.g. DEP-PROC)';
    }

    const existing = departments.find(
      (d) =>
        d.code.toLowerCase() === formData.code.trim().toLowerCase() &&
        d.companyId === formData.companyId &&
        (!isEdit || d.id !== editingDept?.id)
    );
    if (existing) {
      errors.code = 'Department code already exists in this company';
    }

    if (!formData.companyId) errors.companyId = 'Company selection is required';
    if (formData.budget < 0) errors.budget = 'Budget amount cannot be negative';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open Create
  const handleOpenCreate = () => {
    setFormData({
      name: '',
      code: '',
      companyId: companies[0]?.id || '',
      headName: '',
      budget: 10000000,
      isActive: true,
    });
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  // Open Edit
  const handleOpenEdit = (d: Department) => {
    setEditingDept(d);
    setFormData({
      name: d.name,
      code: d.code,
      companyId: d.companyId,
      headName: d.headName || '',
      budget: d.budget || 0,
      isActive: d.isActive,
    });
    setFormErrors({});
  };

  // Save Create
  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    const newDept: Department = {
      id: `dept_${Date.now()}`,
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      companyId: formData.companyId,
      headName: formData.headName.trim() || undefined,
      budget: Number(formData.budget) || 0,
      currentSpend: 0,
      isActive: formData.isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDepartments((prev) => [newDept, ...prev]);
    setIsCreateModalOpen(false);
    toast.success(`Department ${newDept.name} created successfully.`);
  };

  // Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    if (!validateForm(true)) return;

    setDepartments((prev) =>
      prev.map((d) => {
        if (d.id === editingDept.id) {
          return {
            ...d,
            name: formData.name.trim(),
            code: formData.code.trim().toUpperCase(),
            companyId: formData.companyId,
            headName: formData.headName.trim() || undefined,
            budget: Number(formData.budget) || 0,
            isActive: formData.isActive,
            updatedAt: new Date().toISOString(),
          };
        }
        return d;
      })
    );

    setEditingDept(null);
    toast.success(`Department ${formData.name} updated successfully.`);
  };

  // Toggle status
  const handleConfirmToggleStatus = () => {
    if (!statusToggleDept) return;

    const nextStatus = !statusToggleDept.isActive;
    setDepartments((prev) =>
      prev.map((d) =>
        d.id === statusToggleDept.id ? { ...d, isActive: nextStatus, updatedAt: new Date().toISOString() } : d
      )
    );

    toast.success(`Department ${statusToggleDept.name} is now ${nextStatus ? 'Active' : 'Deactivated'}.`);
    setStatusToggleDept(null);
  };

  // Total budget & spend across departments
  const totalBudget = departments.reduce((acc, d) => acc + (d.budget || 0), 0);
  const totalSpend = departments.reduce((acc, d) => acc + (d.currentSpend || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-navy-900 dark:bg-cyan-500/10 text-white dark:text-cyan-400 flex items-center justify-center font-bold shadow-sm">
              <Network className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Department Centers & Budgets
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Department cost centers, head administrators, and financial expenditure allocations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={handleOpenCreate}
            className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950 dark:hover:bg-cyan-400 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Department
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="app-card p-4 border-l-4 border-l-navy-800 dark:border-l-cyan-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Departments</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{departments.length}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Network className="w-4 h-4" />
          </div>
        </div>

        <div className="app-card p-4 border-l-4 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Budget Allocated</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{formatCurrency(totalBudget)}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <PieChart className="w-4 h-4" />
          </div>
        </div>

        <div className="app-card p-4 border-l-4 border-l-cyan-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Current Spend</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{formatCurrency(totalSpend)}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="app-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search department name, code, head..."
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

        {(search || companyFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-dark-border text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-navy-800 dark:text-cyan-400" />
              Filtered: {sortedDepartments.length} of {departments.length} departments
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCompanyFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="text-xs text-navy-800 dark:text-cyan-400 font-semibold hover:underline inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Table isEmpty={sortedDepartments.length === 0} emptyText="No departments found.">
          <TableHead>
            <tr>
              <TableHeaderCell sortable sortDirection={sortField === 'name' ? sortDirection : null} onSort={() => handleSort('name')}>
                Department / Code
              </TableHeaderCell>
              <TableHeaderCell sortable sortDirection={sortField === 'companyName' ? sortDirection : null} onSort={() => handleSort('companyName')}>
                Operating Company
              </TableHeaderCell>
              <TableHeaderCell sortable sortDirection={sortField === 'headName' ? sortDirection : null} onSort={() => handleSort('headName')}>
                Department Head
              </TableHeaderCell>
              <TableHeaderCell sortable sortDirection={sortField === 'budget' ? sortDirection : null} onSort={() => handleSort('budget')}>
                Budget & Utilization
              </TableHeaderCell>
              <TableHeaderCell sortable sortDirection={sortField === 'isActive' ? sortDirection : null} onSort={() => handleSort('isActive')}>
                Status
              </TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {paginatedDepartments.map((d) => {
              const budget = d.budget || 0;
              const spend = d.currentSpend || 0;
              const percent = budget > 0 ? Math.min(Math.round((spend / budget) * 100), 100) : 0;
              const isOverBudget = spend > budget;

              return (
                <TableRow key={d.id}>
                  {/* Department & Code */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-navy-50 dark:bg-navy-950/60 text-navy-800 dark:text-cyan-400 flex items-center justify-center font-bold shrink-0">
                        <Network className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{d.name}</div>
                        <div className="text-xs font-mono font-medium text-slate-400">{d.code}</div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Company */}
                  <TableCell>
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      {getCompanyName(d.companyId)}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">{getCompanyCode(d.companyId)}</div>
                  </TableCell>

                  {/* Department Head */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs uppercase text-slate-700 dark:text-slate-200">
                        {d.headName ? d.headName.charAt(0) : '?'}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          {d.headName || 'Unassigned'}
                        </div>
                        <div className="text-[10px] text-slate-400">Department Head</div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Budget & Utilization Bar */}
                  <TableCell>
                    <div className="space-y-1.5 min-w-[180px]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(spend)}
                        </span>
                        <span className="text-slate-400">of {formatCurrency(budget)}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOverBudget
                              ? 'bg-rose-500'
                              : percent > 80
                              ? 'bg-amber-500'
                              : 'bg-emerald-500 dark:bg-cyan-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{percent}% utilized</span>
                        {isOverBudget && <span className="text-rose-500 font-bold">Over Budget</span>}
                      </div>
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setStatusToggleDept(d)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all ${
                        d.isActive
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 hover:ring-emerald-400'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 hover:ring-rose-400'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${d.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {d.isActive ? 'Active' : 'Deactivated'}
                    </button>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(d)}
                        className="h-8 px-2.5 text-xs text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-cyan-400"
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStatusToggleDept(d)}
                        className={`h-8 px-2 text-xs ${
                          d.isActive
                            ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5 mr-1" />
                        {d.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-3.5 md:hidden">
        {paginatedDepartments.map((d) => {
          const budget = d.budget || 0;
          const spend = d.currentSpend || 0;
          const percent = budget > 0 ? Math.min(Math.round((spend / budget) * 100), 100) : 0;

          return (
            <div key={d.id} className="app-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-navy-50 dark:bg-navy-950/60 text-navy-800 dark:text-cyan-400 flex items-center justify-center font-bold shrink-0">
                    <Network className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{d.name}</h3>
                    <span className="font-mono text-xs text-slate-400">{d.code}</span>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    d.isActive
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${d.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {d.isActive ? 'Active' : 'Deactivated'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-100 dark:border-dark-border py-2">
                <div>
                  <span className="text-slate-400 block text-[11px]">Company</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {getCompanyCode(d.companyId)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Head</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {d.headName || 'Unassigned'}
                  </span>
                </div>
              </div>

              {/* Spend progress */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatCurrency(spend)}
                  </span>
                  <span className="text-slate-400">{percent}% of {formatCurrency(budget)}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-navy-800 dark:bg-cyan-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEdit(d)}
                  className="h-8 text-xs"
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusToggleDept(d)}
                  className={`h-8 text-xs ${d.isActive ? 'text-rose-600' : 'text-emerald-600'}`}
                >
                  <Power className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {sortedDepartments.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setCurrentPage(1);
          }}
          totalItems={sortedDepartments.length}
        />
      )}

      {/* Modal: Create Department */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Department Cost Center"
        description="Establish an organizational unit with an approved annual budget allocation and department head."
        size="md"
      >
        <form onSubmit={handleSaveCreate} className="space-y-4 pt-2">
          <Input
            label="Department Name"
            required
            placeholder="e.g. Procurement & Logistics"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Department Code"
              required
              placeholder="e.g. DEP-PROC"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              error={formErrors.code}
              helperText="Unique uppercase cost center code."
            />

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

          <Input
            label="Department Head Name"
            placeholder="e.g. Vikram Malhotra"
            value={formData.headName}
            onChange={(e) => setFormData({ ...formData, headName: e.target.value })}
            helperText="Lead executive accountable for expenditure approvals in this department."
          />

          <Input
            label="Allocated Annual Budget (₹)"
            type="number"
            min={0}
            placeholder="10000000"
            value={formData.budget || ''}
            onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
            error={formErrors.budget}
            helperText="Expenditure above this threshold triggers automatic budget exception alerts."
          />

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="dept-create-active"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-navy-800 dark:text-cyan-500 rounded border-slate-300"
            />
            <label htmlFor="dept-create-active" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Department is active for new payment requisitions
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-dark-border">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950">
              Create Department
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Department */}
      <Modal
        isOpen={!!editingDept}
        onClose={() => setEditingDept(null)}
        title={`Edit Department: ${editingDept?.name}`}
        description="Modify department identification, designated authority, and allocated funding."
        size="md"
      >
        {editingDept && (
          <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
            <Input
              label="Department Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={formErrors.name}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Department Code"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                error={formErrors.code}
              />

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

            <Input
              label="Department Head Name"
              value={formData.headName}
              onChange={(e) => setFormData({ ...formData, headName: e.target.value })}
            />

            <Input
              label="Allocated Annual Budget (₹)"
              type="number"
              min={0}
              value={formData.budget || ''}
              onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
              error={formErrors.budget}
            />

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="dept-edit-active"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-navy-800 dark:text-cyan-500 rounded border-slate-300"
              />
              <label htmlFor="dept-edit-active" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Department is active for new payment requisitions
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-dark-border">
              <Button type="button" variant="outline" onClick={() => setEditingDept(null)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950">
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirmation Dialog */}
      {statusToggleDept && (
        <ConfirmDialog
          isOpen={!!statusToggleDept}
          onClose={() => setStatusToggleDept(null)}
          onConfirm={handleConfirmToggleStatus}
          actionType={statusToggleDept.isActive ? 'warning' : 'approve'}
          title={statusToggleDept.isActive ? 'Deactivate Department' : 'Activate Department'}
          message={
            statusToggleDept.isActive
              ? `Are you sure you want to deactivate ${statusToggleDept.name} (${statusToggleDept.code})? Staff will not be able to charge requisitions against this cost center.`
              : `Are you sure you want to activate ${statusToggleDept.name} (${statusToggleDept.code})? The department will be restored.`
          }
          confirmText={statusToggleDept.isActive ? 'Deactivate Department' : 'Activate Department'}
        />
      )}
    </div>
  );
};

export default DepartmentManagement;
