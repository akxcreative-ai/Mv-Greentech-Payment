import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { userService } from '@/services/userService';
import {
  User,
  UserFilters,
  PaginationParams,
  CreateUserInput,
  UpdateUserInput,
} from '@/types';

export const USERS_KEY = ['users'];
export const USER_DETAIL_KEY = (id: string) => ['user', id];
export const APPROVERS_KEY = (departmentId?: string, amount?: number) => [
  'users',
  'approvers',
  departmentId,
  amount,
];

/**
 * Hook to fetch paginated users list with search and filters
 */
export const useUsers = (filters?: UserFilters, pagination?: PaginationParams) => {
  return useQuery({
    queryKey: [...USERS_KEY, filters, pagination],
    queryFn: () => userService.getUsers(filters, pagination),
    staleTime: 1000 * 60 * 3,
  });
};

/**
 * Hook to fetch single user by ID
 */
export const useUser = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: USER_DETAIL_KEY(id),
    queryFn: () => userService.getUser(id),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
};

/**
 * Hook to create a new user
 */
export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserInput) => userService.createUser(data),
    onSuccess: (newUser: User) => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      toast.success(`User ${newUser.fullName} created successfully!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create user');
    },
  });
};

/**
 * Hook to update an existing user
 */
export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      userService.updateUser(id, data),
    onSuccess: (updatedUser: User) => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      queryClient.invalidateQueries({ queryKey: USER_DETAIL_KEY(updatedUser.id) });
      toast.success('User updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update user');
    },
  });
};

/**
 * Hook to delete user
 */
export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => userService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      toast.success('User deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete user');
    },
  });
};

/**
 * Hook to update user active / inactive status
 */
export const useUpdateUserStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      userService.toggleUserStatus(id, isActive),
    onSuccess: (updatedUser: User) => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      queryClient.invalidateQueries({ queryKey: USER_DETAIL_KEY(updatedUser.id) });
      toast.success(`User status changed to ${updatedUser.isActive ? 'Active' : 'Suspended'}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to change user status');
    },
  });
};

/**
 * Hook to fetch approvers for dynamic assignment
 */
export const useApprovers = (departmentId?: string, amount?: number) => {
  return useQuery({
    queryKey: APPROVERS_KEY(departmentId, amount),
    queryFn: () => userService.getApprovers(departmentId, amount),
    staleTime: 1000 * 60 * 5,
  });
};
