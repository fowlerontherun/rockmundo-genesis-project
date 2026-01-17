import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
      
      const { data, error } = await supabase
        .from('rehearsal_rooms')
        .select(`
          *,
          cities:city_id(name, country),
          city_districts:district_id(name),
          companies:company_id(name)
        `)
        .eq('id', studioId)
        .single();
      
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
      toast({ title: "Staff Hired", description: `${data.name} has been hired successfully.` });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to hire staff member.", variant: "destructive" });
      console.error(error);
    },
  });
}

export function useAddRehearsalEquipment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (equipment: Omit<RehearsalRoomEquipment, 'id' | 'created_at' | 'updated_at' | 'condition' | 'is_available'>) => {
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
      toast({ title: "Equipment Added", description: `${data.equipment_name} has been added to inventory.` });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to add equipment.", variant: "destructive" });
      console.error(error);
    },
  });
}

export function useInstallRehearsalUpgrade() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (upgrade: Omit<RehearsalRoomUpgrade, 'id' | 'created_at' | 'installed_at'>) => {
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
      toast({ title: "Upgrade Installed", description: `${data.name} has been installed.` });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to install upgrade.", variant: "destructive" });
      console.error(error);
    },
  });
}
