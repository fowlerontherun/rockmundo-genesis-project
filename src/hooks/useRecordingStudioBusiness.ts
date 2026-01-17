import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { 
  RecordingStudioBusiness, 
  RecordingStudioStaff, 
  RecordingStudioTransaction, 
  RecordingStudioUpgrade,
  RecordingStudioEquipment
} from "@/types/recording-studio-business";

export function useCompanyRecordingStudios(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-recording-studios', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('city_studios')
        .select(`
          *,
          cities:city_id(name, country),
          city_districts:district_id(name),
          companies:company_id(name)
        `)
        .eq('company_id', companyId)
        .order('name');
      
      if (error) throw error;
      return data as RecordingStudioBusiness[];
    },
    enabled: !!companyId,
  });
}

export function useRecordingStudioBusiness(studioId: string | undefined) {
  return useQuery({
    queryKey: ['recording-studio-business', studioId],
    queryFn: async () => {
      if (!studioId) return null;
      
      const { data, error } = await supabase
        .from('city_studios')
        .select(`
          *,
          cities:city_id(name, country),
          city_districts:district_id(name),
          companies:company_id(name)
        `)
        .eq('id', studioId)
        .single();
      
      if (error) throw error;
      return data as RecordingStudioBusiness;
    },
    enabled: !!studioId,
  });
}

export function useRecordingStudioStaff(studioId: string | undefined) {
  return useQuery({
    queryKey: ['recording-studio-staff', studioId],
    queryFn: async () => {
      if (!studioId) return [];
      
      const { data, error } = await supabase
        .from('recording_studio_staff')
        .select('*')
        .eq('studio_id', studioId)
        .eq('is_active', true)
        .order('role');
      
      if (error) throw error;
      return data as RecordingStudioStaff[];
    },
    enabled: !!studioId,
  });
}

export function useRecordingStudioTransactions(studioId: string | undefined) {
  return useQuery({
    queryKey: ['recording-studio-transactions', studioId],
    queryFn: async () => {
      if (!studioId) return [];
      
      const { data, error } = await supabase
        .from('recording_studio_transactions')
        .select('*')
        .eq('studio_id', studioId)
        .order('transaction_date', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as RecordingStudioTransaction[];
    },
    enabled: !!studioId,
  });
}

export function useRecordingStudioUpgrades(studioId: string | undefined) {
  return useQuery({
    queryKey: ['recording-studio-upgrades', studioId],
    queryFn: async () => {
      if (!studioId) return [];
      
      const { data, error } = await supabase
        .from('recording_studio_upgrades')
        .select('*')
        .eq('studio_id', studioId)
        .order('installed_at', { ascending: false });
      
      if (error) throw error;
      return data as RecordingStudioUpgrade[];
    },
    enabled: !!studioId,
  });
}

export function useRecordingStudioEquipment(studioId: string | undefined) {
  return useQuery({
    queryKey: ['recording-studio-equipment', studioId],
    queryFn: async () => {
      if (!studioId) return [];
      
      const { data, error } = await supabase
        .from('recording_studio_equipment')
        .select('*')
        .eq('studio_id', studioId)
        .order('equipment_type');
      
      if (error) throw error;
      return data as RecordingStudioEquipment[];
    },
    enabled: !!studioId,
  });
}

export function useHireRecordingStudioStaff() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (staff: Omit<RecordingStudioStaff, 'id' | 'created_at' | 'updated_at' | 'hire_date' | 'albums_worked' | 'hit_songs' | 'is_active'>) => {
      const { data, error } = await supabase
        .from('recording_studio_staff')
        .insert({
          studio_id: staff.studio_id,
          name: staff.name,
          role: staff.role,
          skill_level: staff.skill_level,
          specialty: staff.specialty,
          salary: staff.salary,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recording-studio-staff', data.studio_id] });
      toast({ title: "Staff Hired", description: `${data.name} has been hired successfully.` });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to hire staff member.", variant: "destructive" });
      console.error(error);
    },
  });
}

export function useAddRecordingStudioEquipment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (equipment: Omit<RecordingStudioEquipment, 'id' | 'created_at' | 'updated_at' | 'condition' | 'is_available'>) => {
      const { data, error } = await supabase
        .from('recording_studio_equipment')
        .insert(equipment)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recording-studio-equipment', data.studio_id] });
      toast({ title: "Equipment Added", description: `${data.equipment_name} has been added to inventory.` });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to add equipment.", variant: "destructive" });
      console.error(error);
    },
  });
}

export function useInstallRecordingStudioUpgrade() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (upgrade: Omit<RecordingStudioUpgrade, 'id' | 'created_at' | 'installed_at'>) => {
      const { data, error } = await supabase
        .from('recording_studio_upgrades')
        .insert(upgrade)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recording-studio-upgrades', data.studio_id] });
      toast({ title: "Upgrade Installed", description: `${data.name} has been installed.` });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to install upgrade.", variant: "destructive" });
      console.error(error);
    },
  });
}
