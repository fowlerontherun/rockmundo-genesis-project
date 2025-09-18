import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar, MapPin, Users, DollarSign, Clock, Star, Music, Volume2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import {
  AttributeKey,
  calculateExperienceReward,
  calculateFanGain,
  extractAttributeScores,
  getFocusAttributeScore,
  attributeScoreToMultiplier
} from "@/utils/gameBalance";
import { applyEquipmentWear } from "@/utils/equipmentWear";
import { fetchEnvironmentModifiers, type EnvironmentModifierSummary, type AppliedEnvironmentEffect } from "@/utils/worldEnvironment";
import { awardActionXp } from "@/utils/progression";
import type { Database, Json } from "@/integrations/supabase/types";

type VenueRow = Database["public"]["Tables"]["venues"]["Row"];
type CityRow = Database["public"]["Tables"]["cities"]["Row"];
type GigRow = Database["public"]["Tables"]["gigs"]["Row"];
type GigInsertPayload = Database["public"]["Tables"]["gigs"]["Insert"] & {
  environment_modifiers?: EnvironmentModifierSummary | null;
};
type GigUpdatePayload = Database["public"]["Tables"]["gigs"]["Update"] & {
  environment_modifiers?: EnvironmentModifierSummary | null;
};
type GigRecord = GigRow & {
  venues: VenueRow | null;
  environment_modifiers?: EnvironmentModifierSummary | null;
};

type ShowType = Database["public"]["Enums"]["show_type"];

const DEFAULT_SHOW_TYPE: ShowType = "standard";

const SHOW_TYPE_DETAILS: Record<ShowType, {
  label: string;
  description: string;
  paymentMultiplier: number;
  attendanceModifier: number;
  successModifier: number;
  fanMultiplier: number;
  experienceModifier: number;
}> = {
  standard: {
    label: "Standard",
    description: "Full band production with amplified sound",
    paymentMultiplier: 1,
    attendanceModifier: 1,
    successModifier: 0,
    fanMultiplier: 1,
    experienceModifier: 1,
  },
  acoustic: {
    label: "Acoustic",
    description: "Intimate unplugged set with lower stage volume",
    paymentMultiplier: 0.85,
    attendanceModifier: 0.8,
    successModifier: 8,
    fanMultiplier: 1.2,
    experienceModifier: 1.15,
  },
};

const SHOW_TYPE_DURATION_SECONDS: Record<ShowType, number> = {
  standard: 7200,
  acoustic: 5400,
};

const SHOW_TYPE_COLLABORATION_SIZE: Record<ShowType, number> = {
  standard: 5,
  acoustic: 3,
};

const SHOW_TYPE_OPTIONS: Array<{ value: ShowType; label: string; description: string }> = Object.entries(SHOW_TYPE_DETAILS).map(([value, detail]) => ({
  value: value as ShowType,
  label: detail.label,
  description: detail.description,
}));

const getShowTypeLabel = (showType: ShowType) =>
  SHOW_TYPE_DETAILS[showType]?.label ?? SHOW_TYPE_DETAILS[DEFAULT_SHOW_TYPE].label;

const getShowTypeBadgeClass = (showType: ShowType) =>
  showType === "acoustic"
    ? "bg-amber-500/10 text-amber-500 border-amber-500/40"
    : "bg-sky-500/10 text-sky-500 border-sky-500/40";

const getShowTypeDetails = (showType: ShowType) =>
  SHOW_TYPE_DETAILS[showType] ?? SHOW_TYPE_DETAILS[DEFAULT_SHOW_TYPE];

const GIG_EXPERIENCE_ATTRIBUTES: AttributeKey[] = ["stage_presence", "musical_ability"];

const ALL_CITIES_VALUE = "all";

type JsonRequirementRecord = Extract<Json, Record<string, number | boolean | string | null>>;
type VenueRequirements = JsonRequirementRecord & {
  min_popularity?: number | null;
};

const formatDateForInput = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

interface Venue {
  id: string;
  name: string;
  location: string;
  city?: string | null;
  capacity: number;
  venue_type: string;
  base_payment: number;
  prestige_level: number;
  requirements: VenueRequirements;
}

interface Gig {
  id: string;
  venue_id: string;
  band_id?: string;
  scheduled_date: string;
  payment: number;
  status: string;
  attendance: number;
  fan_gain: number;
  show_type: ShowType;
  venue: Venue;
  environment_modifiers?: EnvironmentModifierSummary | null;
}

