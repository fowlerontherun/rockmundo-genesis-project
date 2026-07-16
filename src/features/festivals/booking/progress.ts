import type { FestivalApplicationRecord, FestivalContractRecord, FestivalOfferRecord, FestivalSetlistRecord } from './domainTypes';
export type BookingProgressStepState = 'incomplete' | 'active' | 'complete' | 'blocked' | 'failed' | 'cancelled';
export function deriveBookingProgress({ application, offer, contract, setlist }: { application?: FestivalApplicationRecord; offer?: FestivalOfferRecord; contract?: FestivalContractRecord; setlist?: FestivalSetlistRecord }) {
 const appTerminal = application?.status === 'rejected' ? 'failed' : application?.status === 'withdrawn' ? 'cancelled' : application ? 'complete' : 'active';
 const offerState = offer?.status === 'expired' || offer?.status === 'declined' ? 'failed' : offer?.status === 'withdrawn' ? 'cancelled' : offer?.status === 'accepted_pending_contract' || contract ? 'complete' : offer ? 'active' : 'incomplete';
 const contractState = contract?.status === 'cancelled' || contract?.status === 'terminated' ? 'cancelled' : contract?.status === 'expired' || contract?.status === 'breached' ? 'failed' : contract?.status === 'active' || contract?.status === 'fulfilled' ? 'complete' : contract ? 'active' : 'incomplete';
 const setlistState = setlist?.status === 'changes_requested' ? 'blocked' : setlist?.status === 'cancelled' ? 'cancelled' : ['approved','locked','performed'].includes(setlist?.status ?? '') ? 'complete' : setlist ? 'active' : 'incomplete';
 return [{ label: 'Application', state: appTerminal as BookingProgressStepState }, { label: 'Offer', state: offerState as BookingProgressStepState }, { label: 'Contract', state: contractState as BookingProgressStepState }, { label: 'Setlist', state: setlistState as BookingProgressStepState }];
}
