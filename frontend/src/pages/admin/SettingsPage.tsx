import React, { useState } from 'react';
import { Role, Company, ApprovalRule } from '@/types';
import { formatCurrency } from '@/utils/format';
import {
  Settings,
  Sliders,
  ShieldCheck,
  Mail,
  Bell,
  Lock,
  Plus,
  Trash2,
  Edit2,
  Save,
  Send,
  AlertCircle,
  Clock,
  Layers,
  Building2,
  FileText,
} from 'lucide-react';
import {
  Button,
  Input,
  Modal,
  Tabs,
  TabItem,
  ConfirmDialog,
  Badge,
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

const initialApprovalRules: ApprovalRule[] = [
  {
    id: 'rule_001',
    companyId: 'comp_001',
    minAmount: 0,
    maxAmount: 200000,
    level: 1,
    approverRoleId: Role.APPROVER,
    approverRole: Role.APPROVER,
    isMandatory: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rule_002',
    companyId: 'comp_001',
    minAmount: 200001,
    maxAmount: 1000000,
    level: 2,
    approverRoleId: Role.MANAGEMENT,
    approverRole: Role.MANAGEMENT,
    isMandatory: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rule_003',
    companyId: 'comp_001',
    minAmount: 1000001,
    maxAmount: undefined,
    level: 3,
    approverRoleId: Role.DIRECTOR,
    approverRole: Role.DIRECTOR,
    isMandatory: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rule_004',
    companyId: 'comp_002',
    minAmount: 0,
    maxAmount: 500000,
    level: 1,
    approverRoleId: Role.APPROVER,
    approverRole: Role.APPROVER,
    isMandatory: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rule_005',
    companyId: 'comp_002',
    minAmount: 500001,
    maxAmount: undefined,
    level: 2,
    approverRoleId: Role.DIRECTOR,
    approverRole: Role.DIRECTOR,
    isMandatory: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');

  // General Settings state
  const [generalSettings, setGeneralSettings] = useState({
    appName: 'MV Payment Approval System',
    companyName: 'MV Holdings Group of Companies',
    defaultThreshold: 500000,
    currencySymbol: '₹',
    fiscalYearStartMonth: 4, // April
    maxFileUploadSizeMB: 25,
    autoReminderHours: 24,
  });

  // Approval Rules state
  const [rules, setRules] = useState<ApprovalRule[]>(initialApprovalRules);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<ApprovalRule | null>(null);

  const [ruleFormData, setRuleFormData] = useState({
    companyId: mockCompanies[0]?.id || '',
    minAmount: 0,
    maxAmount: '' as number | string,
    approverRole: Role.APPROVER,
    level: 1,
    requiresApproval: true,
    isMandatory: true,
  });
  const [ruleErrors, setRuleErrors] = useState<Record<string, string>>({});

  // Notification settings state
  const [notifications, setNotifications] = useState({
    emailEnabled: true,
    inAppEnabled: true,
    notifyOnRequisitionCreated: true,
    notifyOnApprovalRequired: true,
    notifyOnClarification: true,
    notifyOnPaymentProcessed: true,
    reminderIntervalHours: 24,
    sendWeeklyDigest: false,
  });

  // Security settings state
  const [security, setSecurity] = useState({
    sessionTimeoutMinutes: 30,
    maxLockoutAttempts: 5,
    enforce2FA: false,
    minPasswordLength: 10,
    requireSpecialChars: true,
    requireNumbers: true,
    passwordExpirationDays: 90,
  });

  // Test email modal state
  const [isTestEmailModalOpen, setIsTestEmailModalOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('admin@mvpayments.com');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  // Tabs configuration
  const tabItems: TabItem[] = [
    { id: 'general', label: 'General Configuration', icon: <Sliders className="w-4 h-4" /> },
    { id: 'approval_rules', label: 'Approval Matrix Rules', icon: <Layers className="w-4 h-4" />, badge: rules.length },
    { id: 'email', label: 'Email Transport (SMTP)', icon: <Mail className="w-4 h-4" /> },
    { id: 'notifications', label: 'Alert Policies', icon: <Bell className="w-4 h-4" /> },
    { id: 'security', label: 'Enterprise Security', icon: <Lock className="w-4 h-4" /> },
  ];

  // Lookups
  const getCompanyName = (companyId?: string) => {
    return mockCompanies.find((c) => c.id === companyId)?.name || 'All Entities';
  };

  const getCompanyCode = (companyId?: string) => {
    return mockCompanies.find((c) => c.id === companyId)?.code || 'ALL';
  };

  // Save General
  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    if (generalSettings.defaultThreshold < 0) {
      toast.error('Default threshold cannot be negative.');
      return;
    }
    toast.success('General system settings successfully updated.');
  };

  // Save Notifications
  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Notification policies successfully saved.');
  };

  // Save Security
  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Security compliance parameters updated.');
  };

  // Rule Form Validation
  const validateRuleForm = () => {
    const errors: Record<string, string> = {};
    if (!ruleFormData.companyId) errors.companyId = 'Operating company is required';
    if (ruleFormData.minAmount < 0) errors.minAmount = 'Minimum amount cannot be negative';

    if (ruleFormData.maxAmount !== '' && Number(ruleFormData.maxAmount) <= ruleFormData.minAmount) {
      errors.maxAmount = 'Max amount must be strictly greater than min amount';
    }

    if (ruleFormData.level < 1) errors.level = 'Level must be at least 1';

    setRuleErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open Create Rule Modal
  const handleOpenCreateRule = () => {
    setRuleFormData({
      companyId: mockCompanies[0]?.id || '',
      minAmount: 0,
      maxAmount: '',
      approverRole: Role.APPROVER,
      level: 1,
      requiresApproval: true,
      isMandatory: true,
    });
    setRuleErrors({});
    setIsRuleModalOpen(true);
  };

  // Open Edit Rule Modal
  const handleOpenEditRule = (rule: ApprovalRule) => {
    setEditingRule(rule);
    setRuleFormData({
      companyId: rule.companyId,
      minAmount: rule.minAmount,
      maxAmount: rule.maxAmount !== undefined ? rule.maxAmount : '',
      approverRole: rule.approverRole,
      level: rule.level,
      requiresApproval: true,
      isMandatory: rule.isMandatory,
    });
    setRuleErrors({});
  };

  // Save Rule Create
  const handleSaveCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRuleForm()) return;

    const newRule: ApprovalRule = {
      id: `rule_${Date.now()}`,
      companyId: ruleFormData.companyId,
      minAmount: Number(ruleFormData.minAmount),
      maxAmount: ruleFormData.maxAmount !== '' ? Number(ruleFormData.maxAmount) : undefined,
      level: Number(ruleFormData.level),
      approverRoleId: ruleFormData.approverRole,
      approverRole: ruleFormData.approverRole,
      isMandatory: ruleFormData.isMandatory,
      createdAt: new Date().toISOString(),
    };

    setRules((prev) => [...prev, newRule]);
    setIsRuleModalOpen(false);
    toast.success('Approval rule matrix entry created.');
  };

  // Save Rule Edit
  const handleSaveEditRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    if (!validateRuleForm()) return;

    setRules((prev) =>
      prev.map((r) => {
        if (r.id === editingRule.id) {
          return {
            ...r,
            companyId: ruleFormData.companyId,
            minAmount: Number(ruleFormData.minAmount),
            maxAmount: ruleFormData.maxAmount !== '' ? Number(ruleFormData.maxAmount) : undefined,
            level: Number(ruleFormData.level),
            approverRoleId: ruleFormData.approverRole,
            approverRole: ruleFormData.approverRole,
            isMandatory: ruleFormData.isMandatory,
          };
        }
        return r;
      })
    );

    setEditingRule(null);
    toast.success('Approval rule entry updated.');
  };

  // Delete Rule
  const handleConfirmDeleteRule = () => {
    if (!deletingRule) return;
    setRules((prev) => prev.filter((r) => r.id !== deletingRule.id));
    toast.success('Approval rule entry removed.');
    setDeletingRule(null);
  };

  // Send Test Email Simulation
  const handleSendTestEmail = () => {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      toast.error('Please enter a valid recipient email address.');
      return;
    }
    setIsSendingTestEmail(true);
    setTimeout(() => {
      setIsSendingTestEmail(false);
      setIsTestEmailModalOpen(false);
      toast.success(`Test verification email dispatched to ${testEmailAddress}.`);
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-navy-900 dark:bg-cyan-500/10 text-white dark:text-cyan-400 flex items-center justify-center font-bold shadow-sm">
              <Settings className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                System Governance & Configuration
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Application global thresholds, multi-tier approval rules, mail transport, and security policies.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-slate-200 dark:border-dark-border">
        <Tabs tabs={tabItems} activeTab={activeTab} onChange={setActiveTab} variant="underline" />
      </div>

      {/* TAB 1: General Settings */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="space-y-6">
          <div className="app-card p-6 space-y-5">
            <div className="border-b border-slate-100 dark:border-dark-border pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-navy-800 dark:text-cyan-400" />
                Core Application Parameters
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Primary metadata and baseline thresholds for all operating units.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Application Name"
                required
                value={generalSettings.appName}
                onChange={(e) => setGeneralSettings({ ...generalSettings, appName: e.target.value })}
                helperText="Displayed across navigation bars, invoice attachments, and email headers."
              />

              <Input
                label="Corporate Entity Umbrella Name"
                required
                value={generalSettings.companyName}
                onChange={(e) => setGeneralSettings({ ...generalSettings, companyName: e.target.value })}
                helperText="The parent conglomerate name displayed on reports and audit manifests."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Default Payment Requisition Threshold (₹)"
                type="number"
                min={0}
                required
                value={generalSettings.defaultThreshold}
                onChange={(e) =>
                  setGeneralSettings({ ...generalSettings, defaultThreshold: Number(e.target.value) })
                }
                helperText="Requests above this threshold automatically require Director/Executive authorization."
              />

              <Input
                label="Primary Currency Symbol"
                required
                value={generalSettings.currencySymbol}
                onChange={(e) =>
                  setGeneralSettings({ ...generalSettings, currencySymbol: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                  Fiscal Year Starting Month
                </label>
                <select
                  value={generalSettings.fiscalYearStartMonth}
                  onChange={(e) =>
                    setGeneralSettings({
                      ...generalSettings,
                      fiscalYearStartMonth: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
                >
                  <option value={4}>April (Indian Standard FY)</option>
                  <option value={1}>January (Calendar Year)</option>
                  <option value={7}>July</option>
                  <option value={10}>October</option>
                </select>
              </div>

              <Input
                label="Max File Upload Size (MB)"
                type="number"
                min={1}
                max={100}
                value={generalSettings.maxFileUploadSizeMB}
                onChange={(e) =>
                  setGeneralSettings({
                    ...generalSettings,
                    maxFileUploadSizeMB: Number(e.target.value),
                  })
                }
                helperText="Per invoice attachment or proof of payment."
              />

              <Input
                label="Auto-Reminder Trigger (Hours)"
                type="number"
                min={1}
                value={generalSettings.autoReminderHours}
                onChange={(e) =>
                  setGeneralSettings({
                    ...generalSettings,
                    autoReminderHours: Number(e.target.value),
                  })
                }
                helperText="Frequency to nudge approvers for pending requisitions."
              />
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-dark-border">
              <Button type="submit" className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950">
                <Save className="w-4 h-4 mr-1.5" />
                Save General Settings
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: Approval Rules Matrix */}
      {activeTab === 'approval_rules' && (
        <div className="space-y-4">
          <div className="app-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-navy-800 dark:text-cyan-400" />
                Tiered Financial Authority Matrix
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Define required approver roles and levels based on invoice monetary value and legal entity.
              </p>
            </div>

            <Button
              type="button"
              onClick={handleOpenCreateRule}
              className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950 dark:hover:bg-cyan-400 shadow-sm text-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Approval Rule
            </Button>
          </div>

          <div className="app-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-dark-border text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Min Amount</th>
                    <th className="px-4 py-3">Max Amount</th>
                    <th className="px-4 py-3">Approver Role</th>
                    <th className="px-4 py-3">Condition</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs">
                          {getCompanyName(r.companyId)}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {getCompanyCode(r.companyId)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-bold text-xs px-2 py-0.5 rounded bg-navy-50 text-navy-800 dark:bg-cyan-950/40 dark:text-cyan-300">
                          Level {r.level}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white text-xs">
                        {formatCurrency(r.minAmount)}
                      </td>

                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white text-xs">
                        {r.maxAmount !== undefined ? formatCurrency(r.maxAmount) : 'Unlimited (No Cap)'}
                      </td>

                      <td className="px-4 py-3.5">
                        <Badge variant="primary" size="sm">
                          {r.approverRole.replace(/_/g, ' ')}
                        </Badge>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            r.isMandatory
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {r.isMandatory ? 'Mandatory Gate' : 'Optional'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditRule(r)}
                            className="h-8 px-2 text-xs text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-cyan-400"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingRule(r)}
                            className="h-8 px-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Email Transport (SMTP) Settings */}
      {activeTab === 'email' && (
        <div className="space-y-6">
          <div className="app-card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-dark-border pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-navy-800 dark:text-cyan-400" />
                  SMTP Relay Transport Configuration
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated notification delivery relay service for requisition notifications and OTPs.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTestEmailModalOpen(true)}
                className="text-xs shrink-0"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Send Test Email
              </Button>
            </div>

            {/* Read-Only Notice */}
            <div className="p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl text-xs text-sky-800 dark:text-sky-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Security Governance & Key Storage</p>
                <p className="mt-0.5 text-sky-700 dark:text-sky-400">
                  SMTP authentication parameters are managed directly via server environment variables (<code className="bg-sky-100 dark:bg-sky-900 px-1 py-0.5 rounded">SMTP_HOST</code>, <code className="bg-sky-100 dark:bg-sky-900 px-1 py-0.5 rounded">SMTP_PASS</code>) in compliance with financial security requirements.
                </p>
              </div>
            </div>

            {/* Read-only Display Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1">
                  SMTP Relay Host
                </label>
                <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300">
                  smtp.sendgrid.net
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1">
                  Relay Port
                </label>
                <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300">
                  587 (TLS / STARTTLS)
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1">
                  Sender From Address
                </label>
                <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300">
                  noreply@mvpayments.com
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1">
                  Sender Display Name
                </label>
                <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300">
                  MV Payment Approval System
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Transport Status: <strong>Connected & Active</strong>
              </span>
              <span>TLS 1.3 Strict Verification</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Notification Settings */}
      {activeTab === 'notifications' && (
        <form onSubmit={handleSaveNotifications} className="space-y-6">
          <div className="app-card p-6 space-y-5">
            <div className="border-b border-slate-100 dark:border-dark-border pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-navy-800 dark:text-cyan-400" />
                Requisition Event Alert Channels
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure automated emails and in-app bell notifications for key lifecycle events.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Email Notifications</h4>
                  <p className="text-xs text-slate-400">Send transactional alerts to user inbox for status changes.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.emailEnabled}
                  onChange={(e) => setNotifications({ ...notifications, emailEnabled: e.target.checked })}
                  className="w-4 h-4 text-navy-800 dark:text-cyan-500 rounded border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">In-App Notification Bell</h4>
                  <p className="text-xs text-slate-400">Real-time alerts inside the dashboard TopBar.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.inAppEnabled}
                  onChange={(e) => setNotifications({ ...notifications, inAppEnabled: e.target.checked })}
                  className="w-4 h-4 text-navy-800 dark:text-cyan-500 rounded border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Approval Required Escalations</h4>
                  <p className="text-xs text-slate-400">Alert approvers immediately when a request reaches their authorization tier.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.notifyOnApprovalRequired}
                  onChange={(e) =>
                    setNotifications({ ...notifications, notifyOnApprovalRequired: e.target.checked })
                  }
                  className="w-4 h-4 text-navy-800 dark:text-cyan-500 rounded border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Disbursement Completed Confirmation</h4>
                  <p className="text-xs text-slate-400">Notify requester and vendor contact when UTR payment is recorded.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.notifyOnPaymentProcessed}
                  onChange={(e) =>
                    setNotifications({ ...notifications, notifyOnPaymentProcessed: e.target.checked })
                  }
                  className="w-4 h-4 text-navy-800 dark:text-cyan-500 rounded border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Clarification Discussion Messages</h4>
                  <p className="text-xs text-slate-400">Alert participants when queries or invoice comments are posted.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.notifyOnClarification}
                  onChange={(e) =>
                    setNotifications({ ...notifications, notifyOnClarification: e.target.checked })
                  }
                  className="w-4 h-4 text-navy-800 dark:text-cyan-500 rounded border-slate-300"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-dark-border">
              <Button type="submit" className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950">
                <Save className="w-4 h-4 mr-1.5" />
                Save Notification Policies
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 5: Security Settings */}
      {activeTab === 'security' && (
        <form onSubmit={handleSaveSecurity} className="space-y-6">
          <div className="app-card p-6 space-y-5">
            <div className="border-b border-slate-100 dark:border-dark-border pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-navy-800 dark:text-cyan-400" />
                Enterprise Security & Access Protection
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Session lifetimes, lockout limits, and password hygiene controls.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Session Inactivity Timeout (Minutes)"
                type="number"
                min={5}
                max={480}
                required
                value={security.sessionTimeoutMinutes}
                onChange={(e) =>
                  setSecurity({ ...security, sessionTimeoutMinutes: Number(e.target.value) })
                }
                helperText="Inactive client sessions will be cleanly revoked after this duration."
              />

              <Input
                label="Maximum Failed Login Attempts Before Lockout"
                type="number"
                min={3}
                max={10}
                required
                value={security.maxLockoutAttempts}
                onChange={(e) =>
                  setSecurity({ ...security, maxLockoutAttempts: Number(e.target.value) })
                }
                helperText="Protects user accounts against brute-force credential stuffing attacks."
              />
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Mandate Two-Factor Authentication (2FA)
                  </h4>
                  <p className="text-xs text-slate-400">
                    Require TOTP authenticator app or email verification for all Approvers and Admins.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={security.enforce2FA}
                  onChange={(e) => setSecurity({ ...security, enforce2FA: e.target.checked })}
                  className="w-4 h-4 text-navy-800 dark:text-cyan-500 rounded border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Enforce Complex Characters in Passwords
                  </h4>
                  <p className="text-xs text-slate-400">
                    Passwords must contain at least one uppercase, one number, and one symbol.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={security.requireSpecialChars}
                  onChange={(e) =>
                    setSecurity({ ...security, requireSpecialChars: e.target.checked })
                  }
                  className="w-4 h-4 text-navy-800 dark:text-cyan-500 rounded border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Input
                label="Minimum Password Length"
                type="number"
                min={8}
                max={32}
                value={security.minPasswordLength}
                onChange={(e) =>
                  setSecurity({ ...security, minPasswordLength: Number(e.target.value) })
                }
              />

              <Input
                label="Mandatory Password Rotation (Days)"
                type="number"
                min={30}
                max={365}
                value={security.passwordExpirationDays}
                onChange={(e) =>
                  setSecurity({ ...security, passwordExpirationDays: Number(e.target.value) })
                }
                helperText="Accounts are prompted to cycle credentials upon expiration."
              />
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-dark-border">
              <Button type="submit" className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950">
                <Save className="w-4 h-4 mr-1.5" />
                Save Security Settings
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Modal: Create Approval Rule */}
      <Modal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        title="Create Approval Rule Matrix Entry"
        description="Configure automated escalation tier based on transaction value."
        size="md"
      >
        <form onSubmit={handleSaveCreateRule} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
              Operating Company <span className="text-rose-500">*</span>
            </label>
            <select
              value={ruleFormData.companyId}
              onChange={(e) => setRuleFormData({ ...ruleFormData, companyId: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
            >
              {mockCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            {ruleErrors.companyId && <p className="text-xs text-rose-500 mt-1">{ruleErrors.companyId}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Minimum Amount (₹)"
              type="number"
              min={0}
              required
              value={ruleFormData.minAmount}
              onChange={(e) => setRuleFormData({ ...ruleFormData, minAmount: Number(e.target.value) })}
              error={ruleErrors.minAmount}
            />

            <Input
              label="Maximum Amount (₹)"
              type="number"
              min={0}
              placeholder="Leave blank for unlimited"
              value={ruleFormData.maxAmount}
              onChange={(e) =>
                setRuleFormData({
                  ...ruleFormData,
                  maxAmount: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
              error={ruleErrors.maxAmount}
              helperText="Leave empty if this is the highest uncapped tier."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                Required Approver Role <span className="text-rose-500">*</span>
              </label>
              <select
                value={ruleFormData.approverRole}
                onChange={(e) => setRuleFormData({ ...ruleFormData, approverRole: e.target.value as Role })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
              >
                {[Role.APPROVER, Role.MANAGEMENT, Role.DIRECTOR, Role.ADMIN, Role.SUPER_ADMIN].map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Approval Level Order"
              type="number"
              min={1}
              max={10}
              required
              value={ruleFormData.level}
              onChange={(e) => setRuleFormData({ ...ruleFormData, level: Number(e.target.value) })}
              error={ruleErrors.level}
              helperText="Execution sequence: Level 1 -> Level 2 -> Level 3"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="rule-mandatory"
              checked={ruleFormData.isMandatory}
              onChange={(e) => setRuleFormData({ ...ruleFormData, isMandatory: e.target.checked })}
              className="w-4 h-4 text-navy-800 dark:text-cyan-500 rounded border-slate-300"
            />
            <label htmlFor="rule-mandatory" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Mandatory Gate (Cannot be skipped by delegation)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-dark-border">
            <Button type="button" variant="outline" onClick={() => setIsRuleModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950">
              Create Matrix Entry
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Approval Rule */}
      <Modal
        isOpen={!!editingRule}
        onClose={() => setEditingRule(null)}
        title="Edit Approval Rule Entry"
        description="Modify monetary threshold parameters and designated approval tier."
        size="md"
      >
        {editingRule && (
          <form onSubmit={handleSaveEditRule} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                Operating Company <span className="text-rose-500">*</span>
              </label>
              <select
                value={ruleFormData.companyId}
                onChange={(e) => setRuleFormData({ ...ruleFormData, companyId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
              >
                {mockCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Minimum Amount (₹)"
                type="number"
                min={0}
                required
                value={ruleFormData.minAmount}
                onChange={(e) => setRuleFormData({ ...ruleFormData, minAmount: Number(e.target.value) })}
                error={ruleErrors.minAmount}
              />

              <Input
                label="Maximum Amount (₹)"
                type="number"
                min={0}
                placeholder="Leave blank for unlimited"
                value={ruleFormData.maxAmount}
                onChange={(e) =>
                  setRuleFormData({
                    ...ruleFormData,
                    maxAmount: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                error={ruleErrors.maxAmount}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                  Required Approver Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={ruleFormData.approverRole}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, approverRole: e.target.value as Role })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
                >
                  {[Role.APPROVER, Role.MANAGEMENT, Role.DIRECTOR, Role.ADMIN, Role.SUPER_ADMIN].map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Approval Level Order"
                type="number"
                min={1}
                max={10}
                required
                value={ruleFormData.level}
                onChange={(e) => setRuleFormData({ ...ruleFormData, level: Number(e.target.value) })}
                error={ruleErrors.level}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit-rule-mandatory"
                checked={ruleFormData.isMandatory}
                onChange={(e) => setRuleFormData({ ...ruleFormData, isMandatory: e.target.checked })}
                className="w-4 h-4 text-navy-800 dark:text-cyan-500 rounded border-slate-300"
              />
              <label htmlFor="edit-rule-mandatory" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mandatory Gate (Cannot be skipped by delegation)
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-dark-border">
              <Button type="button" variant="outline" onClick={() => setEditingRule(null)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950">
                Save Rule Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Delete Rule Confirm */}
      {deletingRule && (
        <ConfirmDialog
          isOpen={!!deletingRule}
          onClose={() => setDeletingRule(null)}
          onConfirm={handleConfirmDeleteRule}
          actionType="delete"
          title="Delete Approval Rule"
          message={`Are you sure you want to remove the Level ${deletingRule.level} rule for ${getCompanyName(
            deletingRule.companyId
          )}? Requisitions within this amount bracket will fall back to default group thresholds.`}
          confirmText="Delete Rule"
        />
      )}

      {/* Modal: Send Test Email */}
      <Modal
        isOpen={isTestEmailModalOpen}
        onClose={() => setIsTestEmailModalOpen(false)}
        title="Test SMTP Transport Connectivity"
        description="Dispatch an instant diagnostic test email to verify host relay and firewall traversal."
        size="sm"
      >
        <div className="space-y-4 pt-2">
          <Input
            label="Recipient Test Email"
            type="email"
            required
            placeholder="admin@mvpayments.com"
            value={testEmailAddress}
            onChange={(e) => setTestEmailAddress(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-dark-border">
            <Button
              type="button"
              variant="outline"
              disabled={isSendingTestEmail}
              onClick={() => setIsTestEmailModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSendingTestEmail}
              className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-cyan-500 dark:text-navy-950"
              onClick={handleSendTestEmail}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {isSendingTestEmail ? 'Dispatching...' : 'Send Verification'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;
