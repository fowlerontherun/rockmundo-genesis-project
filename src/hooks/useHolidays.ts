import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

import staycationImg from "@/assets/holidays/staycation.jpg";
import beachResortImg from "@/assets/holidays/beach-resort.jpg";
import mountainCabinImg from "@/assets/holidays/mountain-cabin.jpg";
import tropicalIslandImg from "@/assets/holidays/tropical-island.jpg";
import countrysideImg from "@/assets/holidays/countryside.jpg";
import spaResortImg from "@/assets/holidays/spa-resort.jpg";
import skiChaletImg from "@/assets/holidays/ski-chalet.jpg";
import mediterraneanImg from "@/assets/holidays/mediterranean.jpg";
import japaneseOnsenImg from "@/assets/holidays/japanese-onsen.jpg";
import safariLodgeImg from "@/assets/holidays/safari-lodge.jpg";
import yachtCruiseImg from "@/assets/holidays/yacht-cruise.jpg";
import desertGlampingImg from "@/assets/holidays/desert-glamping.jpg";

export interface HolidayDestination {
  name: string;
  durations: number[];
  costPerDay: number;
  healthPerDay: number;
  description: string;
  emoji: string;
  image: string;
  location: string;
  highlights: string[];
  stressReduction: number;
  creativityBoost: number;
  tier: "budget" | "standard" | "premium" | "luxury" | "ultra";
}

