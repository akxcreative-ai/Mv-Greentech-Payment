// ==========================================
// MV Payment Approval System - Core Types
// ==========================================

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  APPROVER = 'APPROVER',
  ACCOUNTANT = 'ACCOUNTANT',
  REQUESTER = 'REQUESTER',
  MANAGEMENT = 'MANAGEMENT',
  DIRECTOR = 'DIRECTOR',
}

export enum RequestStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  CLARIFICATION_REQUESTED = 'CLARIFICATION_REQUESTED',
  CLARIFICATION_REQUIRED = 'CLARIFICATION_REQUIRED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAYMENT_SCHEDULED = 'PAYMENT_SCHEDULED',
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  PAID = 'PAID',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ON_HOLD = 'ON_HOLD',
}

export enum Priority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum ExpenseCategory {
  VENDOR_PAYMENT = 'VENDOR_PAYMENT',
  PURCHASE = 'PURCHASE',
  RAW_MATERIAL = 'RAW_MATERIAL',
  OFFICE_EXPENSES = 'OFFICE_EXPENSES',
  EMPLOYEE_REIMBURSEMENT = 'EMPLOYEE_REIMBURSEMENT',
  TRAVEL = 'TRAVEL',
  TRANSPORT = 'TRANSPORT',
  UTILITY_BILLS = 'UTILITY_BILLS',
  MAINTENANCE = 'MAINTENANCE',
  SALARY_WAGES = 'SALARY_WAGES',
  PROFESSIONAL_FEES = 'PROFESSIONAL_FEES',
  GOVERNMENT_FEES = 'GOVERNMENT_FEES',
  CAPEX = 'CAPEX',
  OTHER = 'OTHER',
  RAW_MATERIALS = 'RAW_MATERIALS',
  UTILITIES = 'UTILITIES',
  RENT = 'RENT',
  OFFICE_SUPPLIES = 'OFFICE_SUPPLIES',
  CONSULTING = 'CONSULTING',
  IT_SOFTWARE = 'IT_SOFTWARE',
  MARKETING = 'MARKETING',
  LOGISTICS = 'LOGISTICS',
  TRAVEL_ENTERTAINMENT = 'TRAVEL_ENTERTAINMENT',
  CAPITAL_EXPENDITURE = 'CAPITAL_EXPENDITURE',
}

export enum PaymentMode {
  NEFT = 'NEFT',
  RTGS = 'RTGS',
  IMPS = 'IMPS',
  CHEQUE = 'CHEQUE',
  UPI = 'UPI',
  DEMAND_DRAFT = 'DEMAND_DRAFT',
  CASH = 'CASH',
  OTHER = 'OTHER',
}

export enum NotificationType {
  PAYMENT_REQUEST_CREATED = 'PAYMENT_REQUEST_CREATED',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  PAYMENT_APPROVED = 'PAYMENT_APPROVED',
  PAYMENT_REJECTED = 'PAYMENT_REJECTED',
  CLARIFICATION_REQUESTED = 'CLARIFICATION_REQUESTED',
  CLARIFICATION_RESPONDED = 'CLARIFICATION_RESPONDED',
  PAYMENT_PROCESSED = 'PAYMENT_PROCESSED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
}

export enum AuditEventType {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  REQUEST_CREATED = 'REQUEST_CREATED',
  REQUEST_UPDATED = 'REQUEST_UPDATED',
  REQUEST_SUBMITTED = 'REQUEST_SUBMITTED',
  REQUEST_APPROVED = 'REQUEST_APPROVED',
  REQUEST_REJECTED = 'REQUEST_REJECTED',
  CLARIFICATION_REQUESTED = 'CLARIFICATION_REQUESTED',
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  VENDOR_CREATED = 'VENDOR_CREATED',
  VENDOR_UPDATED = 'VENDOR_UPDATED',
  SETTINGS_UPDATED = 'SETTINGS_UPDATED',
  EXPORT_GENERATED = 'EXPORT_GENERATED',
}

