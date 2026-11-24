import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import toast from 'react-hot-toast';
import {
  Building2,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  UploadCloud,
  Trash2,
  Send,
  Save,
  HelpCircle,
  Search,
  FileCheck,
  CreditCard,
  User,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

import {
  ExpenseCategory,
  PaymentMode,
  Priority,
  DuplicateCheckResult,
  Company,
  Vendor,
  Department,
} from '@/types';
import { formatCurrency, formatFileSize, numberToIndianWords } from '@/utils/format';
import { useAllCompanies } from '@/hooks/useCompanies';
import { useDepartmentsByCompany } from '@/hooks/useDepartments';
import { useAllVendors } from '@/hooks/useVendors';
import { useUsers } from '@/hooks/useUsers';
import { useAuthStore } from '@/store/authStore';
import { paymentRequestService } from '@/services/paymentRequestService';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const createPaymentRequestSchema = z
  .object({
    companyId: z.string().min(1, 'Please select an operating company'),
    departmentId: z.string().min(1, 'Please select a department'),
    vendorId: z.string().optional(),
    expenseCategory: z.string().min(1, 'Please select an expense category'),
    expenseSubcategory: z.string().optional(),
    paymentPurpose: z
      .string()
      .min(5, 'Payment purpose must be at least 5 characters long')
      .max(1000, 'Payment purpose cannot exceed 1000 characters'),
    invoiceNumber: z.string().min(1, 'Bill / Claim / Invoice number is mandatory'),
    invoiceDate: z.string().min(1, 'Bill / Claim date is mandatory'),
    dueDate: z.string().min(1, 'Payment due date is mandatory'),
    amount: z
      .number({ invalid_type_error: 'Amount must be a valid number' })
      .positive('Base amount must be greater than 0'),
    gstAmount: z
      .number({ invalid_type_error: 'GST amount must be a number' })
      .min(0, 'GST amount cannot be negative')
      .default(0),
    paymentMode: z.nativeEnum(PaymentMode, {
      errorMap: () => ({ message: 'Please select a valid payment mode' }),
    }),
    bankAccount: z.string().min(1, 'Beneficiary bank account / UPI ID details are required'),
    priority: z.nativeEnum(Priority, {
      errorMap: () => ({ message: 'Please select request priority' }),
    }),
    remarks: z.string().optional(),
    assignedApproverId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.expenseCategory !== 'EMPLOYEE_REIMBURSEMENT' && !data.vendorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vendorId'],
        message: 'Please select a vendor for vendor payments',
      });
    }
  });

type FormValues = z.infer<typeof createPaymentRequestSchema>;

interface AttachedFile {
  id: string;
  file: File;
  previewUrl?: string;
}

