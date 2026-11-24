import { api } from './api';
import {
  SystemSettings,
  ApprovalRule,
  CreateApprovalRuleInput,
  UpdateApprovalRuleInput,
  ApiResponse,
} from '@/types';

export const settingsService = {
  /**
   * Fetch global application configuration and financial threshold policies
   */
  async getSettings(): Promise<SystemSettings> {
    const response = await api.get<ApiResponse<SystemSettings> | SystemSettings>('/settings');

    if ('data' in response.data && response.data.data) {
      return response.data.data;
    }
    return response.data as SystemSettings;
  },

  /**
   * Update global system parameters and notifications policies
   */
  async updateSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
    const response = await api.put<ApiResponse<SystemSettings> | SystemSettings>('/settings', data);

    if ('data' in response.data && response.data.data) {
      return response.data.data;
    }
    return response.data as SystemSettings;
  },

  /**
   * Fetch multi-tier approval rules by company ID
   */
  async getApprovalRules(companyId?: string): Promise<ApprovalRule[]> {
    const response = await api.get<ApiResponse<ApprovalRule[]> | ApprovalRule[]>('/settings/approval-rules', {
      params: { companyId },
    });

    if ('data' in response.data && response.data.data) {
      return response.data.data;
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  },

  /**
   * Create an approval rule matrix tier (amount threshold, required role, level)
   */
  async createApprovalRule(data: CreateApprovalRuleInput): Promise<ApprovalRule> {
    const response = await api.post<ApiResponse<ApprovalRule> | ApprovalRule>(
      '/settings/approval-rules',
      data
    );

    if ('data' in response.data && response.data.data) {
      return response.data.data;
    }
    return response.data as ApprovalRule;
  },

  /**
   * Update an existing approval rule tier
   */
  async updateApprovalRule(id: string, data: UpdateApprovalRuleInput): Promise<ApprovalRule> {
    const response = await api.put<ApiResponse<ApprovalRule> | ApprovalRule>(
      `/settings/approval-rules/${id}`,
      data
    );

    if ('data' in response.data && response.data.data) {
      return response.data.data;
    }
    return response.data as ApprovalRule;
  },

  /**
   * Remove an approval rule tier
   */
  async deleteApprovalRule(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<ApiResponse<{ message: string }> | { message: string }>(
      `/settings/approval-rules/${id}`
    );

    const message =
      'data' in response.data && response.data.data?.message
        ? response.data.data.message
        : (response.data as { message: string }).message || 'Approval rule deleted';

    return { success: true, message };
  },
};

export default settingsService;
