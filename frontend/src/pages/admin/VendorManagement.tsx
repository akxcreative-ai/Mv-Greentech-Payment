import React, { useState, useMemo } from 'react';
import { Vendor, ExpenseCategory, Company } from '@/types';
import {
  Store,
  Plus,
  Search,
  Filter,
  Edit2,
  Power,
  RotateCcw,
  Building2,
  Mail,
  Phone,
  Eye,
  EyeOff,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  Copy,
  X,
  CreditCard,
  AlertTriangle,
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

const mockCompanies: Company[] = [
  {
    id: 'comp_001',
    name: 'MV Holdings Private Limited',
    code: 'MV-CORP',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'comp_002',
    name: 'MV Infrastructure & Logistics Ltd',
    code: 'MV-INFRA',
    isActive: true,
    createdAt: '2025-03-15T00:00:00Z',
    updatedAt: '2026-11-10T00:00:00Z',
  },
  {
    id: 'comp_003',
    name: 'MV Digital Technologies Ltd',
    code: 'MV-TECH',
    isActive: true,
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2026-11-15T00:00:00Z',
  },
];

const initialVendors: Vendor[] = [
  {
    id: 'vnd_001',
    name: 'Tata Steel Processing Ltd',
    vendorCode: 'VND-TATA-001',
    companyId: 'comp_001',
    contactPerson: 'Suresh Singhania',
    panNumber: 'AAACT2021A',
    gstNumber: '27AAACT2021A1ZT',
    email: 'finance@tatasteel.com',
    phone: '+91 22 6665 8282',
    bankName: 'State Bank of India',
    accountNumber: '30918274910284',
    ifscCode: 'SBIN0001423',
    branchName: 'Nariman Point, Mumbai',
    address: 'Bombay House, 24 Homi Mody Street, Fort, Mumbai - 400001',
    category: ExpenseCategory.RAW_MATERIALS,
    isActive: true,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-11-20T00:00:00Z',
  },
  {
    id: 'vnd_002',
    name: 'Amazon Web Services India Pvt Ltd',
    vendorCode: 'VND-AWS-002',
    companyId: 'comp_001',
    contactPerson: 'Pooja Kashyap',
    panNumber: 'AABCA9921B',
    gstNumber: '29AABCA9921B1Z2',
    email: 'ar-india@amazon.com',
    phone: '+91 80 4123 4567',
    bankName: 'Citibank N.A.',
    accountNumber: '00392817491029',
    ifscCode: 'CITI0000003',
    branchName: 'MG Road, Bangalore',
    address: 'Brigade Gateway, 26/1 Dr Rajkumar Road, Malleshwaram, Bangalore - 560055',
    category: ExpenseCategory.IT_SOFTWARE,
    isActive: true,
    createdAt: '2026-02-10T00:00:00Z',
    updatedAt: '2026-11-10T00:00:00Z',
  },
  {
    id: 'vnd_003',
    name: 'DLF Cybercity Properties Pvt Ltd',
    vendorCode: 'VND-DLF-003',
    companyId: 'comp_002',
    contactPerson: 'Rohit Aggarwal',
    panNumber: 'AABCD8812K',
    gstNumber: '06AABCD8812K1ZQ',
    email: 'leases@dlf.in',
    phone: '+91 124 456 7890',
    bankName: 'HDFC Bank Limited',
    accountNumber: '50200091827461',
    ifscCode: 'HDFC0000043',
    branchName: 'Cyber City, Gurugram',
    address: 'Shopping Mall, 3rd Floor, Arjun Marg, DLF Phase I, Gurugram - 122002',
    category: ExpenseCategory.RENT,
    isActive: true,
    createdAt: '2026-01-05T00:00:00Z',
    updatedAt: '2026-11-05T00:00:00Z',
  },
  {
    id: 'vnd_004',
    name: 'MakeMyTrip Corporate Solutions',
    vendorCode: 'VND-MMT-004',
    companyId: 'comp_001',
    contactPerson: 'Alok Tandon',
    panNumber: 'AABCM6612H',
    gstNumber: '06AABCM6612H1ZK',
    email: 'corporate.billing@makemytrip.com',
    phone: '+91 124 462 8747',
    bankName: 'Axis Bank Limited',
    accountNumber: '91402001928374',
    ifscCode: 'UTIB0000131',
    branchName: 'Udyog Vihar, Gurugram',
    address: 'DLF Building No. 5, Tower A, Phase III, Gurugram - 122002',
    category: ExpenseCategory.TRAVEL_ENTERTAINMENT,
    isActive: true,
    createdAt: '2026-03-20T00:00:00Z',
    updatedAt: '2026-11-15T00:00:00Z',
  },
  {
    id: 'vnd_005',
    name: 'Blue Dart Express Limited',
    vendorCode: 'VND-BD-005',
    companyId: 'comp_002',
    contactPerson: 'Meenakshi Sen',
    panNumber: 'AAACB1209L',
    gstNumber: '27AAACB1209L1Z8',
    email: 'billing@bluedart.com',
    phone: '+91 22 2839 6444',
    bankName: 'Standard Chartered Bank',
    accountNumber: '22405019283019',
    ifscCode: 'SCBL0036001',
    branchName: 'Andheri East, Mumbai',
    address: 'Blue Dart Centre, Sahar Airport Road, Andheri East, Mumbai - 400099',
    category: ExpenseCategory.LOGISTICS,
    isActive: true,
    createdAt: '2026-04-12T00:00:00Z',
    updatedAt: '2026-11-12T00:00:00Z',
  },
  {
    id: 'vnd_006',
    name: 'Urban Clap Facility Services Ltd',
    vendorCode: 'VND-UC-006',
    companyId: 'comp_001',
    contactPerson: 'Nitin Rawat',
    panNumber: 'AABCU3312M',
    gstNumber: '07AABCU3312M1Z5',
    email: 'b2b-support@urbancompany.com',
    phone: '+91 11 4118 3920',
    bankName: 'Kotak Mahindra Bank',
    accountNumber: '49201928374619',
    ifscCode: 'KKBK0000192',
    branchName: 'Connaught Place, New Delhi',
    address: 'Barakhamba Road, Connaught Place, New Delhi - 110001',
    category: ExpenseCategory.MAINTENANCE,
    isActive: false,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-10-25T00:00:00Z',
  },
];

export const VendorManagement: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Sorting
  const [sortField, setSortField] = useState<keyof Vendor>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Bank detail unmask state: Map of vendorId -> boolean
  const [unmaskedAccounts, setUnmaskedAccounts] = useState<Record<string, boolean>>({});

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [statusToggleVendor, setStatusToggleVendor] = useState<Vendor | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    vendorCode: '',
    companyId: mockCompanies[0]?.id || '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    gstNumber: '',
    panNumber: '',
    category: ExpenseCategory.RAW_MATERIALS as string,
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Lookups
  const getCompanyName = (companyId?: string) => {
    return mockCompanies.find((c) => c.id === companyId)?.name || 'Group Wide';
  };

  const getCompanyCode = (companyId?: string) => {
    return mockCompanies.find((c) => c.id === companyId)?.code || 'ALL';
  };

  // Mask bank account number
  const formatAccountNumber = (accNumber: string, vendorId: string) => {
    if (unmaskedAccounts[vendorId]) {
      return accNumber;
    }
    if (!accNumber || accNumber.length < 4) return '••••';
    const lastFour = accNumber.slice(-4);
    return `••••••••${lastFour}`;
  };

  const toggleAccountVisibility = (vendorId: string) => {
    setUnmaskedAccounts((prev) => {
      const isVisible = !prev[vendorId];
      if (isVisible) {
        toast('Bank account revealed (Access recorded for security audit)', {
          icon: '🛡️',
        });
      }
      return { ...prev, [vendorId]: isVisible };
    });
  };

  // Filter & Search
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const term = search.toLowerCase().trim();
      const compName = getCompanyName(v.companyId).toLowerCase();

      const matchesSearch =
        !term ||
        v.name.toLowerCase().includes(term) ||
        v.vendorCode.toLowerCase().includes(term) ||
        (v.contactPerson && v.contactPerson.toLowerCase().includes(term)) ||
        (v.email && v.email.toLowerCase().includes(term)) ||
        (v.gstNumber && v.gstNumber.toLowerCase().includes(term)) ||
        (v.panNumber && v.panNumber.toLowerCase().includes(term)) ||
        compName.includes(term);

      const matchesCategory = categoryFilter === 'ALL' || v.category === categoryFilter;
      const matchesCompany = companyFilter === 'ALL' || v.companyId === companyFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && v.isActive) ||
        (statusFilter === 'INACTIVE' && !v.isActive);

      return matchesSearch && matchesCategory && matchesCompany && matchesStatus;
    });
  }, [vendors, search, categoryFilter, companyFilter, statusFilter]);

  // Sort
  const sortedVendors = useMemo(() => {
    return [...filteredVendors].sort((a, b) => {
      const aVal = (a[sortField] as string | undefined) || '';
      const bVal = (b[sortField] as string | undefined) || '';

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [filteredVendors, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedVendors.length / pageSize) || 1;
  const paginatedVendors = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedVendors.slice(start, start + pageSize);
  }, [sortedVendors, currentPage, pageSize]);

  const handleSort = (field: keyof Vendor) => {
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
    if (!formData.name.trim()) errors.name = 'Vendor Name is required';
    if (!formData.vendorCode.trim()) {
      errors.vendorCode = 'Vendor Code is required';
    } else if (!/^[A-Z0-9_-]{2,16}$/i.test(formData.vendorCode.trim())) {
      errors.vendorCode = 'Code must be 2-16 alphanumeric characters (e.g. VND-001)';
    }

    const existing = vendors.find(
      (v) =>
        v.vendorCode.toLowerCase() === formData.vendorCode.trim().toLowerCase() &&
        (!isEdit || v.id !== editingVendor?.id)
    );
    if (existing) {
      errors.vendorCode = 'Vendor Code already exists in the registry';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Invalid vendor email format';
    }

    if (formData.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(formData.gstNumber.trim())) {
      errors.gstNumber = 'Invalid 15-character GSTIN format';
    }

    if (formData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(formData.panNumber.trim())) {
      errors.panNumber = 'Invalid 10-character PAN format';
    }

    if (!formData.bankName.trim()) errors.bankName = 'Bank Name is required for disbursement';
    if (!formData.accountNumber.trim()) errors.accountNumber = 'Account Number is required';
    if (!formData.ifscCode.trim()) {
      errors.ifscCode = 'IFSC Code is required';
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(formData.ifscCode.trim())) {
      errors.ifscCode = 'Invalid IFSC Code format (e.g. HDFC0000060)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormData({
      name: '',
      vendorCode: `VND-${Date.now().toString().slice(-4)}`,
      companyId: mockCompanies[0]?.id || '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      gstNumber: '',
      panNumber: '',
      category: ExpenseCategory.RAW_MATERIALS,
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
  const handleOpenEdit = (v: Vendor) => {
    setEditingVendor(v);
    setFormData({
      name: v.name,
      vendorCode: v.vendorCode,
      companyId: v.companyId || mockCompanies[0]?.id || '',
      contactPerson: v.contactPerson || '',
      email: v.email || '',
      phone: v.phone || '',
      address: v.address || '',
      gstNumber: v.gstNumber || '',
      panNumber: v.panNumber || '',
      category: v.category || ExpenseCategory.OTHER,
      bankName: v.bankName,
      accountNumber: v.accountNumber,
      ifscCode: v.ifscCode,
      branchName: v.branchName || '',
      isActive: v.isActive,
    });
    setFormErrors({});
  };

  // Save Create
  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    const newVendor: Vendor = {
      id: `vnd_${Date.now()}`,
      name: formData.name.trim(),
      vendorCode: formData.vendorCode.trim().toUpperCase(),
      companyId: formData.companyId,
      contactPerson: formData.contactPerson.trim() || undefined,
      email: formData.email.trim().toLowerCase() || undefined,
      phone: formData.phone.trim() || undefined,
      address: formData.address.trim() || undefined,
      gstNumber: formData.gstNumber.trim().toUpperCase() || undefined,
      panNumber: formData.panNumber.trim().toUpperCase() || undefined,
      category: formData.category,
      bankName: formData.bankName.trim(),
      accountNumber: formData.accountNumber.trim(),
      ifscCode: formData.ifscCode.trim().toUpperCase(),
      branchName: formData.branchName.trim() || undefined,
      isActive: formData.isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setVendors((prev) => [newVendor, ...prev]);
    setIsCreateModalOpen(false);
    toast.success(`Vendor ${newVendor.name} added to supplier directory.`);
  };

  // Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor) return;
    if (!validateForm(true)) return;

    setVendors((prev) =>
      prev.map((v) => {
        if (v.id === editingVendor.id) {
          return {
            ...v,
            name: formData.name.trim(),
            vendorCode: formData.vendorCode.trim().toUpperCase(),
            companyId: formData.companyId,
            contactPerson: formData.contactPerson.trim() || undefined,
            email: formData.email.trim().toLowerCase() || undefined,
            phone: formData.phone.trim() || undefined,
            address: formData.address.trim() || undefined,
            gstNumber: formData.gstNumber.trim().toUpperCase() || undefined,
            panNumber: formData.panNumber.trim().toUpperCase() || undefined,
            category: formData.category,
            bankName: formData.bankName.trim(),
            accountNumber: formData.accountNumber.trim(),
            ifscCode: formData.ifscCode.trim().toUpperCase(),
            branchName: formData.branchName.trim() || undefined,
            isActive: formData.isActive,
            updatedAt: new Date().toISOString(),
          };
        }
        return v;
      })
    );

    setEditingVendor(null);
    toast.success(`Vendor ${formData.name} updated successfully.`);
  };

  // Toggle status
  const handleConfirmToggleStatus = () => {
    if (!statusToggleVendor) return;

    const nextStatus = !statusToggleVendor.isActive;
    setVendors((prev) =>
      prev.map((v) =>
        v.id === statusToggleVendor.id ? { ...v, isActive: nextStatus, updatedAt: new Date().toISOString() } : v
      )
    );

    toast.success(`Vendor ${statusToggleVendor.name} is now ${nextStatus ? 'Active' : 'Deactivated'}.`);
    setStatusToggleVendor(null);
  };

  // Export vendors to CSV
  const handleExportCSV = () => {
    const headers = [
      'Vendor Code',
      'Vendor Name',
      'Category',
      'Contact Person',
      'Email',
      'Phone',
      'GSTIN',
      'PAN',
      'Bank Name',
      'Account Number',
      'IFSC Code',
      'Status',
    ];
    const rows = filteredVendors.map((v) => [
      `"${v.vendorCode}"`,
      `"${v.name}"`,
      `"${v.category || ''}"`,
      `"${v.contactPerson || ''}"`,
      `"${v.email || ''}"`,
      `"${v.phone || ''}"`,
      `"${v.gstNumber || ''}"`,
      `"${v.panNumber || ''}"`,
      `"${v.bankName}"`,
      `"${v.accountNumber}"`,
      `"${v.ifscCode}"`,
      `"${v.isActive ? 'Active' : 'Inactive'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vendors-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Vendors exported to CSV successfully.');
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
              <Store className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Vendor & Supplier Registry
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified supplier profiles, bank settlement accounts, GST compliance, and disbursement routing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            className="text-xs"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Import
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleExportCSV}
            className="text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>

          <Button
            type="button"
            onClick={handleOpenCreate}
            className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950 dark:hover:bg-cyan-400 shadow-sm text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Vendor
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="app-card p-4 border-l-4 border-l-navy-800 dark:border-l-cyan-500">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Suppliers</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{vendors.length}</p>
        </div>

        <div className="app-card p-4 border-l-4 border-l-emerald-500">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Beneficiaries</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            {vendors.filter((v) => v.isActive).length}
          </p>
        </div>

        <div className="app-card p-4 border-l-4 border-l-sky-500">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">GST Compliant</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            {vendors.filter((v) => v.gstNumber).length}
          </p>
        </div>

        <div className="app-card p-4 border-l-4 border-l-purple-500">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Expense Categories</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            {new Set(vendors.map((v) => v.category)).size}
          </p>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="app-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search vendor name, code, contact, GSTIN..."
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
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-xs focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500 outline-hidden text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Categories</option>
              {Object.values(ExpenseCategory).map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
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
              {mockCompanies.map((c) => (
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

        {(search || categoryFilter !== 'ALL' || companyFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-dark-border text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-navy-800 dark:text-cyan-400" />
              Filtered: {sortedVendors.length} of {vendors.length} vendors
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategoryFilter('ALL');
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
        <Table isEmpty={sortedVendors.length === 0} emptyText="No vendors found matching your search.">
          <TableHead>
            <tr>
              <TableHeaderCell sortable sortDirection={sortField === 'name' ? sortDirection : null} onSort={() => handleSort('name')}>
                Vendor / Code
              </TableHeaderCell>
              <TableHeaderCell sortable sortDirection={sortField === 'category' ? sortDirection : null} onSort={() => handleSort('category')}>
                Category / Company
              </TableHeaderCell>
              <TableHeaderCell sortable sortDirection={sortField === 'contactPerson' ? sortDirection : null} onSort={() => handleSort('contactPerson')}>
                Contact Person
              </TableHeaderCell>
              <TableHeaderCell>GST / PAN</TableHeaderCell>
              <TableHeaderCell>Settlement Bank Account</TableHeaderCell>
              <TableHeaderCell sortable sortDirection={sortField === 'isActive' ? sortDirection : null} onSort={() => handleSort('isActive')}>
                Status
              </TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {paginatedVendors.map((v) => {
              const isMasked = !unmaskedAccounts[v.id];

              return (
                <TableRow key={v.id}>
                  {/* Name and code */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-navy-50 dark:bg-navy-950/60 text-navy-800 dark:text-cyan-400 flex items-center justify-center font-bold shrink-0">
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {v.name}
                        </div>
                        <div className="text-xs font-mono font-medium text-slate-400">{v.vendorCode}</div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Category and Company */}
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant="default" size="sm">
                        {v.category ? v.category.replace(/_/g, ' ') : 'General'}
                      </Badge>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {getCompanyName(v.companyId)}
                      </div>
                    </div>
                  </TableCell>

                  {/* Contact */}
                  <TableCell>
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      {v.contactPerson || '-'}
                    </div>
                    {v.email && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" />
                        {v.email}
                      </div>
                    )}
                    {v.phone && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {v.phone}
                      </div>
                    )}
                  </TableCell>

                  {/* GSTIN / PAN */}
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 font-mono text-xs text-slate-800 dark:text-slate-200">
                        <span className="text-[10px] text-slate-400 font-sans font-bold">GST:</span>
                        {v.gstNumber || '-'}
                        {v.gstNumber && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(v.gstNumber!, 'GSTIN')}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            title="Copy GSTIN"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1 font-mono text-xs text-slate-600 dark:text-slate-400">
                        <span className="text-[10px] text-slate-400 font-sans font-bold">PAN:</span>
                        {v.panNumber || '-'}
                      </div>
                    </div>
                  </TableCell>

                  {/* Bank Details (Restricted Display) */}
                  <TableCell>
                    <div className="space-y-1 min-w-[210px] p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-dark-border text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] flex items-center justify-between">
                        <span>{v.bankName}</span>
                        <span className="font-mono text-[10px] text-slate-400">{v.ifscCode}</span>
                      </div>
                      <div className="flex items-center justify-between font-mono text-xs text-slate-900 dark:text-white">
                        <span>{formatAccountNumber(v.accountNumber, v.id)}</span>
                        <button
                          type="button"
                          onClick={() => toggleAccountVisibility(v.id)}
                          className="p-1 text-slate-400 hover:text-navy-900 dark:hover:text-cyan-400 rounded"
                          title={isMasked ? 'Reveal Account Number (Audited)' : 'Mask Account Number'}
                        >
                          {isMasked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-cyan-500" />}
                        </button>
                      </div>
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setStatusToggleVendor(v)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all ${
                        v.isActive
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 hover:ring-emerald-400'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 hover:ring-rose-400'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${v.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {v.isActive ? 'Active' : 'Deactivated'}
                    </button>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(v)}
                        className="h-8 px-2.5 text-xs text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-cyan-400"
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStatusToggleVendor(v)}
                        className={`h-8 px-2 text-xs ${
                          v.isActive
                            ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5 mr-1" />
                        {v.isActive ? 'Deactivate' : 'Activate'}
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
        {paginatedVendors.map((v) => {
          const isMasked = !unmaskedAccounts[v.id];

          return (
            <div key={v.id} className="app-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-navy-50 dark:bg-navy-950/60 text-navy-800 dark:text-cyan-400 flex items-center justify-center font-bold shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{v.name}</h3>
                    <span className="font-mono text-xs text-slate-400">{v.vendorCode}</span>
                  </div>
                </div>

                <Badge variant="default" size="sm">
                  {v.category ? v.category.replace(/_/g, ' ') : 'General'}
                </Badge>
              </div>

              {/* Bank Details section */}
              <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-dark-border text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span>{v.bankName}</span>
                  <span className="font-mono">{v.ifscCode}</span>
                </div>
                <div className="flex items-center justify-between font-mono font-semibold text-slate-900 dark:text-white">
                  <span>{formatAccountNumber(v.accountNumber, v.id)}</span>
                  <button
                    type="button"
                    onClick={() => toggleAccountVisibility(v.id)}
                    className="p-1 text-slate-400"
                  >
                    {isMasked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-cyan-500" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    v.isActive
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${v.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {v.isActive ? 'Active' : 'Deactivated'}
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(v)}
                    className="h-8 text-xs"
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStatusToggleVendor(v)}
                    className={`h-8 text-xs ${v.isActive ? 'text-rose-600' : 'text-emerald-600'}`}
                  >
                    <Power className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {sortedVendors.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setCurrentPage(1);
          }}
          totalItems={sortedVendors.length}
        />
      )}

      {/* Modal: Create Vendor */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register Verified Vendor"
        description="Add a new supplier to the procurement and disbursements master registry."
        size="lg"
      >
        <form onSubmit={handleSaveCreate} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Legal Vendor Name"
              required
              placeholder="e.g. Tata Steel Processing Ltd"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={formErrors.name}
            />

            <Input
              label="Vendor Code"
              required
              placeholder="e.g. VND-TATA-001"
              value={formData.vendorCode}
              onChange={(e) => setFormData({ ...formData, vendorCode: e.target.value.toUpperCase() })}
              error={formErrors.vendorCode}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                Expense Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
              >
                {Object.values(ExpenseCategory).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                Associated Operating Company
              </label>
              <select
                value={formData.companyId}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
              >
                {mockCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Contact Person"
              placeholder="e.g. Suresh Singhania"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="finance@tatasteel.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={formErrors.email}
            />

            <Input
              label="Phone Number"
              placeholder="+91 22 6665 8282"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="GST Number (GSTIN)"
              placeholder="e.g. 27AAACT2021A1ZT"
              value={formData.gstNumber}
              onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
              error={formErrors.gstNumber}
            />

            <Input
              label="Permanent Account Number (PAN)"
              placeholder="e.g. AAACT2021A"
              value={formData.panNumber}
              onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
              error={formErrors.panNumber}
            />
          </div>

          <Input
            label="Registered Business Address"
            placeholder="Tower B, Express Trade Towers, Mumbai"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          {/* Bank Details Section */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-navy-800 dark:text-cyan-400" />
                Settlement & Payment Bank Details
              </span>
              <span className="text-[11px] text-slate-400">Restricted Data</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Bank Name"
                required
                placeholder="e.g. State Bank of India"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                error={formErrors.bankName}
              />

              <Input
                label="Bank Account Number"
                required
                placeholder="e.g. 30918274910284"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                error={formErrors.accountNumber}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="IFSC Code"
                required
                placeholder="e.g. SBIN0001423"
                value={formData.ifscCode}
                onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                error={formErrors.ifscCode}
              />

              <Input
                label="Branch Name / City"
                placeholder="e.g. Nariman Point, Mumbai"
                value={formData.branchName}
                onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="vendor-create-active"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-navy-800 dark:text-cyan-500 rounded border-slate-300"
            />
            <label htmlFor="vendor-create-active" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Vendor is active for payment requisitions
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-dark-border">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950">
              Register Vendor
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Vendor */}
      <Modal
        isOpen={!!editingVendor}
        onClose={() => setEditingVendor(null)}
        title={`Edit Vendor: ${editingVendor?.name}`}
        description="Update vendor contact details, tax compliance registration, and settlement bank accounts."
        size="lg"
      >
        {editingVendor && (
          <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Legal Vendor Name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formErrors.name}
              />

              <Input
                label="Vendor Code"
                required
                value={formData.vendorCode}
                onChange={(e) => setFormData({ ...formData, vendorCode: e.target.value.toUpperCase() })}
                error={formErrors.vendorCode}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                  Expense Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
                >
                  {Object.values(ExpenseCategory).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                  Associated Operating Company
                </label>
                <select
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
                >
                  {mockCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Contact Person"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              />

              <Input
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={formErrors.email}
              />

              <Input
                label="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                label="Permanent Account Number (PAN)"
                value={formData.panNumber}
                onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                error={formErrors.panNumber}
              />
            </div>

            <Input
              label="Registered Business Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />

            {/* Bank details */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-xl space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-navy-800 dark:text-cyan-400" />
                Settlement & Payment Bank Details
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Bank Name"
                  required
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  error={formErrors.bankName}
                />

                <Input
                  label="Bank Account Number"
                  required
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  error={formErrors.accountNumber}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="IFSC Code"
                  required
                  value={formData.ifscCode}
                  onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                  error={formErrors.ifscCode}
                />

                <Input
                  label="Branch Name / City"
                  value={formData.branchName}
                  onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="vendor-edit-active"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-navy-800 dark:text-cyan-500 rounded border-slate-300"
              />
              <label htmlFor="vendor-edit-active" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Vendor is active for payment requisitions
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-dark-border">
              <Button type="button" variant="outline" onClick={() => setEditingVendor(null)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950">
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Import Vendors Placeholder */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Batch Import Vendors"
        description="Upload CSV or Excel spreadsheets to batch populate the vendor directory."
        size="md"
      >
        <div className="space-y-4 pt-2">
          <div className="p-4 border-2 border-dashed border-slate-300 dark:border-dark-border rounded-xl text-center space-y-2 bg-slate-50 dark:bg-slate-900/50">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-navy-800 dark:text-cyan-400 opacity-60" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Drag and drop your vendor spreadsheet here
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Supports .CSV, .XLSX, and .XLS up to 10MB</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toast.success('File selector opened')}
            >
              Browse Local Files
            </Button>
          </div>

          <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-lg text-xs text-sky-800 dark:text-sky-300 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Import Guidelines</p>
              <p className="mt-0.5 text-sky-700 dark:text-sky-400">
                Columns must include VendorName, VendorCode, BankName, AccountNumber, and IFSC. Missing GSTINs will default to unregistered entities.
              </p>
              <button
                type="button"
                onClick={() => toast.success('Standard vendor CSV template downloaded')}
                className="mt-1.5 font-bold text-sky-900 dark:text-sky-200 underline inline-flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Download CSV Template
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-dark-border">
            <Button type="button" variant="outline" onClick={() => setIsImportModalOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950"
              onClick={() => {
                toast.success('Batch import scheduled successfully.');
                setIsImportModalOpen(false);
              }}
            >
              Proceed With Upload
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog */}
      {statusToggleVendor && (
        <ConfirmDialog
          isOpen={!!statusToggleVendor}
          onClose={() => setStatusToggleVendor(null)}
          onConfirm={handleConfirmToggleStatus}
          actionType={statusToggleVendor.isActive ? 'warning' : 'approve'}
          title={statusToggleVendor.isActive ? 'Deactivate Vendor' : 'Activate Vendor'}
          message={
            statusToggleVendor.isActive
              ? `Are you sure you want to deactivate ${statusToggleVendor.name} (${statusToggleVendor.vendorCode})? Requesters will not be able to select this vendor for new payment requisitions.`
              : `Are you sure you want to activate ${statusToggleVendor.name} (${statusToggleVendor.vendorCode})? The vendor will be available across requisition forms.`
          }
          confirmText={statusToggleVendor.isActive ? 'Deactivate Vendor' : 'Activate Vendor'}
        />
      )}
    </div>
  );
};

export default VendorManagement;
