import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { 
  MerchFactory, 
  MerchProductCatalog, 
  MerchProductionQueue, 
  MerchFactoryWorker,
  MerchFactoryContract 
} from "@/types/merch-factory";

export function useMerchFactories(companyId: string | undefined) {
  return useQuery({
    queryKey: ['merch-factories', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('merch_factories')
        .select(`
          *,
          city:cities(name, country)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as MerchFactory[];
    },
    enabled: !!companyId,
  });
}

export function useMerchFactory(factoryId: string | undefined) {
  return useQuery({
    queryKey: ['merch-factory', factoryId],
    queryFn: async () => {
      if (!factoryId) return null;
      const { data, error } = await supabase
        .from('merch_factories')
        .select(`
          *,
          city:cities(name, country)
        `)
        .eq('id', factoryId)
        .single();
      
      if (error) throw error;
      return data as MerchFactory;
    },
    enabled: !!factoryId,
  });
}

export function useCreateMerchFactory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (factory: {
      company_id: string;
      name: string;
      factory_type: string;
      city_id?: string | null;
      quality_level?: number;
      production_capacity?: number;
      worker_count?: number;
      operating_costs_daily?: number;
    }) => {
      const { data, error } = await supabase
        .from('merch_factories')
        .insert(factory)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['merch-factories', variables.company_id] });
      toast.success("Factory created successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to create factory: ${error.message}`);
    },
  });
}

export function useProductCatalog(factoryId: string | undefined) {
  return useQuery({
    queryKey: ['merch-product-catalog', factoryId],
    queryFn: async () => {
      if (!factoryId) return [];
      const { data, error } = await supabase
        .from('merch_product_catalog')
        .select('*')
        .eq('factory_id', factoryId)
        .order('product_type');
      
      if (error) throw error;
      return data as MerchProductCatalog[];
    },
    enabled: !!factoryId,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (product: {
      factory_id: string;
      product_name: string;
      product_type: string;
      base_cost: number;
      suggested_price: number;
      production_time_hours?: number;
      min_order_quantity?: number;
    }) => {
      const { data, error } = await supabase
        .from('merch_product_catalog')
        .insert(product)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['merch-product-catalog', variables.factory_id] });
      toast.success("Product added to catalog!");
    },
    onError: (error) => {
      toast.error(`Failed to add product: ${error.message}`);
    },
  });
}

export function useProductionQueue(factoryId: string | undefined) {
  return useQuery({
    queryKey: ['merch-production-queue', factoryId],
    queryFn: async () => {
      if (!factoryId) return [];
      const { data, error } = await supabase
        .from('merch_production_queue')
        .select(`
          *,
          product:merch_product_catalog(*),
          client_band:bands(name)
        `)
        .eq('factory_id', factoryId)
        .order('priority', { ascending: false })
        .order('created_at');
      
      if (error) throw error;
      return data as MerchProductionQueue[];
    },
    enabled: !!factoryId,
  });
}

export function useCreateProductionOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (order: {
      factory_id: string;
      product_catalog_id: string;
      quantity: number;
      unit_cost: number;
      total_cost: number;
      client_band_id?: string | null;
      client_label_id?: string | null;
      priority?: number;
    }) => {
      const { data, error } = await supabase
        .from('merch_production_queue')
        .insert(order)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['merch-production-queue', variables.factory_id] });
      toast.success("Production order created!");
    },
    onError: (error) => {
      toast.error(`Failed to create order: ${error.message}`);
    },
  });
}

export function useUpdateProductionStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ orderId, status, factoryId }: { orderId: string; status: string; factoryId: string }) => {
      const updates: Record<string, unknown> = { status };
      
      if (status === 'in_production') {
        updates.started_at = new Date().toISOString();
      } else if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      } else if (status === 'shipped') {
        updates.shipped_at = new Date().toISOString();
      }
      
      const { data, error } = await supabase
        .from('merch_production_queue')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['merch-production-queue', variables.factoryId] });
      toast.success("Order status updated!");
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });
}

export function useFactoryWorkers(factoryId: string | undefined) {
  return useQuery({
    queryKey: ['merch-factory-workers', factoryId],
    queryFn: async () => {
      if (!factoryId) return [];
      const { data, error } = await supabase
        .from('merch_factory_workers')
        .select('*')
        .eq('factory_id', factoryId)
        .order('role')
        .order('skill_level', { ascending: false });
      
      if (error) throw error;
      return data as MerchFactoryWorker[];
    },
    enabled: !!factoryId,
  });
}

export function useHireWorker() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (worker: {
      factory_id: string;
      name: string;
      role: string;
      skill_level?: number;
      salary_weekly?: number;
    }) => {
      const { data, error } = await supabase
        .from('merch_factory_workers')
        .insert(worker)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['merch-factory-workers', variables.factory_id] });
      toast.success("Worker hired successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to hire worker: ${error.message}`);
    },
  });
}

export function useFactoryContracts(factoryId: string | undefined) {
  return useQuery({
    queryKey: ['merch-factory-contracts', factoryId],
    queryFn: async () => {
      if (!factoryId) return [];
      const { data, error } = await supabase
        .from('merch_factory_contracts')
        .select(`
          *,
          client_band:bands(name)
        `)
        .eq('factory_id', factoryId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as MerchFactoryContract[];
    },
    enabled: !!factoryId,
  });
}
