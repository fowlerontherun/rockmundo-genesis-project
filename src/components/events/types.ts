import type { ReactNode } from "react";

export interface LineupSlot {
  id: string;
  artist: string;
  stage: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

export interface SponsorPackage {
  id: string;
  name: string;
  level: "title" | "presenting" | "supporting" | "local";
  contribution: number;
  benefits: string;
  activationFocus: string;
  roiGoal: string;
}

export interface PricingStrategyState {
  basePrice: number;
  dynamicPricing: boolean;
  breakEvenCost: number;
  marketingBudget: number;
  demandScore: number;
  lastReviewNote?: ReactNode;
}

export interface TicketTier {
  id: string;
  event_id: string;
  name: string;
  price: number;
  quantity: number;
  benefits: string | null;
  tickets_sold: number;
  fees?: number | null;
  created_at?: string | null;
}
