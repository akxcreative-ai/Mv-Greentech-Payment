import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { vendorService } from '@/services/vendorService';
import {
  Vendor,
  VendorFilters,
  PaginationParams,
  CreateVendorInput,
  UpdateVendorInput,
} from '@/types';

export const VENDORS_KEY = ['vendors'];
export const ALL_VENDORS_KEY = ['vendors', 'all'];
export const VENDOR_DETAIL_KEY = (id: string) => ['vendor', id];

/**
 * Hook to fetch paginated vendors list with filtering
 */
export const useVendors = (filters?: VendorFilters, pagination?: PaginationParams) => {
  return useQuery({
    queryKey: [...VENDORS_KEY, filters, pagination],
    queryFn: () => vendorService.getVendors(filters, pagination),
    staleTime: 1000 * 60 * 3,
  });
};

/**
 * Hook to fetch unpaginated list of vendors for dropdown selects
 */
export const useAllVendors = () => {
  return useQuery({
    queryKey: ALL_VENDORS_KEY,
    queryFn: () => vendorService.getAllVendors(),
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to fetch individual vendor details
 */
export const useVendor = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: VENDOR_DETAIL_KEY(id),
    queryFn: () => vendorService.getVendor(id),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
};

/**
 * Hook to onboard a new vendor
 */
export const useCreateVendor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVendorInput) => vendorService.createVendor(data),
    onSuccess: (newVendor: Vendor) => {
      queryClient.invalidateQueries({ queryKey: VENDORS_KEY });
      queryClient.invalidateQueries({ queryKey: ALL_VENDORS_KEY });
      toast.success(`Vendor ${newVendor.name} added successfully!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create vendor');
    },
  });
};

/**
 * Hook to update existing vendor details
 */
export const useUpdateVendor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVendorInput }) =>
      vendorService.updateVendor(id, data),
    onSuccess: (updatedVendor: Vendor) => {
      queryClient.invalidateQueries({ queryKey: VENDORS_KEY });
      queryClient.invalidateQueries({ queryKey: ALL_VENDORS_KEY });
      queryClient.invalidateQueries({ queryKey: VENDOR_DETAIL_KEY(updatedVendor.id) });
      toast.success('Vendor updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update vendor');
    },
  });
};

/**
 * Hook to delete a vendor
 */
export const useDeleteVendor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => vendorService.deleteVendor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VENDORS_KEY });
      queryClient.invalidateQueries({ queryKey: ALL_VENDORS_KEY });
      toast.success('Vendor deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete vendor');
    },
  });
};
