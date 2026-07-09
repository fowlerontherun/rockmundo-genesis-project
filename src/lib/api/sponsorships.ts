import { supabase } from "@/integrations/supabase/client";
import { assertNonEmptyString, throwDbError } from "@/lib/db-errors";

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

  if (error) throwDbError(error, { operation: 'list', table: 'sponsorship_brands' });
  return data || [];
}

export async function fetchSponsorshipOffers(bandId: string): Promise<SponsorshipOffer[]> {
  const validBandId = assertNonEmptyString(bandId, 'bandId');
  const { data, error } = await supabase
    .from('sponsorship_offers')
    .select(`*, brand:sponsorship_brands(*)`)
    .eq('band_id', validBandId)
    .order('created_at', { ascending: false });

  if (error) throwDbError(error, { operation: 'list', table: 'sponsorship_offers', filters: { bandId: validBandId }, rlsHint: 'Verify offer RLS is scoped to the selected band.' });
  return data || [];
}

export async function fetchSponsorshipContracts(bandId: string): Promise<SponsorshipContract[]> {
  const validBandId = assertNonEmptyString(bandId, 'bandId');
  const { data, error } = await supabase
    .from('sponsorship_contracts')
    .select(`*, brand:sponsorship_brands(*)`)
    .eq('band_id', validBandId)
    .order('created_at', { ascending: false });

  if (error) throwDbError(error, { operation: 'list', table: 'sponsorship_contracts', filters: { bandId: validBandId }, rlsHint: 'Verify contract RLS is scoped to the selected band.' });
  return data || [];
}

export async function fetchContractPayments(contractId: string): Promise<SponsorshipPayment[]> {
  const validContractId = assertNonEmptyString(contractId, 'contractId');
  const { data, error } = await supabase
    .from('sponsorship_payments')
    .select('*')
    .eq('contract_id', validContractId)
    .order('week_number', { ascending: true });

  if (error) throwDbError(error, { operation: 'list', table: 'sponsorship_payments', filters: { contractId: validContractId }, rlsHint: 'Verify payment RLS follows the parent contract ownership.' });
  return data || [];
}

export async function acceptOffer(offerId: string): Promise<SponsorshipContract> {
  const validOfferId = assertNonEmptyString(offerId, "offerId");
  const { data: offer, error: offerError } = await supabase
    .from('sponsorship_offers')
    .select('*')
    .eq('id', validOfferId)
    .maybeSingle();

  if (offerError) throwDbError(offerError, { operation: 'fetch', table: 'sponsorship_offers', filters: { offerId: validOfferId }, rlsHint: 'A null row can mean not found or hidden by RLS.' });
  if (!offer) throw new Error(`Sponsorship offer ${validOfferId} was not found or is not visible`);
  if (offer.status !== 'pending') throw new Error(`Sponsorship offer ${validOfferId} is ${offer.status}, not pending`);
  if (!Number.isFinite(offer.term_weeks) || offer.term_weeks <= 0) throw new Error(`Sponsorship offer ${validOfferId} has invalid term_weeks`);
  if (!Number.isFinite(offer.total_value) || offer.total_value < 0) throw new Error(`Sponsorship offer ${validOfferId} has invalid total_value`);

  const weeklyPayment = Math.floor(offer.total_value / offer.term_weeks);
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + (offer.term_weeks * 7));

  const { data: contract, error: contractError } = await supabase
    .from('sponsorship_contracts')
    .insert({
      offer_id: validOfferId,
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

  if (contractError) throwDbError(contractError, { operation: 'insert', table: 'sponsorship_contracts', filters: { offerId: validOfferId, bandId: offer.band_id, brandId: offer.brand_id }, rlsHint: 'Verify offer_id, brand_id, and band_id FKs exist and contract insert RLS permits this band.' });

  const payments = [];
  for (let week = 1; week <= offer.term_weeks; week++) {
    const scheduledDate = new Date(startDate);
    scheduledDate.setDate(scheduledDate.getDate() + (week * 7));
    payments.push({ contract_id: contract.id, band_id: offer.band_id, amount: weeklyPayment, week_number: week, status: 'scheduled', scheduled_at: scheduledDate.toISOString() });
  }

  const { error: paymentsError } = await supabase.from('sponsorship_payments').insert(payments);
  if (paymentsError) throwDbError(paymentsError, { operation: 'insert', table: 'sponsorship_payments', filters: { contractId: contract.id, bandId: offer.band_id }, rlsHint: 'Verify sponsorship_payments contract_id and band_id FKs are valid.' });

  const { error: updateOfferError } = await supabase.from('sponsorship_offers').update({ status: 'accepted' }).eq('id', validOfferId);
  if (updateOfferError) throwDbError(updateOfferError, { operation: 'update', table: 'sponsorship_offers', filters: { offerId: validOfferId }, rlsHint: 'Contract exists but offer status update failed; check offer update RLS.' });

  return contract;
}

export async function rejectOffer(offerId: string): Promise<void> {
  const validOfferId = assertNonEmptyString(offerId, "offerId");
  const { error } = await supabase.from('sponsorship_offers').update({ status: 'declined' }).eq('id', validOfferId);
  if (error) throwDbError(error, { operation: 'update', table: 'sponsorship_offers', filters: { offerId: validOfferId }, rlsHint: 'Verify the current user can update this offer through RLS.' });
}

export async function terminateContract(contractId: string): Promise<void> {
  const validContractId = assertNonEmptyString(contractId, "contractId");
  const { error } = await supabase.from('sponsorship_contracts').update({ status: 'terminated' }).eq('id', validContractId);
  if (error) throwDbError(error, { operation: 'update', table: 'sponsorship_contracts', filters: { contractId: validContractId }, rlsHint: 'Verify contract ownership RLS permits termination.' });

  const { error: cancelPaymentsError } = await supabase
    .from('sponsorship_payments')
    .update({ status: 'cancelled' })
    .eq('contract_id', validContractId)
    .eq('status', 'scheduled');

  if (cancelPaymentsError) throwDbError(cancelPaymentsError, { operation: 'update', table: 'sponsorship_payments', filters: { contractId: validContractId, status: 'scheduled' }, rlsHint: 'Contract was terminated but scheduled payment cancellation failed; check child-row RLS.' });
}
