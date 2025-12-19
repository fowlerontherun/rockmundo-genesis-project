import { supabase } from "@/integrations/supabase/client";

export interface SponsorshipBrand {
  id: string;
  name: string;
  category: string;
  region: string;
  size: string;
  wealth_tier: number;
  min_fame_required: number;
  is_active: boolean;
  logo_url: string | null;
}

export interface SponsorshipOffer {
  id: string;
  brand_id: string;
  band_id: string;
  total_value: number;
  term_weeks: number;
  exclusivity: boolean;
  fit_score: number;
  status: string;
  notes: string | null;
  expires_at: string;
  created_at: string;
  brand?: SponsorshipBrand;
}

export interface SponsorshipContract {
  id: string;
  offer_id: string;
  brand_id: string;
  band_id: string;
  total_value: number;
  weekly_payment: number;
  term_weeks: number;
  weeks_paid: number;
  total_paid: number;
  exclusivity: boolean;
  status: string;
  health: number;
  deliverables: string[];
  start_date: string;
  end_date: string;
  last_payment_at: string | null;
  created_at: string;
  brand?: SponsorshipBrand;
}

export interface SponsorshipPayment {
  id: string;
  contract_id: string;
  band_id: string;
  amount: number;
  week_number: number;
  status: string;
  scheduled_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export async function fetchSponsorshipBrands(): Promise<SponsorshipBrand[]> {
  const { data, error } = await supabase
    .from('sponsorship_brands')
    .select('*')
    .eq('is_active', true)
    .order('wealth_tier', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function fetchSponsorshipOffers(bandId: string): Promise<SponsorshipOffer[]> {
  const { data, error } = await supabase
    .from('sponsorship_offers')
    .select(`
      *,
      brand:sponsorship_brands(*)
    `)
    .eq('band_id', bandId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function fetchSponsorshipContracts(bandId: string): Promise<SponsorshipContract[]> {
  const { data, error } = await supabase
    .from('sponsorship_contracts')
    .select(`
      *,
      brand:sponsorship_brands(*)
    `)
    .eq('band_id', bandId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function fetchContractPayments(contractId: string): Promise<SponsorshipPayment[]> {
  const { data, error } = await supabase
    .from('sponsorship_payments')
    .select('*')
    .eq('contract_id', contractId)
    .order('week_number', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function acceptOffer(offerId: string): Promise<SponsorshipContract> {
  // Get the offer
  const { data: offer, error: offerError } = await supabase
    .from('sponsorship_offers')
    .select('*')
    .eq('id', offerId)
    .single();
  
  if (offerError || !offer) throw offerError || new Error('Offer not found');
  
  // Calculate weekly payment
  const weeklyPayment = Math.floor(offer.total_value / offer.term_weeks);
  
  // Calculate dates
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + (offer.term_weeks * 7));
  
  // Create the contract
  const { data: contract, error: contractError } = await supabase
    .from('sponsorship_contracts')
    .insert({
      offer_id: offerId,
      brand_id: offer.brand_id,
      band_id: offer.band_id,
      total_value: offer.total_value,
      weekly_payment: weeklyPayment,
      term_weeks: offer.term_weeks,
      weeks_paid: 0,
      total_paid: 0,
      exclusivity: offer.exclusivity,
      status: 'active',
      health: 100,
      deliverables: [],
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    })
    .select()
    .single();
  
  if (contractError) throw contractError;
  
  // Create payment schedule
  const payments = [];
  for (let week = 1; week <= offer.term_weeks; week++) {
    const scheduledDate = new Date(startDate);
    scheduledDate.setDate(scheduledDate.getDate() + (week * 7));
    
    payments.push({
      contract_id: contract.id,
      band_id: offer.band_id,
      amount: weeklyPayment,
      week_number: week,
      status: 'scheduled',
      scheduled_at: scheduledDate.toISOString(),
    });
  }
  
  const { error: paymentsError } = await supabase
    .from('sponsorship_payments')
    .insert(payments);
  
  if (paymentsError) throw paymentsError;
  
  // Update offer status
  await supabase
    .from('sponsorship_offers')
    .update({ status: 'accepted' })
    .eq('id', offerId);
  
  return contract;
}

export async function rejectOffer(offerId: string): Promise<void> {
  const { error } = await supabase
    .from('sponsorship_offers')
    .update({ status: 'declined' })
    .eq('id', offerId);
  
  if (error) throw error;
}

export async function terminateContract(contractId: string): Promise<void> {
  const { error } = await supabase
    .from('sponsorship_contracts')
    .update({ status: 'terminated' })
    .eq('id', contractId);
  
  if (error) throw error;
  
  // Cancel pending payments
  await supabase
    .from('sponsorship_payments')
    .update({ status: 'cancelled' })
    .eq('contract_id', contractId)
    .eq('status', 'scheduled');
}
