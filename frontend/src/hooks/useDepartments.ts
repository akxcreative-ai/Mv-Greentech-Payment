import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { departmentService } from '@/services/departmentService';
import {
  Department,
  DepartmentFilters,
  PaginationParams,
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from '@/types';

export const DEPARTMENTS_KEY = ['departments'];
export const DEPARTMENT_DETAIL_KEY = (id: string) => ['department', id];
export const DEPARTMENTS_BY_COMPANY_KEY = (companyId: string) => [
  'departments',
  'by-company',
  companyId,
];

/**
 * Hook to fetch paginated departments list
 */
export const useDepartments = (
  filters?: DepartmentFilters,
  pagination?: PaginationParams
) => {
  return useQuery({
    queryKey: [...DEPARTMENTS_KEY, filters, pagination],
    queryFn: () => departmentService.getDepartments(filters, pagination),
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to fetch all departments belonging to a specific company
 */
export const useDepartmentsByCompany = (companyId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: DEPARTMENTS_BY_COMPANY_KEY(companyId),
    queryFn: () => departmentService.getDepartmentsByCompany(companyId),
    enabled: Boolean(companyId) && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to fetch single department by ID
 */
export const useDepartment = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: DEPARTMENT_DETAIL_KEY(id),
    queryFn: () => departmentService.getDepartment(id),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
};

/**
 * Hook to create a new department
 */
export const useCreateDepartment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDepartmentInput) => departmentService.createDepartment(data),
    onSuccess: (newDept: Department) => {
      queryClient.invalidateQueries({ queryKey: DEPARTMENTS_KEY });
      queryClient.invalidateQueries({
        queryKey: DEPARTMENTS_BY_COMPANY_KEY(newDept.companyId),
      });
      toast.success(`Department ${newDept.name} created successfully!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create department');
    },
  });
};

/**
 * Hook to update an existing department
 */
export const useUpdateDepartment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDepartmentInput }) =>
      departmentService.updateDepartment(id, data),
    onSuccess: (updatedDept: Department) => {
      queryClient.invalidateQueries({ queryKey: DEPARTMENTS_KEY });
      queryClient.invalidateQueries({
        queryKey: DEPARTMENT_DETAIL_KEY(updatedDept.id),
      });
      if (updatedDept.companyId) {
        queryClient.invalidateQueries({
          queryKey: DEPARTMENTS_BY_COMPANY_KEY(updatedDept.companyId),
        });
      }
      toast.success('Department updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update department');
    },
  });
};

/**
 * Hook to delete a department
 */
export const useDeleteDepartment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => departmentService.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEPARTMENTS_KEY });
      toast.success('Department deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete department');
    },
  });
};