const normalizeVenueRequirements = (
  requirements: VenueRow["requirements"] | VenueRequirements | null | undefined,
): VenueRequirements => {
  if (!requirements || typeof requirements !== "object" || Array.isArray(requirements)) {
    return {};
  }

  const normalized: VenueRequirements = {};

  for (const [key, value] of Object.entries(requirements)) {
    if (key === "min_popularity") {
      if (typeof value === "number") {
        normalized.min_popularity = value;
      } else if (typeof value === "string") {
        const parsedValue = Number(value);
        if (!Number.isNaN(parsedValue)) {
          normalized.min_popularity = parsedValue;
        }
      }
      continue;
    }

    if (value === null || typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
      normalized[key] = value;
    }
  }

  return normalized;
};

const GigBooking = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    profile,
    skills,
    attributes,
    currentCity,
    updateProfile,
    updateAttributes,
    addActivity,
    xpWallet,
    attributeStarTotal
  } = useGameData();
  const attributeScores = useMemo(() => extractAttributeScores(attributes), [attributes]);
  const progressionSnapshot = useMemo(
    () => ({
      wallet: xpWallet ?? null,
      attributeStars: attributeStarTotal,
      legacyExperience: profile?.experience ?? null
    }),
    [xpWallet, attributeStarTotal, profile?.experience]
  );
  const [venues, setVenues] = useState<Venue[]>([]);
  const [playerGigs, setPlayerGigs] = useState<Gig[]>([]);
  const [selectedGig, setSelectedGig] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [showTypeSelections, setShowTypeSelections] = useState<Record<string, ShowType>>({});
  const [cities, setCities] = useState<CityRow[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<string>(currentCity?.id ?? ALL_CITIES_VALUE);
  const [citySelectionTouched, setCitySelectionTouched] = useState(false);
  const selectedCity = useMemo(
    () => cities.find((city) => city.id === selectedCityId),
    [cities, selectedCityId]
  );
  const handleShowTypeSelection = (venueId: string, value: ShowType) => {
    setShowTypeSelections((prev) => ({
      ...prev,
      [venueId]: value,
    }));
  };
  const handleDateSelection = (venueId: string, value: string) => {
    setVenueDateSelections((prev) => ({
      ...prev,
      [venueId]: value,
    }));
  };

  useEffect(() => {
    if (currentCity?.id && !citySelectionTouched && selectedCityId === ALL_CITIES_VALUE) {
      setSelectedCityId(currentCity.id);
    }
  }, [citySelectionTouched, currentCity?.id, selectedCityId]);

  const loadCities = useCallback(async () => {
    setCitiesLoading(true);
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      const sanitizedCities = ((data ?? []) as CityRow[]).filter(
        (city): city is CityRow => typeof city.id === 'string' && city.id.trim().length > 0,
      );

      setCities(sanitizedCities);
    } catch (error: unknown) {
      const fallbackMessage = "Failed to load cities";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error loading cities:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    } finally {
      setCitiesLoading(false);
    }
  }, [toast]);

  const loadVenues = useCallback(async () => {
    setVenuesLoading(true);
    try {
      let query = supabase
        .from('venues')
        .select('*');

      if (selectedCityId !== ALL_CITIES_VALUE) {
        query = query.eq('city', selectedCityId);
      }

      const { data, error } = await query
        .order('prestige_level', { ascending: true })
        .order('capacity', { ascending: true });

      if (error) throw error;

      const venueRows = ((data ?? []) as VenueRow[]).filter(
        (venue): venue is VenueRow => typeof venue.id === 'string' && venue.id.trim().length > 0,
      );

      setVenues(venueRows.map(venue => ({
        id: venue.id,
        name: venue.name,
        location: venue.location ?? 'Unknown',
        city: venue.city ?? null,
        capacity: venue.capacity ?? 0,
        venue_type: venue.venue_type ?? 'general',
        base_payment: venue.base_payment ?? 0,
        prestige_level: venue.prestige_level ?? 1,
        requirements: (venue.requirements as VenueRequirements | null) ?? ({} as VenueRequirements)
      })));
    } catch (error: unknown) {
      const fallbackMessage = "Failed to load venues";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error loading venues:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    } finally {
      setVenuesLoading(false);
    }
  }, [selectedCityId, toast]);

  const loadPlayerGigs = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('gigs')
        .select(`
          *,
          venues!gigs_venue_id_fkey(*)
        `)
        .eq('band_id', user.id) // For solo artists, band_id can be user_id
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      const gigRows = (data ?? []) as GigRecord[];
      setPlayerGigs(gigRows.map(gig => {
        const venueDetails = gig.venues;
        const venue: Venue = {
          id: venueDetails?.id ?? gig.venue_id,
          name: venueDetails?.name ?? 'Unknown Venue',
          location: venueDetails?.location ?? 'Unknown',
          city: venueDetails?.city ?? null,
          capacity: venueDetails?.capacity ?? 0,
          venue_type: venueDetails?.venue_type ?? 'general',
          base_payment: venueDetails?.base_payment ?? 0,
          prestige_level: venueDetails?.prestige_level ?? 1,
          requirements: (venueDetails?.requirements as VenueRequirements | null) ?? ({} as VenueRequirements)
        };

        return {
          id: gig.id,
          venue_id: gig.venue_id,
          band_id: gig.band_id ?? undefined,
          scheduled_date: gig.scheduled_date,
          payment: gig.payment ?? 0,
          status: gig.status ?? 'scheduled',
          attendance: gig.attendance ?? 0,
          fan_gain: gig.fan_gain ?? 0,
          show_type: (gig.show_type ?? DEFAULT_SHOW_TYPE) as ShowType,
          venue,
          environment_modifiers: gig.environment_modifiers ?? null
        };
      }));
    } catch (error: unknown) {
      const fallbackMessage = 'Failed to load player gigs';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error loading player gigs:', errorMessage, error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCities();
  }, [loadCities]);

  useEffect(() => {
    if (user) {
      loadPlayerGigs();
    }
  }, [user, loadPlayerGigs]);

  useEffect(() => {
    if (user) {
      loadVenues();
    }
  }, [user, loadVenues]);

  const calculateGigPayment = (venue: Venue, showType: ShowType = DEFAULT_SHOW_TYPE) => {
    const details = getShowTypeDetails(showType);
    const popularityBonus = Math.round(venue.base_payment * ((profile?.fame || 0) / 1000));
    const performanceSkill = skills?.performance || 0;
    const supplementalSkill = showType === "acoustic" ? skills?.songwriting || 0 : skills?.guitar || 0;
    const skillBonus = Math.round(venue.base_payment * ((performanceSkill + supplementalSkill) / 400));
    const baseTotal = venue.base_payment + popularityBonus + skillBonus;
    const charismaMultiplier = attributeScoreToMultiplier(attributeScores.charisma ?? null, 0.4);
    const looksMultiplier = attributeScoreToMultiplier(attributeScores.looks ?? null, 0.25);
    const musicalityMultiplier = attributeScoreToMultiplier(attributeScores.musicality ?? null, 0.3);
    const attributeMultiplier = showType === "acoustic"
      ? charismaMultiplier * musicalityMultiplier
      : charismaMultiplier * looksMultiplier * musicalityMultiplier;
    return Math.round(baseTotal * details.paymentMultiplier * attributeMultiplier);
  };

  const calculateSuccessChance = (venue: Venue, showType: ShowType = DEFAULT_SHOW_TYPE) => {
    const details = getShowTypeDetails(showType);
    const performanceSkill = skills?.performance || 0;
    const vocalsSkill = skills?.vocals || 0;
    const songwritingSkill = skills?.songwriting || 0;
    const instrumentalSkill = skills?.guitar || 0;
    const skillFactor = showType === "acoustic"
      ? performanceSkill * 0.35 + vocalsSkill * 0.4 + songwritingSkill * 0.25
      : (performanceSkill + vocalsSkill + instrumentalSkill * 0.5) / 2.5;
    const popularityFactor = Math.min(profile?.fame || 0, 120);
    const baseChance = 48 + details.successModifier;
    const performanceFocus = getFocusAttributeScore(attributeScores, "performance");
    const attributeBonus = (performanceFocus / 1000) * 10;
    const attributeMultiplier = attributeScoreToMultiplier(performanceFocus, 0.3);

    return Math.min(97, Math.max(12, (baseChance + (skillFactor / 2) + (popularityFactor / 6) + attributeBonus) * attributeMultiplier));
  };

  const meetsRequirements = (venue: Venue) => {
    const reqs = venue.requirements;
        if (reqs.min_popularity && (profile?.fame || 0) < reqs.min_popularity) {
      return false;
    }

    return true;
  };

  const bookGig = async (venue: Venue) => {
    if (!user || !profile) return;

    if (!meetsRequirements(venue)) {
      toast({
        variant: "destructive",
        title: "Requirements not met",
        description: "You don't meet the requirements for this venue",
      });
      return;
    }

    const selectedDateValue = venueDateSelections[venue.id];

    if (!selectedDateValue) {
      toast({
        variant: "destructive",
        title: "Select a date",
        description: "Choose when you'd like to perform before booking this gig.",
      });
      return;
    }

    const selectedDate = new Date(selectedDateValue);

    if (Number.isNaN(selectedDate.getTime())) {
      toast({
        variant: "destructive",
        title: "Invalid date",
        description: "Please pick a valid date and time for your performance.",
      });
      return;
    }

    if (selectedDate.getTime() <= Date.now()) {
      toast({
        variant: "destructive",
        title: "Date must be in the future",
        description: "Select a performance time that hasn't already passed.",
      });
      return;
    }

    setBooking(true);

    try {
      const showType = showTypeSelections[venue.id] ?? DEFAULT_SHOW_TYPE;
      const showTypeDetails = getShowTypeDetails(showType);
      const showTypeLabel = getShowTypeLabel(showType);
      const payment = calculateGigPayment(venue, showType);

      let environmentSummary: EnvironmentModifierSummary | null = null;
      try {
        environmentSummary = await fetchEnvironmentModifiers(venue.location, selectedDate.toISOString());
      } catch (envError) {
        console.error('Error fetching environment modifiers for gig:', envError);
      }

      const baseAttendance = Math.max(1, Math.round(venue.capacity * 0.6));
      const attendanceMultiplier = environmentSummary?.attendanceMultiplier ?? 1;
      const projectedAttendance = Math.max(
        1,
        Math.round(baseAttendance * attendanceMultiplier * showTypeDetails.attendanceModifier),
      );

      const gigInsertPayload: GigInsertPayload = {
        venue_id: venue.id,
        band_id: user.id,
        scheduled_date: selectedDate.toISOString(),
        payment,
        show_type: showType,
        status: 'scheduled',
        attendance: projectedAttendance,
        environment_modifiers: environmentSummary
          ? {
              ...environmentSummary,
              projections: {
                attendance: projectedAttendance,
              },
            }
          : null,
      };

      const { data, error } = await supabase
        .from('gigs')
        .insert(gigInsertPayload)
        .select(`
          *,
          venues!gigs_venue_id_fkey(*)
        `)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to create gig');

      const insertedGig: GigRecord = data as GigRecord;
      const environmentFromDb = insertedGig.environment_modifiers ?? null;
      const mergedEnvironment = environmentFromDb ?? (environmentSummary
        ? {
            ...environmentSummary,
            projections: {
              attendance: projectedAttendance,
            },
          }
        : null);

      const venueDetails = insertedGig.venues;
      const newGig: Gig = {
        id: insertedGig.id,
        venue_id: insertedGig.venue_id,
        band_id: insertedGig.band_id ?? undefined,
        scheduled_date: insertedGig.scheduled_date,
        payment: insertedGig.payment ?? payment,
        status: insertedGig.status ?? 'scheduled',
        attendance: insertedGig.attendance ?? projectedAttendance,
        fan_gain: insertedGig.fan_gain ?? 0,
        show_type: (insertedGig.show_type ?? showType) as ShowType,
        venue: {
          id: venueDetails?.id ?? venue.id,
          name: venueDetails?.name ?? venue.name,
          location: venueDetails?.location ?? venue.location,
          capacity: venueDetails?.capacity ?? venue.capacity,
          venue_type: venueDetails?.venue_type ?? venue.venue_type,
          base_payment: venueDetails?.base_payment ?? venue.base_payment,
          prestige_level: venueDetails?.prestige_level ?? venue.prestige_level,
          requirements: (venueDetails?.requirements as VenueRequirements | null) ?? venue.requirements,
        },
        environment_modifiers: mergedEnvironment,
      };

      const eventEndTime = new Date(selectedDate);
      eventEndTime.setHours(eventEndTime.getHours() + 2);

      const environmentNotes = mergedEnvironment?.applied?.length
        ? mergedEnvironment.applied
            .map((effect) => {
              const parts: string[] = [];
              if (effect.source === 'weather') {
                parts.push(effect.name);
              } else {
                parts.push(effect.name);
              }

              const modifiers: string[] = [];
              if (effect.attendanceMultiplier && effect.attendanceMultiplier !== 1) {
                modifiers.push(`attendance ${Math.round((effect.attendanceMultiplier - 1) * 100)}%`);
              }
              if (effect.costMultiplier && effect.costMultiplier !== 1) {
                modifiers.push(`cost ${Math.round((effect.costMultiplier - 1) * 100)}%`);
              }
              if (effect.moraleModifier && effect.moraleModifier !== 1) {
                modifiers.push(`morale ${Math.round((effect.moraleModifier - 1) * 100)}%`);
              }

              if (modifiers.length) {
                parts.push(`(${modifiers.join(', ')})`);
              }

              return parts.join(' ');
            })
            .join(' | ')
        : null;

      const scheduleDescriptionBase = `Live ${showTypeLabel} performance at ${venue.name}`;
      const scheduleDescription = environmentNotes
        ? `${scheduleDescriptionBase} • Env: ${environmentNotes}`
        : scheduleDescriptionBase;

      const { error: scheduleError } = await supabase
        .from('schedule_events')
        .insert({
          user_id: user.id,
          event_type: 'gig',
          title: `${showTypeLabel} gig at ${venue.name}`,
          description: scheduleDescription,
          start_time: selectedDate.toISOString(),
          end_time: eventEndTime.toISOString(),
          location: venue.location,
          status: 'scheduled',
          gig_id: data.id
        });

      if (scheduleError) {
        console.error('Error adding gig to schedule:', scheduleError);
        toast({
          variant: "destructive",
          title: "Schedule update failed",
          description: "Gig booked but the schedule couldn't be updated automatically."
        });
      }

      setPlayerGigs(prev => [...prev, newGig]);

      await addActivity('gig', `Booked a ${showTypeLabel.toLowerCase()} gig at ${venue.name}`, 0);

      const formattedDate = selectedDate.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const toastParts = [
        `You're performing at ${venue.name} on ${formattedDate}.`,
        `Projected attendance: ${projectedAttendance.toLocaleString()}.`,
      ];

      toastParts.unshift(`${showTypeLabel} set secured.`);

      if (environmentNotes) {
        toastParts.push(`Environment: ${environmentNotes}.`);
      }

      toast({
        title: "Gig booked!",
        description: toastParts.join(' '),
      });
    } catch (error: unknown) {
      const fallbackMessage = "Failed to book the gig";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error booking gig:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Booking failed",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    } finally {
      setBooking(false);
    }
  };

  const performGig = async (gig: Gig) => {
    if (!user || !profile) return;

    try {
      const showType = gig.show_type ?? DEFAULT_SHOW_TYPE;
      const showTypeDetails = getShowTypeDetails(showType);
      const showTypeLabel = getShowTypeLabel(showType);
      const successChance = calculateSuccessChance(gig.venue, showType);
      const isSuccess = Math.random() * 100 < successChance;

      const environmentModifiers = gig.environment_modifiers;
      const attendanceMultiplier = environmentModifiers?.attendanceMultiplier ?? 1;
      const moraleMultiplier = environmentModifiers?.moraleModifier ?? 1;

      const capacity = gig.venue.capacity ?? 0;
      const successBase = showType === "acoustic"
        ? 0.55 + Math.random() * 0.25
        : 0.6 + Math.random() * 0.4;
      const failureBase = showType === "acoustic"
        ? 0.25 + Math.random() * 0.2
        : 0.2 + Math.random() * 0.3;

      let attendance = Math.round(
        capacity * (isSuccess ? successBase : failureBase) * showTypeDetails.attendanceModifier,
      );
      attendance = Math.max(1, Math.round(attendance * attendanceMultiplier));

      const prestigeFactor = Math.max(1, gig.venue.prestige_level ?? 1);
      const baseFanGain = isSuccess
        ? Math.round(attendance * 0.1 * (prestigeFactor / 5))
        : Math.round(attendance * 0.05);
      const rawFanGain = baseFanGain * showTypeDetails.fanMultiplier * moraleMultiplier;
      const fanGain = Math.max(
        0,
        calculateFanGain(rawFanGain, skills?.performance ?? 0, attributeScores)
      );

      const basePaymentMultiplier = isSuccess ? 1 : 0.5;
      const acousticPayoutModifier = showType === "acoustic" ? (isSuccess ? 0.95 : 0.75) : 1;
      const charismaMultiplier = attributeScoreToMultiplier(attributeScores.charisma ?? null, 0.4);
      const looksMultiplier = attributeScoreToMultiplier(attributeScores.looks ?? null, 0.25);
      const musicalityMultiplier = attributeScoreToMultiplier(attributeScores.musicality ?? null, 0.3);
      const attributePaymentMultiplier = showType === "acoustic"
        ? charismaMultiplier * musicalityMultiplier
        : charismaMultiplier * looksMultiplier * musicalityMultiplier;
      const actualPayment = Math.max(
        Math.round(gig.payment * basePaymentMultiplier * acousticPayoutModifier * attributePaymentMultiplier),
        Math.round(gig.payment * 0.3),
      );

      // Update gig status
      const updatedEnvironment = environmentModifiers
        ? {
            ...environmentModifiers,
            projections: {
              ...environmentModifiers.projections,
              attendance,
            },
          }
        : null;

      const gigUpdatePayload: GigUpdatePayload = {
        status: 'completed',
        attendance,
        fan_gain: fanGain,
        payment: actualPayment,
        environment_modifiers: updatedEnvironment,
      };

      const { error } = await supabase
        .from('gigs')
        .update(gigUpdatePayload)
        .eq('id', gig.id);

      if (error) throw error;

      // Update player stats
      const newCash = (profile.cash || 0) + actualPayment;
      const newFame = (profile.fame || 0) + fanGain;
      const baseExperience = (attendance / 10) * showTypeDetails.experienceModifier;
      const expGain = Math.max(
        1,
        calculateExperienceReward(baseExperience, attributeScores, "performance", progressionSnapshot)
      );

      await updateProfile({
        cash: newCash,
        fame: newFame,
      });

      const attributeUpdates: Partial<Record<AttributeKey, number>> = {};
      const currentCharisma = attributeScores.charisma ?? 0;
      const currentLooks = attributeScores.looks ?? 0;
      const currentMusicality = attributeScores.musicality ?? 0;
      const charismaGain = Math.round(fanGain * (isSuccess ? 0.45 : 0.25));
      const looksGain = Math.round(fanGain * (showType === "acoustic" ? 0.2 : 0.35));
      const musicalityGain = Math.round(expGain * 0.3);

      if (charismaGain > 0) {
        attributeUpdates.charisma = Math.min(1000, Math.round(currentCharisma + charismaGain));
      }

      if (looksGain > 0) {
        attributeUpdates.looks = Math.min(1000, Math.round(currentLooks + looksGain));
      }

      if (musicalityGain > 0) {
        attributeUpdates.musicality = Math.min(1000, Math.round(currentMusicality + musicalityGain));
      }

      if (Object.keys(attributeUpdates).length > 0) {
        await updateAttributes(attributeUpdates);
      }

      // Update local state
      setPlayerGigs(prev => prev.map(g =>
        g.id === gig.id
          ? {
              ...g,
              status: 'completed',
              attendance,
              fan_gain: fanGain,
              payment: actualPayment,
              show_type: showType,
              environment_modifiers: updatedEnvironment ?? g.environment_modifiers,
            }
          : g
      ));

      await addActivity(
        'gig',
        `Performed a ${showTypeLabel.toLowerCase()} set at ${gig.venue.name} (${attendance} attendance)`,
        actualPayment
      );

      let wearNotice = '';

      try {
        const wearSummary = await applyEquipmentWear(user.id, 'gig');
        if (wearSummary?.updates.length) {
          wearNotice = ` Gear wear detected on ${wearSummary.updates.length} item${wearSummary.updates.length > 1 ? 's' : ''}. Check the inventory manager for repairs.`;
        }
      } catch (wearError) {
        console.error('Failed to apply equipment wear after gig', wearError);
      }

      toast({
        title: isSuccess ? "Great performance!" : "Performance complete",
        description: `${showTypeLabel} show — earned $${actualPayment}, +${fanGain} fans, +${expGain} XP.${wearNotice}`,
      });
    } catch (error: unknown) {
      const fallbackMessage = "Failed to complete the gig";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error performing gig:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Performance failed",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    }
  };

  const getDifficultyBadge = (prestige: number) => {
    if (prestige <= 2) return <Badge variant="outline" className="bg-green-500/10 text-green-500">Easy</Badge>;
    if (prestige <= 3) return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">Medium</Badge>;
    if (prestige <= 4) return <Badge variant="outline" className="bg-orange-500/10 text-orange-500">Hard</Badge>;
    return <Badge variant="outline" className="bg-red-500/10 text-red-500">Expert</Badge>;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-primary text-primary-foreground';
      case 'completed': return 'bg-success text-success-foreground';
      case 'cancelled': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const formatEnvironmentDelta = (value?: number, label?: string) => {
    if (!value || value === 1 || !label) {
      return null;
    }

    const percent = Math.round((value - 1) * 100);
    if (percent === 0) {
      return null;
    }

    const sign = percent > 0 ? '+' : '';
    return `${label} ${sign}${percent}%`;
  };

  const summarizeEnvironmentEffect = (effect: AppliedEnvironmentEffect) => {
    const changes = [
      formatEnvironmentDelta(effect.attendanceMultiplier, 'Attendance'),
      formatEnvironmentDelta(effect.costMultiplier, 'Costs'),
      formatEnvironmentDelta(effect.moraleModifier, 'Morale'),
    ].filter(Boolean);

    return changes.join(' • ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading venues...</p>
        </div>
      </div>
    );
  }

  const minimumDateTime = formatDateForInput(new Date());

  const upcomingGigs = playerGigs.filter(gig => gig.status === 'scheduled');
  const pastGigs = playerGigs.filter(gig => gig.status === 'completed');

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Gig Booking
            </h1>
            <p className="text-muted-foreground">Book performances and build your fanbase</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-primary/20 rounded-lg px-4 py-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold">{upcomingGigs.length} Upcoming</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="venues" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="venues">Available Venues</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming Gigs</TabsTrigger>
            <TabsTrigger value="history">Performance History</TabsTrigger>
          </TabsList>

          <TabsContent value="venues">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Choose your stage</h2>
                  <p className="text-sm text-muted-foreground">
                    Explore venues by city to plan your next performance.
                  </p>
                </div>
                <Select
                  value={selectedCityId}
                  onValueChange={(value) => {
                    setCitySelectionTouched(true);
                    setSelectedCityId(value);
                  }}
                  disabled={citiesLoading || (cities.length === 0 && selectedCityId !== ALL_CITIES_VALUE)}
                >
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Select a city" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_CITIES_VALUE}>All Cities</SelectItem>
                    {cities.map((city) => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                        {city.id === currentCity?.id ? " (Current)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {venuesLoading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-4">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
                  <p className="text-sm text-muted-foreground">Loading venues...</p>
                </div>
              ) : venues.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {venues.map((venue) => {
                const showType = showTypeSelections[venue.id] ?? DEFAULT_SHOW_TYPE;
                const showTypeLabel = getShowTypeLabel(showType);
                const showTypeDescription = getShowTypeDetails(showType).description;
                const payment = calculateGigPayment(venue, showType);
                const successChance = calculateSuccessChance(venue, showType);
                const canBook = meetsRequirements(venue);

                return (
                  <Card key={venue.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{venue.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {venue.location}
                          </CardDescription>
                          <div className="mt-2">
                            <Badge
                              variant="outline"
                              className={`border ${getShowTypeBadgeClass(showType)} text-xs uppercase tracking-wide`}
                            >
                              {showTypeLabel} Set
                            </Badge>
                          </div>
                        </div>
                        {getDifficultyBadge(venue.prestige_level)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Capacity</div>
                          <div className="font-semibold">{venue.capacity.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Type</div>
                          <div className="font-semibold capitalize">{venue.venue_type}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Show Type</span>
                          <Badge variant="outline" className={`border ${getShowTypeBadgeClass(showType)}`}>
                            {showTypeLabel}
                          </Badge>
                        </div>
                        <div onClick={(event) => event.stopPropagation()}>
                          <Select
                            value={showType}
                            onValueChange={(value) => handleShowTypeSelection(venue.id, value as ShowType)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select show type" />
                            </SelectTrigger>
                            <SelectContent>
                              {SHOW_TYPE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {showTypeDescription}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Performance Date &amp; Time</span>
                        </div>
                        <div onClick={(event) => event.stopPropagation()}>
                          <Input
                            type="datetime-local"
                            value={venueDateSelections[venue.id] ?? ""}
                            min={minimumDateTime}
                            onChange={(event) => handleDateSelection(venue.id, event.target.value)}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Choose when you want to take the stage at this venue.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Payment:</span>
                          <span className="font-bold text-success">${payment.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Success Rate:</span>
                          <span className="font-bold">{successChance.toFixed(0)}%</span>
                        </div>
                      </div>

                      <Progress value={successChance} className="h-2" />

                      {venue.requirements && Object.keys(venue.requirements).length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Requirements:</div>
                          {Object.entries(venue.requirements).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              {key === 'min_popularity' && `${value} Fame minimum`}
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        onClick={() => bookGig(venue)}
                        disabled={!canBook || booking}
                        className="w-full"
                        variant={canBook ? "default" : "secondary"}
                      >
                        {!canBook ? "Requirements Not Met" : booking ? "Booking..." : "Book Gig"}
                      </Button>
                    </CardContent>
                  </Card>
                );
                  })}
                </div>
              ) : (
                <Alert className="bg-card/70 backdrop-blur-sm border-primary/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No venues available</AlertTitle>
                  <AlertDescription>
                    {selectedCityId === ALL_CITIES_VALUE
                      ? "There aren't any venues available right now. Check back later as new opportunities open up."
                      : `No venues are currently booking in ${selectedCity?.name ?? "this city"}. Try another city or come back soon.`}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>

          <TabsContent value="upcoming">
            <div className="space-y-4">
              {upcomingGigs.length === 0 ? (
                <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                  <CardContent className="text-center py-12">
                    <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Upcoming Gigs</h3>
                    <p className="text-muted-foreground">Book some venues to start performing!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {upcomingGigs.map((gig) => {
                    const showType = gig.show_type ?? DEFAULT_SHOW_TYPE;
                    const showTypeLabel = getShowTypeLabel(showType);
                    const successChance = calculateSuccessChance(gig.venue, showType);
                    return (
                      <Card key={gig.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                        <CardHeader>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <CardTitle className="text-lg">{gig.venue.name}</CardTitle>
                              <CardDescription className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {gig.venue.location}
                              </CardDescription>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge className={getStatusColor(gig.status)} variant="outline">
                                {gig.status}
                              </Badge>
                              <Badge variant="outline" className={`border ${getShowTypeBadgeClass(showType)} text-xs`}>
                                {showTypeLabel}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Date</div>
                              <div className="font-semibold">
                                {new Date(gig.scheduled_date).toLocaleDateString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Payment</div>
                              <div className="font-semibold text-success">${gig.payment.toLocaleString()}</div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Success Rate:</span>
                              <span className="font-bold">{successChance.toFixed(0)}%</span>
                            </div>
                            <Progress value={successChance} className="h-2" />
                          </div>

                          {gig.environment_modifiers?.projections?.attendance && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Projected Attendance</span>
                              <span className="font-semibold">
                                {gig.environment_modifiers.projections.attendance.toLocaleString()}
                              </span>
                            </div>
                          )}

                          {gig.environment_modifiers?.applied?.length ? (
                            <div className="space-y-1 border-t border-border/40 pt-3 text-xs">
                              <div className="text-sm font-semibold text-foreground">Environment Effects</div>
                              <div className="space-y-1">
                                {gig.environment_modifiers.applied.map((effect) => {
                                  const summary = summarizeEnvironmentEffect(effect);
                                  const detail = summary || effect.description;
                                  return (
                                    <div key={`${gig.id}-${effect.id}`} className="flex items-start justify-between gap-2">
                                      <span className="font-medium text-foreground">{effect.name}</span>
                                      {detail && (
                                        <span className="text-muted-foreground text-right">
                                          {detail}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}

                          <Button
                            onClick={() => performGig(gig)}
                            className="w-full bg-gradient-primary"
                          >
                            <Music className="h-4 w-4 mr-2" />
                            Perform Now
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-4">
              {pastGigs.length === 0 ? (
                <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                  <CardContent className="text-center py-12">
                    <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Performance History</h3>
                    <p className="text-muted-foreground">Complete some gigs to see your performance history!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {pastGigs.map((gig) => {
                    const showType = gig.show_type ?? DEFAULT_SHOW_TYPE;
                    const showTypeLabel = getShowTypeLabel(showType);
                    return (
                      <Card key={gig.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                        <CardHeader>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <CardTitle className="text-lg">{gig.venue.name}</CardTitle>
                              <CardDescription className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {gig.venue.location}
                              </CardDescription>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge className={getStatusColor(gig.status)} variant="outline">
                                {gig.status}
                              </Badge>
                              <Badge variant="outline" className={`border ${getShowTypeBadgeClass(showType)} text-xs`}>
                                {showTypeLabel}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Date</div>
                              <div className="font-semibold">
                                {new Date(gig.scheduled_date).toLocaleDateString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Earned</div>
                              <div className="font-semibold text-success">${gig.payment.toLocaleString()}</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Attendance</div>
                              <div className="font-semibold">{gig.attendance.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">New Fans</div>
                              <div className="font-semibold text-accent">+{gig.fan_gain}</div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">Venue Fill Rate</div>
                            <Progress
                              value={(gig.attendance / gig.venue.capacity) * 100}
                              className="h-2"
                            />
                            <div className="text-xs text-right">
                              {Math.round((gig.attendance / gig.venue.capacity) * 100)}% capacity
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default GigBooking;