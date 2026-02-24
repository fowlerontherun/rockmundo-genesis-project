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
      
      const { data, error } = await supabase
        .from('rehearsal_room_transactions')
        .select('*')
        .eq('room_id', roomId)
        .order('transaction_date', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as RehearsalRoomTransaction[];
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
    mutationFn: async (staff: Omit<RehearsalRoomStaff, 'id' | 'created_at' | 'updated_at' | 'hire_date' | 'performance_rating' | 'is_active'>) => {
      const companyId = await getCompanyIdFromRehearsalRoom(staff.room_id);
      const hiringCost = staff.salary || 1000;

      await deductCompanyBalance({
        companyId,
        amount: hiringCost,
        description: `Hired rehearsal staff: ${staff.name}`,
        category: "staff",
      });

      const { data, error } = await supabase
        .from('rehearsal_room_staff')
        .insert({
          room_id: staff.room_id,
          name: staff.name,
          role: staff.role,
          skill_level: staff.skill_level,
          salary: staff.salary,
        })
        .select()
        .single();

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
    mutationFn: async (equipment: Omit<RehearsalRoomEquipment, 'id' | 'created_at' | 'updated_at' | 'condition' | 'is_available'>) => {
      const companyId = await getCompanyIdFromRehearsalRoom(equipment.room_id);
      const cost = equipment.hourly_rate ? equipment.hourly_rate * 100 : 5000;

      if (cost > 0) {
        await deductCompanyBalance({
          companyId,
          amount: cost,
          description: `Rehearsal equipment: ${equipment.equipment_name}`,
          category: "equipment",
        });
      }

      const { data, error } = await supabase
        .from('rehearsal_room_equipment')
        .insert(equipment)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rehearsal-room-equipment', data.room_id] });
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
    mutationFn: async (upgrade: Omit<RehearsalRoomUpgrade, 'id' | 'created_at' | 'installed_at'>) => {
      const companyId = await getCompanyIdFromRehearsalRoom(upgrade.room_id);
      const cost = upgrade.cost || 0;

      if (cost > 0) {
        await deductCompanyBalance({
          companyId,
          amount: cost,
          description: `Rehearsal upgrade: ${upgrade.name} Lv${upgrade.level}`,
          category: "upgrade",
        });
      }

      const { data, error } = await supabase
        .from('rehearsal_room_upgrades')
        .insert(upgrade)
        .select()
        .single();

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