export enum ApprovalAction {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CLARIFICATION_REQUESTED = 'CLARIFICATION_REQUESTED',
  SKIPPED = 'SKIPPED',
}

export enum PaymentStatus {
  INITIATED = 'INITIATED',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

// ------------------------------------------
// Organization & User Entities
// ------------------------------------------

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName?: string;
  accountType?: 'SAVINGS' | 'CURRENT';
}

export interface Company {
  id: string;
  name: string;
  code: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  primaryColor?: string;
  secondaryColor?: string;
  bankDetails?: BankDetails;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  companyId: string;
  company?: Company;
  headName?: string;
  headUserId?: string;
  headUser?: User;
  budget?: number;
  currentSpend?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  name?: string;
  role: Role;
  companyId: string;
  company?: Company;
  departmentId?: string;
  department?: Department;
  isActive: boolean;
  avatarUrl?: string;
  phoneNumber?: string;
  approvalLimit?: number;
  designation?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  vendorCode: string;
  companyId?: string;
  company?: Company;
  contactPerson?: string;
  panNumber?: string;
  gstNumber?: string;
  email?: string;
  phone?: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName?: string;
  address?: string;
  category?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------
// Payment Request & Associated Records
// ------------------------------------------

export interface PaymentRequestDocument {
  id: string;
  paymentRequestId: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface ApprovalRecord {
  id: string;
  paymentRequestId: string;
  approverId: string;
  approver?: User;
  level: number;
  status: ApprovalAction | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLARIFICATION_REQUESTED' | 'SKIPPED';
  comments?: string;
  actionDate?: string;
  createdAt: string;
}

export interface ClarificationMessage {
  id: string;
  paymentRequestId: string;
  senderId: string;
  sender?: User;
  message: string;
  attachments?: string[];
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  paymentRequestId: string;
  paymentMode: PaymentMode;
  transactionReference: string;
  utrNumber: string;
  paymentDate: string;
  amountPaid: number;
  processedById: string;
  processedBy?: User;
  bankAccountId?: string;
  remarks?: string;
  paymentReceiptUrl?: string;
  status: PaymentStatus | 'INITIATED' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  createdAt: string;
}

export interface PaymentRequest {
  id: string;
  requestNumber: string;
  title: string;
  description?: string;
  companyId: string;
  company?: Company;
  departmentId: string;
  department?: Department;
  requesterId: string;
  requester?: User;
  vendorId: string;
  vendor?: Vendor;
  amount: number;
  gstAmount?: number;
  totalAmount?: number;
  gstRate?: number;
  subcategory?: string;
  expenseSubcategory?: string;
  paymentPurpose?: string;
  currency: string;
  expenseCategory: ExpenseCategory;
  paymentMode: PaymentMode;
  priority: Priority;
  status: RequestStatus;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  documents: PaymentRequestDocument[];
  approvalRecords: ApprovalRecord[];
  clarificationMessages: ClarificationMessage[];
  paymentRecord?: PaymentRecord;
  currentApprovalLevel: number;
  totalApprovalLevels: number;
  remarks?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------
// Rules, Settings & Audits
// ------------------------------------------

export interface ApprovalRule {
  id: string;
  companyId: string;
  departmentId?: string;
  minAmount: number;
  maxAmount?: number;
  level: number;
  approverRoleId: Role;
  approverRole: Role;
  approverUserId?: string;
  approverUser?: User;
  isMandatory: boolean;
  createdAt: string;
}

export interface SystemSettings {
  companyName: string;
  currencySymbol: string;
  fiscalYearStartMonth: number;
  maxFileUploadSizeMB: number;
  allowedFileExtensions: string[];
  autoReminderHours: number;
  sessionTimeoutMinutes: number;
  defaultPaymentMode: PaymentMode;
  emailNotificationEnabled: boolean;
  smsNotificationEnabled?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  eventType: AuditEventType;
  userId: string;
  user?: User;
  entityType: string;
  entityId: string;
  action: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ------------------------------------------
// API Responses
// ------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ------------------------------------------
// Authentication Types
// ------------------------------------------

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  token: string;
  refreshToken?: string;
  user: User;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  companyId: string;
  exp: number;
  iat: number;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

// ------------------------------------------
// Dashboard & Analytics Types
// ------------------------------------------

export interface MonthlySpendItem {
  month: string;
  amount: number;
}

export interface CategorySpendItem {
  category: ExpenseCategory | string;
  amount: number;
  percentage?: number;
}

export interface StatusBreakdownItem {
  status: RequestStatus;
  count: number;
  amount: number;
}

export interface DashboardStats {
  totalRequests: number;
  pendingApprovals: number;
  approvedRequests: number;
  rejectedRequests: number;
  totalAmountPaid: number;
  totalPendingAmount: number;
  monthlySpend: MonthlySpendItem[];
  categorySpend: CategorySpendItem[];
  statusBreakdown: StatusBreakdownItem[];
}

export interface ApproverDashboardStats {
  pendingMyApproval?: number;
  assigned_pending_count?: number;
  approvedByMe?: number;
  approved_this_month?: number;
  rejectedByMe?: number;
  rejected_this_month?: number;
  avgApprovalTimeHours?: number;
  pendingAmount?: number;
  assigned_pending_amount?: number;
  highPriorityPending?: number;
  urgent_count?: number;
  approvedAmountThisMonth?: number;
  approved_amount_this_month?: number;
  clarificationsRequestedCount?: number;
  clarifications_requested_count?: number;
}

export interface AccountantDashboardStats {
  readyForPaymentCount?: number;
  ready_for_payment_count?: number;
  readyForPaymentAmount?: number;
  ready_for_payment_amount?: number;
  paidThisMonthCount?: number;
  paid_this_month_count?: number;
  paidThisMonthAmount?: number;
  paid_this_month_amount?: number;
  paymentModesBreakdown?: Record<string, number>;
  payment_modes_breakdown?: Record<string, number>;
  recentDisbursements?: Array<{
    request_number?: string;
    requestNumber?: string;
    actual_amount?: number;
    amount?: number;
    payment_mode?: string;
    paymentMode?: string;
    utr_number?: string;
    utrNumber?: string;
    payment_date?: string;
    paymentDate?: string;
  }>;
}

export interface AdminDashboardStats {
  totalRequests?: number;
  total_requests?: number;
  totalAmount?: number;
  total_amount?: number;
  pendingApprovalCount?: number;
  pending_approval_count?: number;
  pendingApprovalAmount?: number;
  pending_approval_amount?: number;
  approvedCount?: number;
  approved_count?: number;
  approvedAmount?: number;
  approved_amount?: number;
  paidCount?: number;
  paid_count?: number;
  paidAmount?: number;
  paid_amount?: number;
  rejectedCount?: number;
  rejected_count?: number;
  clarificationCount?: number;
  clarification_count?: number;
  statusBreakdown?: Record<string, number> | StatusBreakdownItem[];
  status_breakdown?: Record<string, number>;
  topDepartments?: Array<{ department: string; total_spend: number; count: number }>;
  top_departments?: Array<{ department: string; total_spend: number; count: number }>;
  topCategories?: Array<{ category: string; total_spend: number; count: number }>;
  top_categories?: Array<{ category: string; total_spend: number; count: number }>;
  monthlySpend?: MonthlySpendItem[];
  categorySpend?: CategorySpendItem[];
}

// ------------------------------------------
// Common Query / Filter / Input Types
// ------------------------------------------

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaymentRequestFilters extends PaginationParams {
  status?: RequestStatus | string;
  priority?: Priority | string;
  companyId?: string;
  departmentId?: string;
  vendorId?: string;
  requesterId?: string;
  expenseCategory?: ExpenseCategory | string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface CreatePaymentRequestInput {
  title: string;
  description?: string;
  companyId: string;
  departmentId: string;
  vendorId: string;
  amount: number;
  currency?: string;
  expenseCategory: ExpenseCategory | string;
  paymentMode: PaymentMode | string;
  priority: Priority | string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  remarks?: string;
}

export interface UpdatePaymentRequestInput extends Partial<CreatePaymentRequestInput> {}

export interface DuplicateCheckInput {
  vendorId: string;
  invoiceNumber: string;
  amount: number;
  invoiceDate?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchedRequest?: PaymentRequest;
  confidenceScore?: number;
  message?: string;
}

export interface ApprovalFilters extends PaginationParams {
  status?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
}

export interface ApproveRequestInput {
  comment?: string;
  approvedAmount?: number;
}

export interface RejectRequestInput {
  reason: string;
}

export interface ClarificationInput {
  message: string;
  attachments?: string[];
}

export interface RecordPaymentInput {
  paymentMode: PaymentMode | string;
  transactionReference?: string;
  utrNumber?: string;
  paymentDate?: string;
  amountPaid?: number;
  actualAmount?: number;
  bankAccountId?: string;
  bankAccount?: string;
  remarks?: string;
  paymentRemarks?: string;
  paymentReceiptUrl?: string;
  chequeNumber?: string;
  transactionId?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UserFilters extends PaginationParams {
  role?: Role | string;
  companyId?: string;
  departmentId?: string;
  isActive?: boolean;
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  role: Role;
  companyId: string;
  departmentId?: string;
  password?: string;
  phoneNumber?: string;
  designation?: string;
  approvalLimit?: number;
}

export interface UpdateUserInput extends Partial<CreateUserInput> {
  isActive?: boolean;
}

export interface CompanyFilters extends PaginationParams {
  isActive?: boolean;
}

export interface CreateCompanyInput {
  name: string;
  code: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  primaryColor?: string;
  secondaryColor?: string;
  bankDetails?: BankDetails;
}

export interface UpdateCompanyInput extends Partial<CreateCompanyInput> {
  isActive?: boolean;
}

export interface DepartmentFilters extends PaginationParams {
  companyId?: string;
  isActive?: boolean;
}

export interface CreateDepartmentInput {
  name: string;
  code: string;
  companyId: string;
  headName?: string;
  headUserId?: string;
  budget?: number;
}

export interface UpdateDepartmentInput extends Partial<CreateDepartmentInput> {
  isActive?: boolean;
}

export interface VendorFilters extends PaginationParams {
  category?: string;
  companyId?: string;
  isActive?: boolean;
}

export interface CreateVendorInput {
  name: string;
  vendorCode: string;
  companyId?: string;
  contactPerson?: string;
  panNumber?: string;
  gstNumber?: string;
  email?: string;
  phone?: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName?: string;
  address?: string;
  category?: string;
}

export interface UpdateVendorInput extends Partial<CreateVendorInput> {
  isActive?: boolean;
}

export interface NotificationFilters extends PaginationParams {
  isRead?: boolean;
  type?: NotificationType;
}

export interface AuditLogFilters extends PaginationParams {
  eventType?: AuditEventType | string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  companyId?: string;
  departmentId?: string;
  vendorId?: string;
  expenseCategory?: ExpenseCategory | string;
  groupBy?: 'day' | 'week' | 'month' | 'category' | 'vendor' | 'department';
}

export interface SpendReportData {
  totalSpend: number;
  averageSpend: number;
  transactionCount: number;
  dataPoints: { date: string; amount: number; count: number }[];
}

export interface VendorSpendReportData {
  vendorId: string;
  vendorName: string;
  totalAmount: number;
  invoiceCount: number;
  percentage: number;
}

export interface DepartmentSpendReportData {
  departmentId: string;
  departmentName: string;
  budget: number;
  totalSpend: number;
  remainingBudget: number;
  utilizationPercentage: number;
}

export interface CreateApprovalRuleInput {
  companyId: string;
  departmentId?: string;
  minAmount: number;
  maxAmount?: number;
  level: number;
  approverRoleId: Role;
  approverUserId?: string;
  isMandatory?: boolean;
}

export interface UpdateApprovalRuleInput extends Partial<CreateApprovalRuleInput> {}