export const HOLIDAY_DESTINATIONS: HolidayDestination[] = [
  {
    name: "Local Staycation",
    durations: [3, 5, 7],
    costPerDay: 150,
    healthPerDay: 12,
    description: "Unplug at home with comfort food, Netflix, and zero obligations. Sometimes the best escape is staying put.",
    emoji: "🏠",
    image: staycationImg,
    location: "Your city",
    highlights: ["No travel stress", "Home cooking", "Catch up on sleep", "Local spa day"],
    stressReduction: 2,
    creativityBoost: 5,
    tier: "budget",
  },
  {
    name: "Countryside Retreat",
    durations: [3, 5, 7],
    costPerDay: 280,
    healthPerDay: 16,
    description: "Rolling hills, stone cottages, and crackling fireplaces. Reconnect with nature on long walks through wildflower meadows.",
    emoji: "🌻",
    image: countrysideImg,
    location: "English Cotswolds",
    highlights: ["Farm-to-table dining", "Nature walks", "Horseback riding", "Stargazing"],
    stressReduction: 3,
    creativityBoost: 15,
    tier: "standard",
  },
  {
    name: "Mountain Cabin",
    durations: [5, 7, 10],
    costPerDay: 350,
    healthPerDay: 18,
    description: "A secluded log cabin surrounded by snow-capped peaks and pine forests. Hot chocolate by the fireplace, hiking trails at your door.",
    emoji: "🏔️",
    image: mountainCabinImg,
    location: "Canadian Rockies",
    highlights: ["Log fire evenings", "Mountain hiking", "Wildlife spotting", "Hot springs nearby"],
    stressReduction: 4,
    creativityBoost: 20,
    tier: "standard",
  },
  {
    name: "Beach Resort",
    durations: [5, 7, 14],
    costPerDay: 500,
    healthPerDay: 20,
    description: "White sand beaches, turquoise water, and cocktails delivered to your sun lounger. All-inclusive paradise with water sports galore.",
    emoji: "🏖️",
    image: beachResortImg,
    location: "Maldives",
    highlights: ["All-inclusive dining", "Snorkeling & diving", "Beach yoga", "Sunset catamaran cruise"],
    stressReduction: 4,
    creativityBoost: 10,
    tier: "premium",
  },
  {
    name: "Spa Resort",
    durations: [5, 7, 10],
    costPerDay: 750,
    healthPerDay: 25,
    description: "World-class wellness resort with marble hot tubs, aromatherapy, deep-tissue massages, and personalised health programs.",
    emoji: "🧖",
    image: spaResortImg,
    location: "Bali, Indonesia",
    highlights: ["Daily massages", "Detox juice programs", "Meditation classes", "Thermal pools"],
    stressReduction: 5,
    creativityBoost: 12,
    tier: "premium",
  },
  {
    name: "Alpine Ski Chalet",
    durations: [5, 7, 10],
    costPerDay: 800,
    healthPerDay: 19,
    description: "A luxury chalet in the Swiss Alps with panoramic mountain views, private hot tub on the deck, and world-class skiing.",
    emoji: "⛷️",
    image: skiChaletImg,
    location: "Zermatt, Switzerland",
    highlights: ["Private ski instructor", "Hot tub with views", "Fondue evenings", "Helicopter tour"],
    stressReduction: 4,
    creativityBoost: 18,
    tier: "premium",
  },
  {
    name: "Mediterranean Villa",
    durations: [7, 10, 14],
    costPerDay: 900,
    healthPerDay: 22,
    description: "Terracotta walls draped in bougainvillea, infinity pool overlooking the Amalfi Coast, and the finest Italian cuisine.",
    emoji: "🏛️",
    image: mediterraneanImg,
    location: "Amalfi Coast, Italy",
    highlights: ["Private chef", "Infinity pool", "Wine tasting tours", "Boat trips to Capri"],
    stressReduction: 5,
    creativityBoost: 25,
    tier: "luxury",
  },
  {
    name: "Japanese Onsen Retreat",
    durations: [7, 10, 14],
    costPerDay: 1000,
    healthPerDay: 28,
    description: "Traditional ryokan with natural hot spring baths, zen gardens, and kaiseki cuisine. Deep spiritual restoration.",
    emoji: "♨️",
    image: japaneseOnsenImg,
    location: "Hakone, Japan",
    highlights: ["Natural hot springs", "Kaiseki cuisine", "Zen meditation", "Cherry blossom gardens"],
    stressReduction: 5,
    creativityBoost: 30,
    tier: "luxury",
  },
  {
    name: "Tropical Island",
    durations: [7, 14, 21],
    costPerDay: 1200,
    healthPerDay: 28,
    description: "Your own overwater bungalow on a private island. Crystal lagoons, personal butler, and absolute seclusion.",
    emoji: "🌴",
    image: tropicalIslandImg,
    location: "Bora Bora, French Polynesia",
    highlights: ["Overwater bungalow", "Personal butler", "Private beach", "Glass-bottom boat"],
    stressReduction: 5,
    creativityBoost: 20,
    tier: "luxury",
  },
  {
    name: "Safari Lodge",
    durations: [7, 10, 14],
    costPerDay: 1500,
    healthPerDay: 22,
    description: "Wake up to elephants at your doorstep. Luxury tented camp on the Serengeti with sunrise game drives and sundowner cocktails.",
    emoji: "🦁",
    image: safariLodgeImg,
    location: "Serengeti, Tanzania",
    highlights: ["Daily game drives", "Sundowner cocktails", "Bush dining", "Hot air balloon safari"],
    stressReduction: 4,
    creativityBoost: 35,
    tier: "luxury",
  },
  {
    name: "Desert Glamping",
    durations: [5, 7, 10],
    costPerDay: 1800,
    healthPerDay: 20,
    description: "Moroccan luxury tents under a canopy of stars in the Sahara. Camel treks, campfire feasts, and absolute silence.",
    emoji: "🏜️",
    image: desertGlampingImg,
    location: "Sahara Desert, Morocco",
    highlights: ["Camel trekking", "Stargazing sessions", "Sand dune sunrise", "Traditional Berber feast"],
    stressReduction: 4,
    creativityBoost: 40,
    tier: "ultra",
  },
  {
    name: "Private Yacht Cruise",
    durations: [7, 14, 21],
    costPerDay: 2500,
    healthPerDay: 24,
    description: "A 120ft superyacht cruising the Greek islands. Private crew, Michelin-star chef, helipad, and island-hopping at your whim.",
    emoji: "🛥️",
    image: yachtCruiseImg,
    location: "Greek Islands",
    highlights: ["Full crew & chef", "Island hopping", "Water toys & jet skis", "On-deck jacuzzi"],
    stressReduction: 5,
    creativityBoost: 25,
    tier: "ultra",
  },
];

export interface PlayerHoliday {
  id: string;
  user_id: string;
  destination: string;
  started_at: string;
  ends_at: string;
  duration_days: number;
  cost: number;
  health_boost_per_day: number;
  status: string;
  created_at: string;
}

