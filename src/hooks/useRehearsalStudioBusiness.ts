import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { deductCompanyBalance, getCompanyIdFromRehearsalRoom, COMPANY_BALANCE_QUERY_KEYS } from "./useCompanyBalanceDeduction";
import type { 
  RehearsalStudioBusiness, 
  RehearsalRoomStaff, 
  RehearsalRoomTransaction, 
  RehearsalRoomUpgrade,
  RehearsalRoomEquipment
} from "@/types/rehearsal-studio-business";

export function useCompanyRehearsalStudios(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-rehearsal-studios', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('rehearsal_rooms')
        .select(`
          *,
          cities:city_id(name, country),
          city_districts:district_id(name),
          companies:company_id(name)
        `)
        .eq('company_id', companyId)
        .order('name');
      
      if (error) throw error;
      return data as RehearsalStudioBusiness[];
    },
    enabled: !!companyId,
  });
}

export function useRehearsalStudio(studioId: string | undefined) {
  return useQuery({
    queryKey: ['rehearsal-studio', studioId],
    queryFn: async () => {
      if (!studioId) return null;
      
      // Dual lookup pattern: try by id OR company_id for subsidiary navigation
      const { data, error } = await supabase
        .from('rehearsal_rooms')
        .select(`
          *,
          cities:city_id(name, country),
          city_districts:district_id(name),
          companies:company_id(name)
        `)
        .or(`id.eq.${studioId},company_id.eq.${studioId}`)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as RehearsalStudioBusiness;
    },
    enabled: !!studioId,
  });
}

export function useRehearsalRoomStaff(roomId: string | undefined) {
  return useQuery({
    queryKey: ['rehearsal-room-staff', roomId],
    queryFn: async () => {
      if (!roomId) return [];
      
      const { data, error } = await supabase
        .from('rehearsal_room_staff')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .order('role');
      
      if (error) throw error;
      return data as RehearsalRoomStaff[];
    },
    enabled: !!roomId,
  });
}

export function useRehearsalRoomTransactions(roomId: string | undefined) {
  return useQuery({
    queryKey: ['rehearsal-room-transactions', roomId],
    queryFn: async () => {
      if (!roomId) return [];
      
      const all: RehearsalRoomTransaction[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase
          .from('rehearsal_room_transactions').select('*')
          .eq('room_id', roomId).order('transaction_date', { ascending: false })
          .range(offset, offset + 499);
        if (error) throw error;
        all.push(...((data ?? []) as RehearsalRoomTransaction[]));
        if (!data || data.length < 500) break;
      }
      return all;
    },
    enabled: !!roomId,
  });
}

export function useRehearsalRoomUpgrades(roomId: string | undefined) {
  return useQuery({
    queryKey: ['rehearsal-room-upgrades', roomId],
    queryFn: async () => {
      if (!roomId) return [];
      
      const { data, error } = await supabase
        .from('rehearsal_room_upgrades')
        .select('*')
        .eq('room_id', roomId)
        .order('installed_at', { ascending: false });
      
      if (error) throw error;
      return data as RehearsalRoomUpgrade[];
    },
    enabled: !!roomId,
  });
}

export function useRehearsalRoomEquipment(roomId: string | undefined) {
  return useQuery({
    queryKey: ['rehearsal-room-equipment', roomId],
    queryFn: async () => {
      if (!roomId) return [];
      
      const { data, error } = await supabase
        .from('rehearsal_room_equipment')
        .select('*')
        .eq('room_id', roomId)
        .order('equipment_type');
      
      if (error) throw error;
      return data as RehearsalRoomEquipment[];
    },
    enabled: !!roomId,
  });
}

export function useHireRehearsalStaff() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (staff: Omit<RehearsalRoomStaff, 'id' | 'created_at' | 'updated_at' | 'hire_date' | 'performance_rating' | 'is_active'> & { request_id: string }) => {
      const { data, error } = await (supabase as any).rpc("buy_subsidiary_asset_atomic", {
        p_kind: "rehearsal_staff", p_subsidiary_id: staff.room_id, p_fields: staff,
      });
      if (error) throw error;
            return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rehearsal-room-staff', data.room_id] });
      COMPANY_BALANCE_QUERY_KEYS.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
      toast({ title: "Staff Hired", description: `${data.name} has been hired successfully.` });
    },
    onError: (error) => {
      toast({ title: "Error", description: `Failed to hire staff: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
      console.error(error);
    },
  });
}

export function useAddRehearsalEquipment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (equipment: { room_id: string; catalog_id: string; request_id: string }) => {
      const { data, error } = await (supabase as any).rpc("buy_subsidiary_asset_atomic", {
        p_kind: "rehearsal_equipment", p_subsidiary_id: equipment.room_id, p_fields: equipment,
      });
      if (error) throw error;
            return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rehearsal-room-equipment', data.room_id] });
      queryClient.invalidateQueries({ queryKey: ['subsidiary-equipment-catalog', 'rehearsal_equipment'] });
      COMPANY_BALANCE_QUERY_KEYS.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
      toast({ title: "Equipment Added", description: `${data.equipment_name} has been added to inventory.` });
    },
    onError: (error) => {
      toast({ title: "Error", description: `Failed to add equipment: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
      console.error(error);
    },
  });
}

export function useInstallRehearsalUpgrade() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (upgrade: Omit<RehearsalRoomUpgrade, 'id' | 'created_at' | 'installed_at'> & { request_id: string }) => {
      const { data, error } = await (supabase as any).rpc("buy_subsidiary_asset_atomic", {
        p_kind: "rehearsal_upgrade", p_subsidiary_id: upgrade.room_id, p_fields: upgrade,
      });
      if (error) throw error;
            return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rehearsal-room-upgrades', data.room_id] });
      COMPANY_BALANCE_QUERY_KEYS.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
      toast({ title: "Upgrade Installed", description: `${data.name} has been installed.` });
    },
    onError: (error) => {
      toast({ title: "Error", description: `Failed to install upgrade: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
      console.error(error);
    },
  });
}
