import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { VenueStaff, VenueBooking, VenueFinancialTransaction, VenueUpgrade } from "@/types/venue-business";

export function useCompanyVenues(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-venues', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('venues')
        .select(`
          *,
          city:cities(name, country)
        `)
        .eq('company_id', companyId)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useVenueStaff(venueId: string | undefined) {
  return useQuery({
    queryKey: ['venue-staff', venueId],
    queryFn: async () => {
      if (!venueId) return [];
      const { data, error } = await supabase
        .from('venue_staff')
        .select('*')
        .eq('venue_id', venueId)
        .order('role');
      
      if (error) throw error;
      return data as VenueStaff[];
    },
    enabled: !!venueId,
  });
}

export function useHireVenueStaff() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (staff: {
      venue_id: string;
      name: string;
      role: string;
      skill_level?: number;
      salary_weekly?: number;
    }) => {
      const { data, error } = await supabase
        .from('venue_staff')
        .insert(staff)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['venue-staff', variables.venue_id] });
      toast.success("Staff hired successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to hire staff: ${error.message}`);
    },
  });
}

export function useFireVenueStaff() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ staffId, venueId }: { staffId: string; venueId: string }) => {
      const { error } = await supabase
        .from('venue_staff')
        .delete()
        .eq('id', staffId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['venue-staff', variables.venueId] });
      toast.success("Staff member released");
    },
    onError: (error) => {
      toast.error(`Failed to release staff: ${error.message}`);
    },
  });
}

export function useVenueBookings(venueId: string | undefined) {
  return useQuery({
    queryKey: ['venue-bookings', venueId],
    queryFn: async () => {
      if (!venueId) return [];
      const { data, error } = await supabase
        .from('venue_bookings')
        .select(`
          *,
          band:bands(name)
        `)
        .eq('venue_id', venueId)
        .order('booking_date', { ascending: false });
      
      if (error) throw error;
      return data as VenueBooking[];
    },
    enabled: !!venueId,
  });
}

export function useCreateVenueBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (booking: {
      venue_id: string;
      booking_type: string;
      booking_date: string;
      start_time?: string;
      end_time?: string;
      rental_fee?: number;
      band_id?: string | null;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('venue_bookings')
        .insert(booking)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['venue-bookings', variables.venue_id] });
      toast.success("Booking created!");
    },
    onError: (error) => {
      toast.error(`Failed to create booking: ${error.message}`);
    },
  });
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ bookingId, status, venueId }: { bookingId: string; status: string; venueId: string }) => {
      const { data, error } = await supabase
        .from('venue_bookings')
        .update({ status })
        .eq('id', bookingId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['venue-bookings', variables.venueId] });
      toast.success("Booking status updated!");
    },
    onError: (error) => {
      toast.error(`Failed to update booking: ${error.message}`);
    },
  });
}

export function useVenueFinancials(venueId: string | undefined) {
  return useQuery({
    queryKey: ['venue-financials', venueId],
    queryFn: async () => {
      if (!venueId) return [];
      const { data, error } = await supabase
        .from('venue_financial_transactions')
        .select('*')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as VenueFinancialTransaction[];
    },
    enabled: !!venueId,
  });
}

export function useVenueUpgrades(venueId: string | undefined) {
  return useQuery({
    queryKey: ['venue-upgrades', venueId],
    queryFn: async () => {
      if (!venueId) return [];
      const { data, error } = await supabase
        .from('venue_upgrades')
        .select('*')
        .eq('venue_id', venueId)
        .order('installed_at', { ascending: false });
      
      if (error) throw error;
      return data as VenueUpgrade[];
    },
    enabled: !!venueId,
  });
}

export function useInstallVenueUpgrade() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (upgrade: {
      venue_id: string;
      upgrade_type: string;
      upgrade_level: number;
      cost: number;
      description?: string;
    }) => {
      const { data, error } = await supabase
        .from('venue_upgrades')
        .insert(upgrade)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['venue-upgrades', variables.venue_id] });
      toast.success("Upgrade installed!");
    },
    onError: (error) => {
      toast.error(`Failed to install upgrade: ${error.message}`);
    },
  });
}

export function useTransferVenueToCompany() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ venueId, companyId }: { venueId: string; companyId: string }) => {
      const { data, error } = await supabase
        .from('venues')
        .update({ 
          company_id: companyId,
          is_company_owned: true 
        })
        .eq('id', venueId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      queryClient.invalidateQueries({ queryKey: ['company-venues'] });
      toast.success("Venue transferred to company!");
    },
    onError: (error) => {
      toast.error(`Failed to transfer venue: ${error.message}`);
    },
  });
}
