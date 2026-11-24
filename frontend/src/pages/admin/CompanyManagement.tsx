import React, { useState, useMemo } from 'react';
import { Company } from '@/types';
import { formatDateTime } from '@/utils/format';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Edit2,
  Check,
  X,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Power,
  RotateCcw,
  Palette,
  CreditCard,
  Copy,
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
} from '@/components/ui';
import toast from 'react-hot-toast';
import { companyService } from '@/services/companyService';

export const CompanyManagement: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const loadCompanies = async () => {
    setIsLoading(true);
    try {
      const res = await companyService.getAllCompanies();
      const list = Array.isArray(res) ? res : (res as any)?.data || (res as any)?.items || [];
      setCompanies(list);
    } catch (err) {
      console.warn('Could not load companies from API:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadCompanies();
  }, []);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // Sorting state
  const [sortField, setSortField] = useState<keyof Company>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [statusToggleCompany, setStatusToggleCompany] = useState<Company | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    gstNumber: '',
    panNumber: '',
    primaryColor: '#1b365d',
    secondaryColor: '#00b4d8',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Filter & Search
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const term = search.toLowerCase().trim();
      const matchesSearch =
        !term ||
        c.name.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term) ||
        (c.city && c.city.toLowerCase().includes(term)) ||
        (c.gstNumber && c.gstNumber.toLowerCase().includes(term)) ||
        (c.panNumber && c.panNumber.toLowerCase().includes(term));

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && c.isActive) ||
        (statusFilter === 'INACTIVE' && !c.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [companies, search, statusFilter]);

  // Sort
  const sortedCompanies = useMemo(() => {
    return [...filteredCompanies].sort((a, b) => {
      const aVal = (a[sortField] as string | boolean | undefined) || '';
      const bVal = (b[sortField] as string | boolean | undefined) || '';

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [filteredCompanies, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedCompanies.length / pageSize) || 1;
  const paginatedCompanies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedCompanies.slice(start, start + pageSize);
  }, [sortedCompanies, currentPage, pageSize]);

  const handleSort = (field: keyof Company) => {
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
    if (!formData.name.trim()) errors.name = 'Company Name is required';
    if (!formData.code.trim()) {
      errors.code = 'Company Code is required';
    } else if (!/^[A-Z0-9_-]{2,12}$/i.test(formData.code.trim())) {
      errors.code = 'Code must be 2-12 alphanumeric characters (e.g. MV-CORP)';
    }

    // Check code uniqueness
    const existing = companies.find(
      (c) => c.code.toLowerCase() === formData.code.trim().toLowerCase() && (!isEdit || c.id !== editingCompany?.id)
    );
    if (existing) {
      errors.code = 'Company code is already assigned to another entity';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Invalid corporate email format';
    }

    if (formData.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(formData.gstNumber.trim())) {
      errors.gstNumber = 'Invalid 15-character GSTIN format (e.g. 27AABCM9910E1Z4)';
    }

    if (formData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(formData.panNumber.trim())) {
      errors.panNumber = 'Invalid 10-character PAN format (e.g. AABCM9910E)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormData({
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      phone: '',
      email: '',
      gstNumber: '',
      panNumber: '',
      primaryColor: '#1b365d',
      secondaryColor: '#00b4d8',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      branchName: '',
      isActive: true,
    });
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (c: Company) => {
    setEditingCompany(c);
    setFormData({
      name: c.name,
      code: c.code,
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      pincode: c.pincode || '',
      phone: c.phone || '',
      email: c.email || '',
      gstNumber: c.gstNumber || '',
      panNumber: c.panNumber || '',
      primaryColor: c.primaryColor || '#1b365d',
      secondaryColor: c.secondaryColor || '#00b4d8',
      bankName: c.bankDetails?.bankName || '',
      accountNumber: c.bankDetails?.accountNumber || '',
      ifscCode: c.bankDetails?.ifscCode || '',
      branchName: c.bankDetails?.branchName || '',
      isActive: c.isActive,
    });
    setFormErrors({});
  };

  // Save new company
  const handleSaveCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    const newCompany: Company = {
      id: `comp_${Date.now()}`,
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      address: formData.address.trim() || undefined,
      city: formData.city.trim() || undefined,
      state: formData.state.trim() || undefined,
      pincode: formData.pincode.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      email: formData.email.trim().toLowerCase() || undefined,
      gstNumber: formData.gstNumber.trim().toUpperCase() || undefined,
      panNumber: formData.panNumber.trim().toUpperCase() || undefined,
      primaryColor: formData.primaryColor || '#1b365d',
      secondaryColor: formData.secondaryColor || '#00b4d8',
      bankDetails: formData.accountNumber
        ? {
            bankName: formData.bankName.trim() || 'Bank',
            accountNumber: formData.accountNumber.trim(),
            ifscCode: formData.ifscCode.trim().toUpperCase(),
            branchName: formData.branchName.trim() || undefined,
            accountType: 'CURRENT',
          }
        : undefined,
      isActive: formData.isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await companyService.createCompany({
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        pincode: formData.pincode.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim().toLowerCase() || undefined,
        gstNumber: formData.gstNumber.trim().toUpperCase() || undefined,
        panNumber: formData.panNumber.trim().toUpperCase() || undefined,
        primaryColor: formData.primaryColor || '#0D5C3A',
        secondaryColor: formData.secondaryColor || '#10B981',
      });
      toast.success(`Company ${formData.name} created successfully.`);
      setIsCreateModalOpen(false);
      await loadCompanies();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create company on server');
    }
  };

  // Save edited company
  const handleSaveEditCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    if (!validateForm(true)) return;

    setCompanies((prev) =>
      prev.map((c) => {
        if (c.id === editingCompany.id) {
          return {
            ...c,
            name: formData.name.trim(),
            code: formData.code.trim().toUpperCase(),
            address: formData.address.trim() || undefined,
            city: formData.city.trim() || undefined,
            state: formData.state.trim() || undefined,
            pincode: formData.pincode.trim() || undefined,
            phone: formData.phone.trim() || undefined,
            email: formData.email.trim().toLowerCase() || undefined,
            gstNumber: formData.gstNumber.trim().toUpperCase() || undefined,
            panNumber: formData.panNumber.trim().toUpperCase() || undefined,
            primaryColor: formData.primaryColor || '#1b365d',
            secondaryColor: formData.secondaryColor || '#00b4d8',
            bankDetails: formData.accountNumber
              ? {
                  bankName: formData.bankName.trim() || 'Bank',
                  accountNumber: formData.accountNumber.trim(),
                  ifscCode: formData.ifscCode.trim().toUpperCase(),
                  branchName: formData.branchName.trim() || undefined,
                  accountType: 'CURRENT',
                }
              : c.bankDetails,
            isActive: formData.isActive,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      })
    );

    setEditingCompany(null);
    toast.success(`Company ${formData.name} updated successfully.`);
  };

  // Toggle company active status
  const handleConfirmToggleStatus = () => {
    if (!statusToggleCompany) return;

    const nextStatus = !statusToggleCompany.isActive;
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === statusToggleCompany.id ? { ...c, isActive: nextStatus, updatedAt: new Date().toISOString() } : c
      )
    );

    toast.success(`Company ${statusToggleCompany.name} is now ${nextStatus ? 'Active' : 'Deactivated'}.`);
    setStatusToggleCompany(null);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-navy-900 dark:bg-cyan-500/10 text-white dark:text-cyan-400 flex items-center justify-center font-bold shadow-sm">
              <Building2 className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Company Entities & Multi-Tenancy
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure legal corporations, statutory GST/PAN details, branding, and billing accounts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="hidden sm:flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-dark-border text-xs">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-dark-card text-navy-900 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Table View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-dark-card text-navy-900 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Grid Cards
            </button>
          </div>

          <Button
            type="button"
            onClick={handleOpenCreateModal}
            className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950 dark:hover:bg-cyan-400 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Company
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="app-card p-4 border-l-4 border-l-navy-800 dark:border-l-cyan-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Entities</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{companies.length}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Building2 className="w-4 h-4" />
          </div>
        </div>

        <div className="app-card p-4 border-l-4 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Entities</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {companies.filter((c) => c.isActive).length}
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="app-card p-4 border-l-4 border-l-amber-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Deactivated Entities</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {companies.filter((c) => !c.isActive).length}
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="app-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search companies by name, code, GSTIN, PAN, or city..."
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

        {(search || statusFilter !== 'ALL') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-dark-border text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-navy-800 dark:text-cyan-400" />
              Filtered: {sortedCompanies.length} of {companies.length} companies
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch('');
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

      {/* Grid Cards View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedCompanies.map((c) => (
            <div
              key={c.id}
              className="app-card overflow-hidden flex flex-col justify-between border-t-4"
              style={{ borderTopColor: c.primaryColor || '#1b365d' }}
            >
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs"
                      style={{ backgroundColor: c.primaryColor || '#1b365d' }}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug">
                        {c.name}
                      </h3>
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {c.code}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      c.isActive
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {c.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </div>

                {/* Statutory Numbers */}
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">GSTIN</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {c.gstNumber || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">PAN</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {c.panNumber || '-'}
                    </span>
                  </div>
                </div>

                {/* Contact & Address */}
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {c.address && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>
                        {c.address}, {c.city}, {c.state} - {c.pincode}
                      </span>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-500 truncate">{c.email}</span>
                    </div>
                  )}
                </div>

                {/* Branding colors */}
                <div className="flex items-center gap-3 pt-1 border-t border-slate-100 dark:border-dark-border text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5" />
                    Branding:
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full border border-slate-300 dark:border-dark-border"
                      style={{ backgroundColor: c.primaryColor }}
                      title={`Primary: ${c.primaryColor}`}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-slate-300 dark:border-dark-border"
                      style={{ backgroundColor: c.secondaryColor }}
                      title={`Secondary: ${c.secondaryColor}`}
                    />
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-dark-border flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusToggleCompany(c)}
                  className={`text-xs ${
                    c.isActive
                      ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                      : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                  }`}
                >
                  <Power className="w-3.5 h-3.5 mr-1" />
                  {c.isActive ? 'Deactivate' : 'Activate'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEditModal(c)}
                  className="text-xs"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                  Edit Entity
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table View (and Desktop view) */}
      {viewMode === 'table' && (
        <div className="hidden md:block">
          <Table isEmpty={sortedCompanies.length === 0} emptyText="No operating companies found.">
            <TableHead>
              <tr>
                <TableHeaderCell sortable sortDirection={sortField === 'name' ? sortDirection : null} onSort={() => handleSort('name')}>
                  Company / Code
                </TableHeaderCell>
                <TableHeaderCell sortable sortDirection={sortField === 'gstNumber' ? sortDirection : null} onSort={() => handleSort('gstNumber')}>
                  GSTIN / PAN
                </TableHeaderCell>
                <TableHeaderCell sortable sortDirection={sortField === 'city' ? sortDirection : null} onSort={() => handleSort('city')}>
                  Location
                </TableHeaderCell>
                <TableHeaderCell sortable sortDirection={sortField === 'phone' ? sortDirection : null} onSort={() => handleSort('phone')}>
                  Contact
                </TableHeaderCell>
                <TableHeaderCell>Branding</TableHeaderCell>
                <TableHeaderCell sortable sortDirection={sortField === 'isActive' ? sortDirection : null} onSort={() => handleSort('isActive')}>
                  Status
                </TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {paginatedCompanies.map((c) => (
                <TableRow key={c.id}>
                  {/* Name and code */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-xs shrink-0"
                        style={{ backgroundColor: c.primaryColor || '#1b365d' }}
                      >
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {c.name}
                        </div>
                        <div className="text-xs font-mono font-medium text-slate-400">{c.code}</div>
                      </div>
                    </div>
                  </TableCell>

                  {/* GSTIN / PAN */}
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 font-mono text-xs text-slate-800 dark:text-slate-200">
                        <span className="text-[10px] text-slate-400 font-sans font-bold">GST:</span>
                        {c.gstNumber || '-'}
                        {c.gstNumber && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(c.gstNumber!, 'GSTIN')}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            title="Copy GSTIN"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1 font-mono text-xs text-slate-600 dark:text-slate-400">
                        <span className="text-[10px] text-slate-400 font-sans font-bold">PAN:</span>
                        {c.panNumber || '-'}
                      </div>
                    </div>
                  </TableCell>

                  {/* Location */}
                  <TableCell>
                    <div className="text-xs text-slate-700 dark:text-slate-300">
                      {c.city ? `${c.city}, ${c.state || ''}` : '-'}
                    </div>
                    {c.address && <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{c.address}</div>}
                  </TableCell>

                  {/* Contact */}
                  <TableCell>
                    <div className="text-xs text-slate-700 dark:text-slate-300">{c.phone || '-'}</div>
                    <div className="text-[11px] text-slate-400">{c.email || '-'}</div>
                  </TableCell>

                  {/* Branding Swatches */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full border border-slate-300 dark:border-dark-border shadow-xs"
                        style={{ backgroundColor: c.primaryColor }}
                        title={`Primary Color: ${c.primaryColor}`}
                      />
                      <div
                        className="w-5 h-5 rounded-full border border-slate-300 dark:border-dark-border shadow-xs"
                        style={{ backgroundColor: c.secondaryColor }}
                        title={`Secondary Color: ${c.secondaryColor}`}
                      />
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setStatusToggleCompany(c)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all ${
                        c.isActive
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 hover:ring-emerald-400'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 hover:ring-rose-400'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {c.isActive ? 'Active' : 'Deactivated'}
                    </button>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditModal(c)}
                        className="h-8 px-2.5 text-xs text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-cyan-400"
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStatusToggleCompany(c)}
                        className={`h-8 px-2 text-xs ${
                          c.isActive
                            ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5 mr-1" />
                        {c.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Mobile Card Layout (When on mobile and in table mode) */}
      <div className="grid grid-cols-1 gap-3.5 md:hidden">
        {paginatedCompanies.map((c) => (
          <div key={c.id} className="app-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs"
                  style={{ backgroundColor: c.primaryColor || '#1b365d' }}
                >
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{c.name}</h3>
                  <span className="font-mono text-xs text-slate-400">{c.code}</span>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  c.isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {c.isActive ? 'Active' : 'Deactivated'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-100 dark:border-dark-border py-2">
              <div>
                <span className="text-slate-400 block text-[11px]">GSTIN</span>
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                  {c.gstNumber || '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">PAN</span>
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                  {c.panNumber || '-'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-4 h-4 rounded-full border border-slate-300"
                  style={{ backgroundColor: c.primaryColor }}
                />
                <span
                  className="w-4 h-4 rounded-full border border-slate-300"
                  style={{ backgroundColor: c.secondaryColor }}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEditModal(c)}
                  className="h-8 text-xs"
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusToggleCompany(c)}
                  className={`h-8 text-xs ${c.isActive ? 'text-rose-600' : 'text-emerald-600'}`}
                >
                  <Power className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {sortedCompanies.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setCurrentPage(1);
          }}
          totalItems={sortedCompanies.length}
        />
      )}

      {/* Modal: Create Company */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register Legal Entity"
        description="Add a new operating company with tax IDs, headquarters location, and corporate brand colors."
        size="lg"
      >
        <form onSubmit={handleSaveCreateCompany} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Company Name"
              required
              placeholder="e.g. MV Holdings Private Limited"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={formErrors.name}
            />

            <Input
              label="Company Code"
              required
              placeholder="e.g. MV-CORP"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              error={formErrors.code}
              helperText="Unique uppercase identifier for billing and requisition routing."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="GST Number (GSTIN)"
              placeholder="e.g. 27AABCM9910E1Z4"
              value={formData.gstNumber}
              onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
              error={formErrors.gstNumber}
            />

            <Input
              label="Corporate PAN"
              placeholder="e.g. AABCM9910E"
              value={formData.panNumber}
              onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
              error={formErrors.panNumber}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Official Contact Phone"
              placeholder="+91 22 4589 1000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <Input
              label="Corporate Accounts Email"
              type="email"
              placeholder="accounts@mvholdings.in"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={formErrors.email}
            />
          </div>

          <Input
            label="Headquarters Street Address"
            placeholder="Tower B, Express Trade Towers"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="City"
              placeholder="Mumbai"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />

            <Input
              label="State"
              placeholder="Maharashtra"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            />

            <Input
              label="PIN Code"
              placeholder="400051"
              value={formData.pincode}
              onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
            />
          </div>

          {/* Brand Colors */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-navy-800 dark:text-cyan-400" />
              Corporate Identity & Brand Colors
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
                  Primary Theme Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="w-10 h-9 p-0.5 border border-slate-200 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
                  Secondary Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    className="w-10 h-9 p-0.5 border border-slate-200 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Primary Disbursement Bank Account */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-navy-800 dark:text-cyan-400" />
              Primary Disbursement Bank Account
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Bank Name"
                placeholder="e.g. HDFC Bank Limited"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              />
              <Input
                label="Account Number"
                placeholder="50200049281729"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              />
              <Input
                label="IFSC Code"
                placeholder="HDFC0000060"
                value={formData.ifscCode}
                onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
              />
              <Input
                label="Branch Location"
                placeholder="BKC Branch"
                value={formData.branchName}
                onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-dark-border">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950">
              Register Entity
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Company */}
      <Modal
        isOpen={!!editingCompany}
        onClose={() => setEditingCompany(null)}
        title={`Edit Company: ${editingCompany?.name}`}
        description="Update corporate registry details, contact information, and brand scheme."
        size="lg"
      >
        {editingCompany && (
          <form onSubmit={handleSaveEditCompany} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Company Name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formErrors.name}
              />

              <Input
                label="Company Code"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                error={formErrors.code}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="GST Number (GSTIN)"
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                error={formErrors.gstNumber}
              />

              <Input
                label="Corporate PAN"
                value={formData.panNumber}
                onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                error={formErrors.panNumber}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Contact Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />

              <Input
                label="Accounts Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={formErrors.email}
              />
            </div>

            <Input
              label="Headquarters Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="City"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />

              <Input
                label="State"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />

              <Input
                label="PIN Code"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
              />
            </div>

            {/* Colors */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-xl space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-navy-800 dark:text-cyan-400" />
                Brand Color Palette
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
                    Primary Theme Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-10 h-9 p-0.5 border border-slate-200 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
                    Secondary Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      className="w-10 h-9 p-0.5 border border-slate-200 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-dark-border">
              <Button type="button" variant="outline" onClick={() => setEditingCompany(null)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950">
                Save Entity Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirmation Dialog */}
      {statusToggleCompany && (
        <ConfirmDialog
          isOpen={!!statusToggleCompany}
          onClose={() => setStatusToggleCompany(null)}
          onConfirm={handleConfirmToggleStatus}
          actionType={statusToggleCompany.isActive ? 'warning' : 'approve'}
          title={statusToggleCompany.isActive ? 'Deactivate Company Entity' : 'Activate Company Entity'}
          message={
            statusToggleCompany.isActive
              ? `Are you sure you want to deactivate ${statusToggleCompany.name} (${statusToggleCompany.code})? Users assigned to this company will not be able to raise new requisitions until re-enabled.`
              : `Are you sure you want to activate ${statusToggleCompany.name} (${statusToggleCompany.code})? The company will be available across the system.`
          }
          confirmText={statusToggleCompany.isActive ? 'Deactivate Company' : 'Activate Company'}
        />
      )}
    </div>
  );
};

export default CompanyManagement;