export function useHolidays() {
  const { user } = useAuth();
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  // Fetch active holiday
  const { data: activeHoliday, isLoading } = useQuery({
    queryKey: ["active-holiday", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data } = await supabase
        .from("player_holidays")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as PlayerHoliday | null;
    },
    enabled: !!profileId,
  });

  // Check cooldown (14 days since last completed holiday)
  const { data: canBookHoliday } = useQuery({
    queryKey: ["holiday-cooldown", profileId],
    queryFn: async () => {
      if (!profileId) return true;
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data } = await supabase
        .from("player_holidays")
        .select("id")
        .eq("user_id", profileId!)
        .in("status", ["completed", "active"])
        .gte("created_at", fourteenDaysAgo.toISOString())
        .limit(1);

      return !data || data.length === 0;
    },
    enabled: !!profileId,
  });

  // Book a holiday
  const bookHolidayMutation = useMutation({
    mutationFn: async ({ destination, durationDays }: { destination: HolidayDestination; durationDays: number }) => {
      if (!profileId || !user?.id) throw new Error("Not authenticated");

      const totalCost = destination.costPerDay * durationDays;

      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();

      if ((profile?.cash ?? 0) < totalCost) {
        throw new Error(`Not enough cash. Need $${totalCost.toLocaleString()}`);
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays);

      // Create holiday record
      const { error: holidayError } = await supabase
        .from("player_holidays")
        .insert({
          user_id: profileId,
          destination: destination.name,
          started_at: startDate.toISOString(),
          ends_at: endDate.toISOString(),
          duration_days: durationDays,
          cost: totalCost,
          health_boost_per_day: destination.healthPerDay,
          status: "active",
        });

      if (holidayError) throw holidayError;

      // Create blocking scheduled activity
      await (supabase as any).from("player_scheduled_activities").insert({
        user_id: profileId,
        profile_id: profileId,
        activity_type: "holiday",
        scheduled_start: startDate.toISOString(),
        scheduled_end: endDate.toISOString(),
        title: `Holiday: ${destination.name}`,
        description: `${durationDays}-day ${destination.description.toLowerCase()}`,
        status: "in_progress",
        metadata: { songwriting_allowed: true },
      });

      // Deduct cost
      await supabase.from("profiles").update({ cash: (profile?.cash ?? 0) - totalCost }).eq("id", profileId);

      // Immediate health boost for first day
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("health")
        .eq("id", profileId)
        .single();

      const newHealth = Math.min(100, (currentProfile?.health ?? 0) + destination.healthPerDay);
      await supabase.from("profiles").update({ health: newHealth }).eq("id", profileId);

      return { destination: destination.name, durationDays, totalCost };
    },
    onSuccess: ({ destination, durationDays, totalCost }) => {
      queryClient.invalidateQueries({ queryKey: ["active-holiday"] });
      queryClient.invalidateQueries({ queryKey: ["holiday-cooldown"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(`Booked ${durationDays}-day holiday to ${destination}! Cost: $${totalCost.toLocaleString()}`);
    },
    onError: (err) => toast.error(err.message),
  });

  // Cancel holiday early
  const cancelHolidayMutation = useMutation({
    mutationFn: async () => {
      if (!profileId || !activeHoliday) throw new Error("No active holiday");

      await supabase
        .from("player_holidays")
        .update({ status: "cancelled" })
        .eq("id", activeHoliday.id);

      // Complete the scheduled activity
      await (supabase as any)
        .from("player_scheduled_activities")
        .update({ status: "completed" })
        .eq("profile_id", profileId)
        .eq("activity_type", "holiday")
        .eq("status", "in_progress");

      return {};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-holiday"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.info("Holiday cancelled. No refund for remaining days.");
    },
    onError: (err) => toast.error(err.message),
  });

  // Calculate days remaining
  const daysRemaining = activeHoliday
    ? Math.max(0, Math.ceil((new Date(activeHoliday.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    activeHoliday,
    canBookHoliday: canBookHoliday ?? true,
    isLoading,
    bookHoliday: bookHolidayMutation.mutate,
    isBooking: bookHolidayMutation.isPending,
    cancelHoliday: cancelHolidayMutation.mutate,
    isCancelling: cancelHolidayMutation.isPending,
    daysRemaining,
  };
}
