import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { companyService } from '@/services/companyService';
import {
  Company,
  CompanyFilters,
  PaginationParams,
  CreateCompanyInput,
  UpdateCompanyInput,
} from '@/types';

export const COMPANIES_KEY = ['companies'];
export const ALL_COMPANIES_KEY = ['companies', 'all'];
export const COMPANY_DETAIL_KEY = (id: string) => ['company', id];

/**
 * Hook to fetch paginated companies list
 */
export const useCompanies = (filters?: CompanyFilters, pagination?: PaginationParams) => {
  return useQuery({
    queryKey: [...COMPANIES_KEY, filters, pagination],
    queryFn: () => companyService.getCompanies(filters, pagination),
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to fetch unpaginated list of companies for selection inputs
 */
export const useAllCompanies = () => {
  return useQuery({
    queryKey: ALL_COMPANIES_KEY,
    queryFn: () => companyService.getAllCompanies(),
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to fetch single company details
 */
export const useCompany = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: COMPANY_DETAIL_KEY(id),
    queryFn: () => companyService.getCompany(id),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
};

/**
 * Hook to create a new corporate entity
 */
export const useCreateCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCompanyInput) => companyService.createCompany(data),
    onSuccess: (newCompany: Company) => {
      queryClient.invalidateQueries({ queryKey: COMPANIES_KEY });
      queryClient.invalidateQueries({ queryKey: ALL_COMPANIES_KEY });
      toast.success(`Company ${newCompany.name} created successfully!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create company');
    },
  });
};

/**
 * Hook to update an existing company
 */
export const useUpdateCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCompanyInput }) =>
      companyService.updateCompany(id, data),
    onSuccess: (updatedCompany: Company) => {
      queryClient.invalidateQueries({ queryKey: COMPANIES_KEY });
      queryClient.invalidateQueries({ queryKey: ALL_COMPANIES_KEY });
      queryClient.invalidateQueries({ queryKey: COMPANY_DETAIL_KEY(updatedCompany.id) });
      toast.success('Company updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update company');
    },
  });
};

/**
 * Hook to delete a company
 */
export const useDeleteCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => companyService.deleteCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMPANIES_KEY });
      queryClient.invalidateQueries({ queryKey: ALL_COMPANIES_KEY });
      toast.success('Company deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete company');
    },
  });
};