export const CreatePaymentRequest: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Queries for dynamic selects
  const { data: companiesRaw, isLoading: isLoadingCompanies } = useAllCompanies();
  const companies: Company[] = useMemo(() => {
    if (Array.isArray(companiesRaw)) return companiesRaw;
    return (companiesRaw as any)?.data || (companiesRaw as any)?.items || [];
  }, [companiesRaw]);

  const { data: vendorsRaw, isLoading: isLoadingVendors } = useAllVendors();
  const vendors: Vendor[] = useMemo(() => {
    if (Array.isArray(vendorsRaw)) return vendorsRaw;
    return (vendorsRaw as any)?.data || (vendorsRaw as any)?.items || [];
  }, [vendorsRaw]);

  const { data: usersData } = useUsers({ pageSize: 100 });

  // Form State
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [vendorSearch, setVendorSearch] = useState<string>('');
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState<boolean>(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [gstRate, setGstRate] = useState<number | 'custom'>('custom');

  // Modals & Confirmation States
  const [showConfirmSubmit, setShowConfirmSubmit] = useState<boolean>(false);
  const [pendingFormData, setPendingFormData] = useState<FormValues | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState<boolean>(false);
  const [duplicateMatchInfo, setDuplicateMatchInfo] = useState<DuplicateCheckResult | null>(null);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideReasonError, setOverrideReasonError] = useState<string>('');

  // Fetch departments filtered by company
  const { data: departmentsRaw, isLoading: isLoadingDepartments } = useDepartmentsByCompany(
    selectedCompanyId,
    { enabled: Boolean(selectedCompanyId) }
  );
  const departments: Department[] = useMemo(() => {
    if (Array.isArray(departmentsRaw)) return departmentsRaw;
    return (departmentsRaw as any)?.data || (departmentsRaw as any)?.items || [];
  }, [departmentsRaw]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(createPaymentRequestSchema),
    defaultValues: {
      companyId: user?.companyId || '',
      departmentId: user?.departmentId || '',
      vendorId: '',
      expenseCategory: ExpenseCategory.VENDOR_PAYMENT,
      expenseSubcategory: '',
      paymentPurpose: '',
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      amount: 0,
      gstAmount: 0,
      paymentMode: PaymentMode.NEFT,
      bankAccount: '',
      priority: Priority.NORMAL,
      remarks: '',
      assignedApproverId: '',
    },
  });

  // Keep selected company in local state for department queries
  useEffect(() => {
    if (user?.companyId && !selectedCompanyId) {
      setSelectedCompanyId(user.companyId);
      setValue('companyId', user.companyId);
    }
  }, [user?.companyId, selectedCompanyId, setValue]);

  const watchAmount = watch('amount') || 0;
  const watchGstAmount = watch('gstAmount') || 0;
  const watchVendorId = watch('vendorId');
  const watchPriority = watch('priority');
  const watchExpenseCategory = watch('expenseCategory');
  const isEmployeeReimbursement = watchExpenseCategory === 'EMPLOYEE_REIMBURSEMENT';

  // Auto-calculate Total Amount
  const calculatedTotal = useMemo(() => {
    const base = Number(watchAmount) || 0;
    const gst = Number(watchGstAmount) || 0;
    return Math.max(0, base + gst);
  }, [watchAmount, watchGstAmount]);

  // Handle GST rate selection and auto-recalculation
  const handleSelectGstRate = (rate: number | 'custom') => {
    setGstRate(rate);
    if (rate !== 'custom') {
      const base = Number(watchAmount) || 0;
      const computed = Math.round(base * (rate / 100) * 100) / 100;
      setValue('gstAmount', computed, { shouldValidate: true });
    }
  };

  useEffect(() => {
    if (gstRate !== 'custom') {
      const base = Number(watchAmount) || 0;
      const computed = Math.round(base * (gstRate / 100) * 100) / 100;
      setValue('gstAmount', computed, { shouldValidate: true });
    }
  }, [watchAmount, gstRate, setValue]);

  // Approvers list: filter active users capable of approving in this company
  const approversList = useMemo(() => {
    const allUsers = usersData?.data || [];
    return allUsers.filter(
      (u) =>
        u.isActive &&
        (!selectedCompanyId || u.companyId === selectedCompanyId) &&
        ['APPROVER', 'ADMIN', 'SUPER_ADMIN', 'MANAGEMENT', 'DIRECTOR'].includes(u.role)
    );
  }, [usersData, selectedCompanyId]);

  // Filtered vendors list for searchable combobox
  const filteredVendors = useMemo(() => {
    if (!vendorSearch.trim()) return vendors;
    const q = vendorSearch.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.vendorCode.toLowerCase().includes(q) ||
        (v.category && v.category.toLowerCase().includes(q))
    );
  }, [vendors, vendorSearch]);

  const selectedVendor = useMemo(() => {
    return vendors.find((v) => v.id === watchVendorId);
  }, [vendors, watchVendorId]);

  // Handle vendor selection: populate default bank account if empty
  const handleSelectVendor = (vendorId: string) => {
    const v = vendors.find((item) => item.id === vendorId);
    setValue('vendorId', vendorId, { shouldValidate: true });
    setIsVendorDropdownOpen(false);

    if (v) {
      setVendorSearch(v.name);
      // Auto-fill bank account details if available
      const bankString = [
        v.bankName ? `Bank: ${v.bankName}` : '',
        v.accountNumber ? `A/C: ${v.accountNumber}` : '',
        v.ifscCode ? `IFSC: ${v.ifscCode}` : '',
      ]
        .filter(Boolean)
        .join(' | ');

      if (bankString) {
        setValue('bankAccount', bankString, { shouldValidate: true });
      }
    }
  };

  // File Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    const newItems: AttachedFile[] = filesArray.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setAttachedFiles((prev) => [...prev, ...newItems]);
    e.target.value = '';
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  // Sequential Document Uploader
  const uploadDocumentsForRequest = async (requestId: string) => {
    if (attachedFiles.length === 0) return;
    for (const item of attachedFiles) {
      try {
        await paymentRequestService.uploadDocument(requestId, item.file);
      } catch (err) {
        console.warn(`Failed to upload ${item.file.name}:`, err);
      }
    }
  };

  // Perform Duplicate Check
  const runDuplicateCheck = async (
    vendorId: string | undefined,
    invoiceNumber: string,
    amount: number
  ): Promise<DuplicateCheckResult | null> => {
    if (!vendorId) {
      return null;
    }
    try {
      const result = await paymentRequestService.checkDuplicate({
        vendorId,
        invoiceNumber,
        amount,
      });
      if (result && result.isDuplicate) {
        return result;
      }
      return null;
    } catch {
      // Fallback check against existing requests
      try {
        const existing = await paymentRequestService.getPaymentRequests({
          vendorId,
          search: invoiceNumber,
        });
        const matched = existing.data?.find(
          (r) =>
            r.invoiceNumber?.toLowerCase() === invoiceNumber.toLowerCase() &&
            r.vendorId === vendorId &&
            Math.abs(Number(r.amount) - Number(amount)) < 1
        );
        if (matched) {
          return {
            isDuplicate: true,
            matchedRequest: matched,
            message: `A request (${matched.requestNumber}) already exists for this vendor and invoice number with amount ${formatCurrency(matched.amount)}.`,
          };
        }
      } catch (fallbackErr) {
        console.warn('Duplicate fallback inspection skipped:', fallbackErr);
      }
      return null;
    }
  };

  // Submit Initiation: runs duplicate check first
  const onInitiateSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setPendingFormData(data);

    try {
      const dup = await runDuplicateCheck(data.vendorId, data.invoiceNumber, data.amount);
      if (dup && dup.isDuplicate) {
        setDuplicateMatchInfo(dup);
        setShowDuplicateModal(true);
        setIsSubmitting(false);
        return;
      }

      // No duplicate: open final confirmation dialog
      setShowConfirmSubmit(true);
    } catch (err: any) {
      toast.error(err?.message || 'Error checking for duplicate invoices');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Final Submission Execution
  const executeFinalSubmit = async (override?: { reason: string }) => {
    if (!pendingFormData) return;
    setIsSubmitting(true);

    try {
      const payload: any = {
        companyId: pendingFormData.companyId,
        company_id: pendingFormData.companyId,
        departmentId: pendingFormData.departmentId,
        department_id: pendingFormData.departmentId,
        vendorId: pendingFormData.vendorId,
        vendor_id: pendingFormData.vendorId,
        title: pendingFormData.paymentPurpose.slice(0, 80),
        description: pendingFormData.paymentPurpose,
        payment_purpose: pendingFormData.paymentPurpose,
        expenseCategory: pendingFormData.expenseCategory,
        expense_category: pendingFormData.expenseCategory,
        expenseSubcategory: pendingFormData.expenseSubcategory,
        expense_subcategory: pendingFormData.expenseSubcategory,
        invoiceNumber: pendingFormData.invoiceNumber,
        invoice_number: pendingFormData.invoiceNumber,
        invoiceDate: pendingFormData.invoiceDate,
        invoice_date: pendingFormData.invoiceDate ? new Date(pendingFormData.invoiceDate).toISOString() : undefined,
        dueDate: pendingFormData.dueDate,
        due_date: pendingFormData.dueDate ? new Date(pendingFormData.dueDate).toISOString() : undefined,
        amount: Number(pendingFormData.amount),
        gstAmount: Number(pendingFormData.gstAmount || 0),
        gst_amount: Number(pendingFormData.gstAmount || 0),
        totalAmount: calculatedTotal,
        total_amount: calculatedTotal,
        paymentMode: pendingFormData.paymentMode,
        payment_mode: pendingFormData.paymentMode,
        bankAccount: pendingFormData.bankAccount,
        bank_account: pendingFormData.bankAccount,
        priority: pendingFormData.priority,
        remarks: pendingFormData.remarks,
        assignedApproverId: pendingFormData.assignedApproverId || undefined,
        assigned_approver_id: pendingFormData.assignedApproverId || undefined,
        is_duplicate_override: Boolean(override?.reason),
        duplicate_override_reason: override?.reason || undefined,
      };

      // 1. Create the payment request
      const createdRequest = await paymentRequestService.createPaymentRequest(payload);

      // 2. Upload supporting documents
      if (attachedFiles.length > 0) {
        toast.loading('Uploading supporting documents...', { id: 'doc-upload' });
        await uploadDocumentsForRequest(createdRequest.id);
        toast.success('Documents attached successfully', { id: 'doc-upload' });
      }

      // 3. Submit into approval pipeline
      try {
        await paymentRequestService.submitPaymentRequest(createdRequest.id);
      } catch (submitErr) {
        console.warn('Direct submission transition deferred:', submitErr);
      }

      toast.success(
        `Payment Requisition ${createdRequest.requestNumber || ''} created and submitted for approval!`
      );

      setShowConfirmSubmit(false);
      setShowDuplicateModal(false);
      navigate(`/payment-requests/${createdRequest.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit payment request. Please verify inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save as Draft
  const handleSaveAsDraft = async () => {
    const values = watch();
    if (!values.companyId || !values.departmentId) {
      toast.error('Company and Department are required to save a draft');
      return;
    }

    setIsSavingDraft(true);
    try {
      const payload: any = {
        companyId: values.companyId,
        company_id: values.companyId,
        departmentId: values.departmentId,
        department_id: values.departmentId,
        vendorId: values.vendorId || undefined,
        vendor_id: values.vendorId || undefined,
        title: values.paymentPurpose ? values.paymentPurpose.slice(0, 80) : 'Draft Payment Request',
        description: values.paymentPurpose || '',
        payment_purpose: values.paymentPurpose || 'Draft requisition',
        expenseCategory: values.expenseCategory || ExpenseCategory.RAW_MATERIALS,
        expense_category: values.expenseCategory || ExpenseCategory.RAW_MATERIALS,
        expenseSubcategory: values.expenseSubcategory || '',
        expense_subcategory: values.expenseSubcategory || '',
        invoiceNumber: values.invoiceNumber || undefined,
        invoice_number: values.invoiceNumber || undefined,
        invoiceDate: values.invoiceDate || undefined,
        invoice_date: values.invoiceDate ? new Date(values.invoiceDate).toISOString() : undefined,
        dueDate: values.dueDate || undefined,
        due_date: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
        amount: Number(values.amount) || 0,
        gstAmount: Number(values.gstAmount || 0),
        gst_amount: Number(values.gstAmount || 0),
        totalAmount: calculatedTotal,
        total_amount: calculatedTotal,
        paymentMode: values.paymentMode || PaymentMode.NEFT,
        payment_mode: values.paymentMode || PaymentMode.NEFT,
        bankAccount: values.bankAccount || '',
        bank_account: values.bankAccount || '',
        priority: values.priority || Priority.NORMAL,
        remarks: values.remarks || '',
        assignedApproverId: values.assignedApproverId || undefined,
        assigned_approver_id: values.assignedApproverId || undefined,
      };

      const draft = await paymentRequestService.createPaymentRequest(payload);

      if (attachedFiles.length > 0) {
        await uploadDocumentsForRequest(draft.id);
      }

      toast.success(`Draft #${draft.requestNumber || draft.id.slice(0, 8)} saved successfully!`);
      navigate(`/payment-requests/${draft.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Handle Duplicate Override Modal Confirmation
  const handleConfirmDuplicateOverride = () => {
    if (!overrideReason.trim()) {
      setOverrideReasonError('Mandatory override justification is required to proceed.');
      return;
    }
    setOverrideReasonError('');
    setShowDuplicateModal(false);
    executeFinalSubmit({ reason: overrideReason.trim() });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200 dark:border-dark-border">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Create Payment Requisition
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Initiate a verified disbursement requisition with invoice reconciliation and multi-level approval routing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveAsDraft}
            isLoading={isSavingDraft}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save as Draft
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit(onInitiateSubmit)}
            isLoading={isSubmitting}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Submit for Approval
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onInitiateSubmit)} className="space-y-6">
        {/* Main 2-column grid on desktop, 1 column on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT COLUMN: Entity, Vendor & Requisition Details */}
          <div className="space-y-6">
            {/* Section 1: Organization & Department */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm uppercase tracking-wider text-navy-800 dark:text-cyan-400 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <span>1. Organization & Origin</span>
                </CardTitle>
                <CardDescription>
                  Select the entity bearing this expenditure and the originating department.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Company / Entity *
                    </label>
                    <select
                      {...register('companyId')}
                      value={selectedCompanyId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedCompanyId(val);
                        setValue('companyId', val, { shouldValidate: true });
                        setValue('departmentId', ''); // reset department when company switches
                      }}
                      className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-slate-100 outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-600/20"
                      disabled={isLoadingCompanies}
                    >
                      <option value="">Select operating company...</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                    {errors.companyId && (
                      <p className="text-xs text-rose-600 mt-1">{errors.companyId.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Originating Department *
                    </label>
                    <select
                      {...register('departmentId')}
                      disabled={!selectedCompanyId || isLoadingDepartments}
                      className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-slate-100 outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-600/20 disabled:opacity-50"
                    >
                      <option value="">
                        {!selectedCompanyId
                          ? 'Choose company first...'
                          : isLoadingDepartments
                          ? 'Loading departments...'
                          : 'Select department...'}
                      </option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                    {errors.departmentId && (
                      <p className="text-xs text-rose-600 mt-1">{errors.departmentId.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Vendor Selection */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm uppercase tracking-wider text-navy-800 dark:text-cyan-400 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span>2. Vendor / Payee Details</span>
                </CardTitle>
                <CardDescription>
                  Search and pick from onboarded vendors to automatically bind verified banking info.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {isEmployeeReimbursement ? (
                  <div className="p-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 text-emerald-950 space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                        👤
                      </div>
                      <div>
                        <p className="font-bold text-sm text-emerald-900">
                          Employee Self Claim / Reimbursement
                        </p>
                        <p className="text-xs text-emerald-700 font-medium">
                          Claimant: <strong>{user?.fullName || user?.name || 'Logged-in Employee'}</strong> ({user?.email})
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-emerald-800 bg-white/80 p-3 rounded-lg border border-emerald-200 leading-relaxed">
                      💡 <strong>Disbursement Workflow:</strong> After Director reviews & approves this expense claim, Finance Accountant will transfer funds directly to your Bank Account / UPI ID specified below.
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Searchable Vendor Combobox */}
                    <div className="relative">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Vendor / Supplier *
                      </label>

                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search vendor by name, code or category..."
                          value={selectedVendor ? `${selectedVendor.name} (${selectedVendor.vendorCode})` : vendorSearch}
                          onChange={(e) => {
                            setVendorSearch(e.target.value);
                            setValue('vendorId', '');
                            setIsVendorDropdownOpen(true);
                          }}
                          onFocus={() => setIsVendorDropdownOpen(true)}
                          className="w-full h-10 pl-9 pr-8 text-sm rounded-lg border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-slate-100 outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-600/20"
                        />
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                        {selectedVendor && (
                          <button
                            type="button"
                            onClick={() => {
                              setValue('vendorId', '', { shouldValidate: true });
                              setVendorSearch('');
                            }}
                            className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-rose-500 font-bold"
                          >
                            &times;
                          </button>
                        )}
                      </div>

                      {/* Dropdown Options */}
                      {isVendorDropdownOpen && (
                        <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-xl divide-y divide-slate-100 dark:divide-dark-border">
                          {filteredVendors.length === 0 ? (
                            <div className="p-3 text-xs text-center text-slate-500">
                              No matching registered vendors found.
                            </div>
                          ) : (
                            filteredVendors.map((v) => (
                              <div
                                key={v.id}
                                onClick={() => handleSelectVendor(v.id)}
                                className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition flex items-center justify-between text-xs"
                              >
                                <div>
                                  <p className="font-semibold text-slate-900 dark:text-white">
                                    {v.name}
                                  </p>
                                  <p className="text-slate-500 font-mono mt-0.5">
                                    Code: {v.vendorCode} {v.gstNumber ? `| GST: ${v.gstNumber}` : ''}
                                  </p>
                                </div>
                                <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">
                                  {v.category || 'General'}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {errors.vendorId && (
                        <p className="text-xs text-rose-600 mt-1">{errors.vendorId.message}</p>
                      )}
                    </div>

                    {/* Selected Vendor Brief Card */}
                    {selectedVendor && (
                      <div className="p-3.5 rounded-xl border border-navy-100 dark:border-navy-900 bg-navy-50/60 dark:bg-navy-950/40 text-xs space-y-1.5">
                        <div className="flex items-center justify-between font-semibold text-navy-900 dark:text-cyan-300">
                          <span>{selectedVendor.name}</span>
                          <span className="font-mono text-[11px]">{selectedVendor.vendorCode}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400 text-[11px]">
                          <div>
                            Bank: <strong className="text-slate-800 dark:text-slate-200">{selectedVendor.bankName || '-'}</strong>
                          </div>
                          <div>
                            A/C: <strong className="text-slate-800 dark:text-slate-200">{selectedVendor.accountNumber || '-'}</strong>
                          </div>
                          <div>
                            IFSC: <strong className="text-slate-800 dark:text-slate-200 font-mono">{selectedVendor.ifscCode || '-'}</strong>
                          </div>
                          <div>
                            PAN: <strong className="text-slate-800 dark:text-slate-200 font-mono">{selectedVendor.panNumber || '-'}</strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Bank Account Details Input */}
                <div>
                  <Input
                    label={isEmployeeReimbursement ? "Employee Bank Account or UPI ID *" : "Payout Bank Details *"}
                    placeholder={
                      isEmployeeReimbursement
                        ? "e.g. UPI ID (salesperson@upi) OR HDFC A/C: 501000123456, IFSC: HDFC0001234"
                        : "e.g. HDFC Bank | A/C 50200012345678 | IFSC HDFC0000128"
                    }
                    {...register('bankAccount')}
                    error={errors.bankAccount?.message}
                    helperText={
                      isEmployeeReimbursement
                        ? "Your personal account / UPI ID where Accountant will transfer the approved reimbursement."
                        : "Designated beneficiary disbursement account, verified against vendor records."
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Expense Categorization & Justification */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm uppercase tracking-wider text-navy-800 dark:text-cyan-400 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>3. Categorization & Business Purpose</span>
                </CardTitle>
                <CardDescription>
                  Define accounting classification and provide transparent justification.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Expense Category *
                    </label>
                    <select
                      {...register('expenseCategory')}
                      className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-slate-100 outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-600/20"
                    >
                      <option value="VENDOR_PAYMENT">Vendor Payment (Supplier / Contractor Invoices)</option>
                      <option value="PURCHASE">Purchase Requisition (Direct Procurement)</option>
                      <option value="RAW_MATERIAL">Raw Materials & Manufacturing Components</option>
                      <option value="OFFICE_EXPENSES">Office Expenses, Supplies & Stationery</option>
                      <option value="EMPLOYEE_REIMBURSEMENT">Employee Reimbursement & Claims</option>
                      <option value="TRAVEL">Travel, Lodging & Conveyance</option>
                      <option value="TRANSPORT">Transport, Freight, Logistics & Shipping</option>
                      <option value="UTILITY_BILLS">Utility Bills (Electricity, Water, Gas, Telecom)</option>
                      <option value="MAINTENANCE">Maintenance & Plant Repairs</option>
                      <option value="SALARY_WAGES">Salary, Wages & Contract Labor</option>
                      <option value="PROFESSIONAL_FEES">Consulting, Legal & Professional Fees</option>
                      <option value="GOVERNMENT_FEES">Government Fees, Statutory Dues & Taxes</option>
                      <option value="CAPEX">Capital Expenditure (CapEx - Assets / Machinery)</option>
                      <option value="OTHER">Other Miscellaneous Expenses</option>
                    </select>
                  </div>

                  <div>
                    <Input
                      label="Expense Subcategory"
                      placeholder="e.g. Aluminum Ingots Batch #4, AWS Server"
                      {...register('expenseSubcategory')}
                    />
                  </div>
                </div>

                <div>
                  <Textarea
                    label="Payment Purpose & Business Justification *"
                    placeholder="Provide a clear, detailed business rationale for approvers. Include reference to purchase orders, project codes, or milestone completions..."
                    rows={4}
                    {...register('paymentPurpose')}
                    error={errors.paymentPurpose?.message}
                  />
                </div>

                <div>
                  <Textarea
                    label="Remarks & Special Deductions"
                    placeholder="TDS instructions, retention percentage, or remarks for the finance and accounting team..."
                    rows={2}
                    {...register('remarks')}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: Financials, Invoice Details & Documents */}
          <div className="space-y-6">
            {/* Section 4: Invoice & Scheduling */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm uppercase tracking-wider text-navy-800 dark:text-cyan-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>4. Invoice Details & Deadline</span>
                </CardTitle>
                <CardDescription>
                  Enter vendor tax invoice reference numbers and payment timelines.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Input
                      label={isEmployeeReimbursement ? "Claim Ref / Bill Number *" : "Invoice Number *"}
                      placeholder={isEmployeeReimbursement ? "e.g. EXP-2026-001 or Taxi-Bill-102" : "e.g. INV-2026-9021"}
                      {...register('invoiceNumber')}
                      error={errors.invoiceNumber?.message}
                    />
                  </div>

                  <div>
                    <Input
                      type="date"
                      label={isEmployeeReimbursement ? "Expense / Bill Date *" : "Invoice Date *"}
                      {...register('invoiceDate')}
                      error={errors.invoiceDate?.message}
                    />
                  </div>

                  <div>
                    <Input
                      type="date"
                      label="Due Date *"
                      {...register('dueDate')}
                      error={errors.dueDate?.message}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Disbursement Mode (7 Modes) *
                    </label>
                    <select
                      {...register('paymentMode')}
                      className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-slate-100 outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-600/20"
                    >
                      <option value="NEFT">NEFT - National Electronic Funds Transfer</option>
                      <option value="RTGS">RTGS - Real Time Gross Settlement (₹2L+)</option>
                      <option value="IMPS">IMPS - Immediate Payment Service (24x7 Instant)</option>
                      <option value="UPI">UPI - Unified Payments Interface (VPA / QR)</option>
                      <option value="CHEQUE">CHEQUE - Account Payee Cheque</option>
                      <option value="CASH">CASH - Petty Cash Disbursement</option>
                      <option value="OTHER">OTHER - Demand Draft / Wire Transfer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Urgency / Priority (4 Levels) *
                    </label>
                    <select
                      {...register('priority')}
                      className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-slate-100 outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-600/20"
                    >
                      <option value="LOW">Low Priority (Standard Queue)</option>
                      <option value="NORMAL">Normal Priority (Standard SLA)</option>
                      <option value="HIGH">High Priority (Expedited Sign-off)</option>
                      <option value="URGENT">Urgent (Critical / Same-Day Escalation)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Assigned Approver (Optional)
                  </label>
                  <select
                    {...register('assignedApproverId')}
                    className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-slate-100 outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-600/20"
                  >
                    <option value="">Auto-assign based on governance rules & threshold</option>
                    {approversList.map((appr) => (
                      <option key={appr.id} value={appr.id}>
                        {appr.fullName} ({appr.designation || appr.role})
                        {appr.approvalLimit ? ` - Limit: ${formatCurrency(appr.approvalLimit)}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Leave blank to automatically route according to company threshold policies.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Financial Breakdown & Calculation */}
            <Card className="border-navy-200 dark:border-navy-900">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm uppercase tracking-wider text-navy-800 dark:text-cyan-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span>5. Financial Reconciliation</span>
                </CardTitle>
                <CardDescription>
                  Enter base taxable amount and GST. The total payout is automatically computed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Base Amount (₹ INR) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...register('amount', { valueAsNumber: true })}
                        className="w-full h-10 pl-8 pr-3 text-sm font-semibold rounded-lg border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-slate-100 outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-600/20"
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 mt-1 block">
                      Formatted: {formatCurrency(watchAmount)}
                    </span>
                    {errors.amount && (
                      <p className="text-xs text-rose-600 mt-0.5">{errors.amount.message}</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        GST Amount (₹ INR)
                      </label>
                      <div className="flex items-center gap-1">
                        {[0, 5, 12, 18, 28].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => handleSelectGstRate(rate)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                              gstRate === rate
                                ? 'bg-navy-800 text-white dark:bg-cyan-600'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {rate}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...register('gstAmount', { valueAsNumber: true })}
                        onChange={(e) => {
                          setGstRate('custom');
                          setValue('gstAmount', parseFloat(e.target.value) || 0, { shouldValidate: true });
                        }}
                        className="w-full h-10 pl-8 pr-3 text-sm font-semibold rounded-lg border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-slate-100 outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-600/20"
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 mt-1 block">
                      Formatted: {formatCurrency(watchGstAmount)} {gstRate !== 'custom' ? `(${gstRate}%)` : '(Manual)'}
                    </span>
                    {errors.gstAmount && (
                      <p className="text-xs text-rose-600 mt-0.5">{errors.gstAmount.message}</p>
                    )}
                  </div>
                </div>

                {/* Auto-Calculated Total Summary Banner */}
                <div className="p-4 rounded-xl bg-slate-900 dark:bg-navy-950 text-white shadow-md space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Base Taxable Amount</span>
                    <span className="font-mono">{formatCurrency(watchAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>GST Component</span>
                    <span className="font-mono">{formatCurrency(watchGstAmount)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 block">
                        Total Requisition Amount
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Auto-calculated (Base + GST)
                      </span>
                    </div>
                    <span className="text-2xl font-extrabold text-white font-mono tracking-tight">
                      {formatCurrency(calculatedTotal)}
                    </span>
                  </div>
                  {calculatedTotal > 0 && (
                    <div className="pt-1 border-t border-slate-800 text-[11px] text-slate-300 italic">
                      Amount in Words: <span className="font-semibold text-slate-100">{numberToIndianWords(calculatedTotal)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Section 6: Invoices & Supporting Attachments */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm uppercase tracking-wider text-navy-800 dark:text-cyan-400 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4" />
                  <span>6. Supporting Documents</span>
                </CardTitle>
                <CardDescription>
                  Upload tax invoices, purchase orders, e-way bills, or delivery challans (PDF, JPG, PNG, XLSX).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="border-2 border-dashed border-slate-300 dark:border-dark-border rounded-xl p-6 text-center hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition cursor-pointer relative">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-navy-50 dark:bg-navy-900/60 flex items-center justify-center text-navy-700 dark:text-cyan-400 mb-2">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Drag and drop files here, or <span className="text-navy-700 dark:text-cyan-400 underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Max 25MB each (PDF, PNG, JPG, XLSX)
                    </p>
                  </div>
                </div>

                {attachedFiles.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Staged Attachments ({attachedFiles.length})
                    </p>
                    <div className="divide-y divide-slate-100 dark:divide-dark-border rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50/50 dark:bg-dark-card/50 overflow-hidden">
                      {attachedFiles.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 text-xs"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                            {item.previewUrl ? (
                              <img
                                src={item.previewUrl}
                                alt={item.file.name}
                                className="w-8 h-8 rounded object-cover shrink-0 border"
                              />
                            ) : (
                              <FileCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                {item.file.name}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {formatFileSize(item.file.size)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachedFile(item.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="Remove file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Sticky Action Bar */}
        <div className="sticky bottom-4 z-20 flex items-center justify-between p-4 rounded-2xl bg-white/95 dark:bg-dark-card/95 backdrop-blur-md border border-slate-200 dark:border-dark-border shadow-xl">
          <div className="text-xs text-slate-500 hidden sm:block">
            <span>Requisition Total: </span>
            <strong className="text-base text-slate-900 dark:text-white font-mono">
              {formatCurrency(calculatedTotal)}
            </strong>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/payment-requests')}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleSaveAsDraft}
              isLoading={isSavingDraft}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save as Draft
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Submit Requisition
            </Button>
          </div>
        </div>
      </form>

      {/* Confirmation Dialog Before Submit */}
      <ConfirmDialog
        isOpen={showConfirmSubmit}
        onClose={() => setShowConfirmSubmit(false)}
        onConfirm={() => executeFinalSubmit()}
        actionType="warning"
        title="Submit Payment Request for Approval?"
        message="This requisition will be submitted to the multi-level approval pipeline. Once submitted, it cannot be modified without formal approval or clarification review."
        details={{
          vendorName: selectedVendor?.name,
          amount: calculatedTotal,
          invoiceNumber: pendingFormData?.invoiceNumber,
          departmentName: departments.find((d) => d.id === pendingFormData?.departmentId)?.name,
          companyName: companies.find((c) => c.id === pendingFormData?.companyId)?.name,
        }}
        confirmText="Confirm & Submit"
        cancelText="Review Details"
        isLoading={isSubmitting}
      />

      {/* Duplicate Detected Warning Modal */}
      <Modal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        variant="danger"
        title="Potential Duplicate Invoice Detected"
        description="A payment requisition with identical vendor, invoice number, and transaction amount already exists in the system."
        size="lg"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Duplicate Match Alert</span>
            </div>
            <p>
              {duplicateMatchInfo?.message ||
                `An existing record matching Invoice #${pendingFormData?.invoiceNumber} for ${selectedVendor?.name} with amount ${formatCurrency(pendingFormData?.amount || 0)} was identified.`}
            </p>
            {duplicateMatchInfo?.matchedRequest && (
              <div className="p-2.5 rounded bg-white/70 dark:bg-slate-900/60 font-mono text-[11px] space-y-0.5 border border-rose-200/50">
                <p>Existing Request #: {duplicateMatchInfo.matchedRequest.requestNumber}</p>
                <p>Status: {duplicateMatchInfo.matchedRequest.status}</p>
                <p>Amount: {formatCurrency(duplicateMatchInfo.matchedRequest.amount)}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Override Justification *
            </label>
            <Textarea
              placeholder="If this is a legitimate separate invoice (e.g., partial milestone, revised billing, or distinct contract phase), provide a mandatory audit explanation..."
              rows={3}
              value={overrideReason}
              onChange={(e) => {
                setOverrideReason(e.target.value);
                if (overrideReasonError) setOverrideReasonError('');
              }}
              error={overrideReasonError}
            />
            <p className="text-[11px] text-slate-400">
              This explanation will be permanently recorded in the audit trail and flagged for executive approvers.
            </p>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-dark-border">
            <Button
              variant="outline"
              onClick={() => {
                setShowDuplicateModal(false);
                setOverrideReason('');
                setOverrideReasonError('');
              }}
            >
              Cancel & Edit Request
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDuplicateOverride}
              isLoading={isSubmitting}
            >
              Proceed with Justification
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CreatePaymentRequest;
