import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth-context';
import { useGameData } from '@/hooks/useGameData';
import { useGameEvents, type GameEventWithStatus } from '@/hooks/useGameEvents';
import { toast } from '@/components/ui/sonner-toast';
import { supabase } from '@/integrations/supabase/client';
import AvatarWithClothing from '@/components/avatar/AvatarWithClothing';
import { useEquippedClothing } from '@/hooks/useEquippedClothing';
import {
  fetchWorldEnvironmentSnapshot,
  fetchCityEnvironmentDetails,
  DEFAULT_TRAVEL_MODES,
  type WeatherCondition,
  type City,
  type WorldEvent,
  type RandomEvent,
  type CityEnvironmentDetails,
  type CityTravelMode,
} from '@/utils/worldEnvironment';
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSnow, 
  Zap, 
  Wind,
  MapPin,
  Calendar,
  AlertTriangle,
  SparklesIcon,
  Globe,
  Mountain,
  Building,
  Users,
  TrendingUp,
  DollarSign,
  Music,
  Thermometer,
  Clock,
  Loader2,
} from 'lucide-react';

const REFRESH_INTERVAL = 60_000;

const WorldEnvironment: React.FC = () => {
  const { user } = useAuth();
  const { profile, updateProfile, addActivity } = useGameData();
  const { items: equippedClothing } = useEquippedClothing();
  const [weather, setWeather] = useState<WeatherCondition[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [worldEvents, setWorldEvents] = useState<WorldEvent[]>([]);
  const [randomEvents, setRandomEvents] = useState<RandomEvent[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [cityDetails, setCityDetails] = useState<CityEnvironmentDetails | null>(null);
  const [cityDetailsLoading, setCityDetailsLoading] = useState(false);
  const [activeTravelModeId, setActiveTravelModeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const cityIdFromParams = searchParams.get('cityId');
  const searchParamsString = searchParams.toString();

  const {
    events: liveEvents,
    loading: eventsLoading,
    refreshing: eventsRefreshing,
    error: eventsError,
    joinEvent: joinGameEvent,
    completeEvent: completeGameEvent,
    refresh: refreshGameEvents,
    joiningEventId,
    completingEventId
  } = useGameEvents({ profile, updateProfile, addActivity });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!cityIdFromParams || !cities.length) {
      return;
    }

    setSelectedCity((current) => {
      if (current?.id === cityIdFromParams) {
        return current;
      }

      const match = cities.find((city) => city.id === cityIdFromParams);
      return match ?? current;
    });
  }, [cityIdFromParams, cities]);

  useEffect(() => {
    if (!selectedCity) {
      if (!cityIdFromParams) {
        return;
      }

      const params = new URLSearchParams(searchParamsString);
      params.delete('cityId');
      setSearchParams(params, { replace: true });
      return;
    }

    if (selectedCity.id === cityIdFromParams) {
      return;
    }

    const params = new URLSearchParams(searchParamsString);
    params.set('cityId', selectedCity.id);
    setSearchParams(params, { replace: true });
  }, [selectedCity, cityIdFromParams, searchParamsString, setSearchParams]);

  const formatRewardEntries = useCallback((rewards: unknown) => {
    if (!rewards || typeof rewards !== 'object' || Array.isArray(rewards)) {
      return [] as { key: string; label: string; value: number }[];
    }

    return Object.entries(rewards as Record<string, unknown>)
      .map(([key, value]) => {
        const numericValue = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(numericValue) || numericValue === 0) {
          return null;
        }

        return {
          key,
          label: key.replace(/_/g, ' '),
          value: numericValue
        };
      })
      .filter((entry): entry is { key: string; label: string; value: number } => entry !== null);
  }, []);

  const formatRequirementEntries = useCallback((requirements: unknown) => {
    if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) {
      return [] as { key: string; label: string; value: number }[];
    }

    return Object.entries(requirements as Record<string, unknown>)
      .map(([key, value]) => {
        const numericValue = typeof value === 'number' ? value : Number(value);

        if (!Number.isFinite(numericValue)) {
          return null;
        }

        return {
          key,
          label: key.replace(/_/g, ' '),
          value: numericValue
        };
      })
      .filter((entry): entry is { key: string; label: string; value: number } => entry !== null);
  }, []);

  const handleCitySelection = useCallback(
    (city: City) => {
      setSelectedCity(city);
      const params = new URLSearchParams(searchParamsString);
      params.set('cityId', city.id);
      setSearchParams(params, { replace: true });
    },
    [searchParamsString, setSearchParams]
  );

  const handleJoinGameEvent = useCallback(
    async (event: GameEventWithStatus) => {
      try {
        await joinGameEvent(event.id);
        toast.success(`Joined ${event.title}`);
      } catch (error: unknown) {
        console.error('Error joining event:', error);
        const message = error instanceof Error ? error.message : 'Failed to join event.';
        toast.error(message);
      }
    },
    [joinGameEvent]
  );

  const handleCompleteGameEvent = useCallback(
    async (event: GameEventWithStatus) => {
      try {
        await completeGameEvent(event.id);
        toast.success(`Rewards claimed for ${event.title}`);
      } catch (error: unknown) {
        console.error('Error completing event:', error);
        const message = error instanceof Error ? error.message : 'Failed to complete event.';
        toast.error(message);
      }
    },
    [completeGameEvent]
  );

  const loadWorldData = useCallback(async (showLoader: boolean = true) => {
    if (!user) {
      return;
    }

    try {
      if (showLoader && isMountedRef.current) {
        setLoading(true);
      }

      const { weather: weatherSnapshot, cities: citySnapshot, worldEvents: worldEventSnapshot, randomEvents: randomEventSnapshot } =
        await fetchWorldEnvironmentSnapshot();

      if (!isMountedRef.current) {
        return;
      }

      setWeather(weatherSnapshot);
      setCities(citySnapshot);
      setWorldEvents(worldEventSnapshot);
      setRandomEvents(randomEventSnapshot);
      setSelectedCity((current) => {
        if (!citySnapshot.length) {
          return null;
        }

        if (cityIdFromParams) {
          const requestedCity = citySnapshot.find((city) => city.id === cityIdFromParams);
          if (requestedCity) {
            return requestedCity;
          }
        }

        if (current) {
          const existing = citySnapshot.find((city) => city.id === current.id);
          return existing ?? citySnapshot[0];
        }

        return citySnapshot[0];
      });
    } catch (error: unknown) {
      console.error('Error loading world data:', error);
      if (showLoader) {
        toast.error('Failed to load world data');
      }
    } finally {
      if (showLoader && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [user, cityIdFromParams]);

  const loadCityDetails = useCallback(
    async (city: City | null, options: { showLoader?: boolean; quiet?: boolean } = {}) => {
      const { showLoader = true, quiet = false } = options;

      if (!user || !city) {
        if (isMountedRef.current) {
          setCityDetails(null);
          setCityDetailsLoading(false);
        }
        return;
      }

      try {
        if (showLoader && isMountedRef.current) {
          setCityDetailsLoading(true);
        }

        const details = await fetchCityEnvironmentDetails(city.id, {
          cityName: city.name,
          country: city.country,
        });

        if (!isMountedRef.current) {
          return;
        }

        setCityDetails(details);
      } catch (error: unknown) {
        console.error('Error loading city details:', error);
        if (!quiet) {
          toast.error(`Failed to load details for ${city.name}`);
        }
      } finally {
        if (isMountedRef.current && showLoader) {
          setCityDetailsLoading(false);
        }
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user) {
      setWeather([]);
      setCities([]);
      setWorldEvents([]);
      setRandomEvents([]);
      setSelectedCity(null);
      setCityDetails(null);
      setCityDetailsLoading(false);
      setActiveTravelModeId(null);
      setLoading(false);
      return;
    }

    loadWorldData(true);

    const interval = setInterval(() => {
      loadWorldData(false);
    }, REFRESH_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [user, loadWorldData]);

  useEffect(() => {
    if (!selectedCity || !user) {
      if (!selectedCity && isMountedRef.current) {
        setCityDetails(null);
        setCityDetailsLoading(false);
      }
      return;
    }

    loadCityDetails(selectedCity, { showLoader: true });
  }, [selectedCity, user, loadCityDetails]);

  useEffect(() => {
    setActiveTravelModeId(null);
  }, [selectedCity?.id]);

  useEffect(() => {
    if (!selectedCity || !user) {
      return;
    }

    const channel = supabase.channel(`world-environment-${selectedCity.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `current_city_id=eq.${selectedCity.id}`,
      }, () => {
        loadCityDetails(selectedCity, { showLoader: false, quiet: true });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'gigs',
      }, () => {
        loadCityDetails(selectedCity, { showLoader: false, quiet: true });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'city_metadata',
        filter: `city_id=eq.${selectedCity.id}`,
      }, () => {
        loadCityDetails(selectedCity, { showLoader: false, quiet: true });
      });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCity, user, loadCityDetails]);

  const getWeatherIcon = (condition: string) => {
    switch (condition) {
      case 'sunny': return <Sun className="w-6 h-6 text-yellow-500" />;
      case 'cloudy': return <Cloud className="w-6 h-6 text-gray-500" />;
      case 'rainy': return <CloudRain className="w-6 h-6 text-blue-500" />;
      case 'stormy': return <Zap className="w-6 h-6 text-purple-500" />;
      case 'snowy': return <CloudSnow className="w-6 h-6 text-blue-300" />;
      default: return <Sun className="w-6 h-6" />;
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'festival': return <Music className="w-5 h-5 text-purple-500" />;
      case 'competition': return <TrendingUp className="w-5 h-5 text-blue-500" />;
      case 'economic': return <DollarSign className="w-5 h-5 text-green-500" />;
      case 'disaster': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'celebration': return <SparklesIcon className="w-5 h-5 text-yellow-500" />;
      default: return <Globe className="w-5 h-5" />;
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'border-purple-500 bg-purple-50';
      case 'epic': return 'border-blue-500 bg-blue-50';
      case 'rare': return 'border-green-500 bg-green-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const handleTravelTo = useCallback(async (mode: CityTravelMode) => {
    if (!profile || !selectedCity) {
      toast.error('Select a city to travel to first');
      return;
    }

    const currentCash = typeof profile.cash === 'number' ? profile.cash : 0;
    const isTraveling = Boolean(profile.travel_eta && Date.parse(profile.travel_eta) > Date.now());

    if (isTraveling) {
      toast.info('Travel already in progress. Please wait until you arrive.');
      return;
    }

    if (profile.current_city_id === selectedCity.id) {
      toast.info(`You're already in ${selectedCity.name}.`);
      return;
    }

    const costValue = Number.isFinite(mode.cost) ? Math.max(0, Math.round(mode.cost)) : 0;

    if (costValue > currentCash) {
      toast.error('Not enough cash for this travel option.');
      return;
    }

    try {
      setActiveTravelModeId(mode.id);

      const departure = new Date();
      const travelHours = Number.isFinite(mode.travelTimeHours) && mode.travelTimeHours > 0
        ? mode.travelTimeHours
        : 1;
      const arrival = new Date(departure.getTime() + travelHours * 60 * 60 * 1000);

      const updates: Partial<typeof profile> & {
        current_city_id?: string | null;
        travel_mode?: string | null;
        travel_started_at?: string | null;
        travel_eta?: string | null;
      } = {
        current_city_id: selectedCity.id,
        travel_mode: mode.id,
        travel_started_at: departure.toISOString(),
        travel_eta: arrival.toISOString(),
      };

      if (costValue > 0) {
        updates.cash = Math.max(0, currentCash - costValue);
      }

      const updatedProfile = await updateProfile(updates as Partial<typeof profile>);

      if (updatedProfile) {
        await addActivity(
          'travel',
          `Traveling to ${selectedCity.name} via ${mode.name}`,
          -costValue,
        );
        toast.success(
          `Traveling to ${selectedCity.name} via ${mode.name}. ETA ${arrival.toLocaleString()}`,
        );
        loadCityDetails(selectedCity, { showLoader: false, quiet: true });
      }
    } catch (error: unknown) {
      console.error('Error starting travel:', error);
      toast.error('Failed to start travel');
    } finally {
      if (isMountedRef.current) {
        setActiveTravelModeId(null);
      }
    }
  }, [profile, selectedCity, updateProfile, addActivity, loadCityDetails]);

  const handleRandomEventChoice = async (eventId: string, choiceId: string) => {
    const event = randomEvents.find((item) => item.id === eventId);
    const choice = event?.choices.find((item) => item.id === choiceId);

    if (!event || !choice || !profile || !user) {
      return;
    }

    // Check requirements
    if (choice.requirements) {
      const profileRecord = profile as unknown as Record<string, unknown>;
      const meetsRequirements = Object.entries(choice.requirements).every(([key, value]) => {
        const requirementValue = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(requirementValue)) {
          return true;
        }

        const currentValue = profileRecord[key];
        if (typeof currentValue === 'number') {
          return currentValue >= requirementValue;
        }

        if (key === 'level') {
          return profile.level >= requirementValue;
        }

        return true;
      });

      if (!meetsRequirements) {
        toast.error('You don\'t meet the requirements for this choice');
        return;
      }
    }

    try {
      const profileRecord = profile as unknown as Record<string, unknown>;
      const updates: Partial<typeof profile> = {};
      const updatesRecord = updates as Record<string, number>;
      const resultingStats: Record<string, number> = {};

      Object.entries(choice.effects).forEach(([key, delta]) => {
        if (typeof delta !== 'number') {
          return;
        }

        const currentValue = profileRecord[key];
        if (typeof currentValue === 'number') {
          const newValue = currentValue + delta;
          updatesRecord[key] = newValue;
          resultingStats[key] = newValue;
        }
      });

      let latestProfile = profile;
      if (Object.keys(updatesRecord).length > 0) {
        const updated = await updateProfile(updates);
        if (updated) {
          latestProfile = updated;
        }
      }

      const outcomePayload: Record<string, unknown> = {
        user_id: user.id,
        event_id: event.id,
        choice_id: choice.id,
        choice_text: choice.text,
        effects: choice.effects,
      };

      if (Object.keys(resultingStats).length > 0) {
        const latestProfileRecord = latestProfile as unknown as Record<string, unknown>;
        const resultingPayload: Record<string, number> = {
          cash: latestProfile.cash,
          fame: latestProfile.fame,
          experience: latestProfile.experience,
          level: latestProfile.level,
          ...resultingStats,
        };

        const fansValue = latestProfileRecord.fans;
        if (typeof fansValue === 'number') {
          resultingPayload.fans = fansValue;
        }

        outcomePayload.resulting_stats = resultingPayload;
      }

      const { error: outcomeError } = await supabase
        .from('random_event_history')
        .insert(outcomePayload);

      if (outcomeError) {
        console.error('Error logging random event outcome:', outcomeError);
        toast.warning('Event completed, but we could not record the outcome.');
      }

      const cashDelta = typeof choice.effects.cash === 'number' ? choice.effects.cash : 0;

      await addActivity(
        'random_event',
        `${event.title}: ${choice.text}`,
        cashDelta
      );

      setRandomEvents((prev) => prev.filter((item) => item.id !== eventId));

      toast.success(`Event completed: ${choice.text}`);

      loadWorldData(false);
    } catch (error: unknown) {
      console.error('Error handling random event:', error);
      toast.error('Failed to complete event');
    }
  };

  const participateInWorldEvent = async (eventId: string) => {
    const event = worldEvents.find(e => e.id === eventId);
    if (!event || !profile) return;

    try {
      await updateProfile({
        cash: profile.cash + event.participation_reward,
        fame: profile.fame + 100
      });

      await addActivity(
        'world_event',
        `Participated in ${event.title}`,
        event.participation_reward
      );

      toast.success(`Joined ${event.title}! Reward: $${event.participation_reward.toLocaleString()}`);
    } catch (error: unknown) {
      console.error('Error participating in world event:', error);
      toast.error('Failed to participate in event');
    }
  };

  const travelInProgress = Boolean(profile?.travel_eta && Date.parse(profile.travel_eta) > Date.now());
  const isInSelectedCity = Boolean(profile && selectedCity && profile.current_city_id === selectedCity.id);
  const playerCash = typeof profile?.cash === 'number' ? profile.cash : 0;
  const activeTravelMode = profile?.travel_mode ?? null;
  const travelEtaDate = profile?.travel_eta ? new Date(profile.travel_eta) : null;
  const travelOptions = cityDetails?.travelModes?.length
    ? cityDetails.travelModes
    : (!cityDetailsLoading && selectedCity ? DEFAULT_TRAVEL_MODES : cityDetails?.travelModes ?? []);
  const cityLocations = cityDetails?.locations?.length
    ? cityDetails.locations
    : cityDetails?.metadata?.locations ?? [];
  const playersInCity = cityDetails?.players ?? [];
  const gigsInCity = cityDetails?.gigs ?? [];
  const travelModeDisplayName = activeTravelMode
    ? (cityDetails?.travelModes?.find((mode) => mode.id === activeTravelMode)?.name ?? activeTravelMode)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
          World Environment
        </h1>
        <p className="text-muted-foreground">
          Dynamic world conditions, events, and opportunities that shape your musical journey
        </p>
      </div>

      {profile && (
        <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
          <CardContent className="p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <AvatarWithClothing
                avatarUrl={profile.avatar_url}
                fallbackText={profile.display_name || profile.username}
                items={equippedClothing}
                size={104}
              />
            </div>
            <div className="text-center sm:text-left space-y-2">
              <div>
                <h2 className="text-xl font-semibold">{profile.display_name || profile.username}</h2>
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
              </div>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 text-xs text-muted-foreground">
                {profile.current_city_id && (
                  <Badge variant="outline" className="border-border text-foreground/80">
                    Traveling: {profile.travel_mode ? profile.travel_mode : 'Grounded'}
                  </Badge>
                )}
                <Badge variant="outline" className="border-border text-foreground/80">
                  Level {profile.level ?? 1}
                </Badge>
                <Badge variant="outline" className="border-border text-foreground/80">
                  Cash ${Math.max(0, profile.cash ?? 0).toLocaleString()}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {equippedClothing.length
                  ? `Outfit synced across the world with ${equippedClothing.length} clothing piece${equippedClothing.length === 1 ? '' : 's'}.`
                  : 'No clothing equipped yet — visit the inventory to update your look.'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="weather" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="weather">Weather</TabsTrigger>
          <TabsTrigger value="cities">Cities</TabsTrigger>
          <TabsTrigger value="events">World Events</TabsTrigger>
          <TabsTrigger value="random">Random Events</TabsTrigger>
          <TabsTrigger value="economics">Global Economy</TabsTrigger>
        </TabsList>

        <TabsContent value="weather" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {weather.map((condition) => (
              <Card key={condition.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium">{condition.city}</h3>
                      <p className="text-sm text-muted-foreground">{condition.country}</p>
                    </div>
                    {getWeatherIcon(condition.condition)}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4" />
                      <span>{condition.temperature}°C</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4" />
                      <span>{condition.wind_speed} km/h</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Humidity: {condition.humidity}%
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-medium">Effects on Performance:</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={`p-2 rounded ${condition.effects.gig_attendance > 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        Attendance: {Math.round((condition.effects.gig_attendance - 1) * 100)}%
                      </div>
                      <div className={`p-2 rounded ${condition.effects.travel_cost < 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        Travel: {Math.round((condition.effects.travel_cost - 1) * 100)}%
                      </div>
                      <div className={`p-2 rounded ${condition.effects.mood_modifier > 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        Mood: {Math.round((condition.effects.mood_modifier - 1) * 100)}%
                      </div>
                      <div className={`p-2 rounded ${condition.effects.equipment_risk < 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        Gear Risk: {Math.round((condition.effects.equipment_risk - 1) * 100)}%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cities" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6 items-start">
            <div className="space-y-6">
              {cities.length ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {cities.map((city) => {
                    const isSelected = selectedCity?.id === city.id;
                    return (
                      <Card
                        key={city.id}
                        className={`cursor-pointer transition-shadow ${isSelected ? 'border-primary shadow-lg ring-1 ring-primary/30' : 'hover:shadow-lg'}`}
                        onClick={() => handleCitySelection(city)}
                      >
                        <CardContent className="p-6 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-bold flex items-center gap-2">
                                {city.name}
                                {isSelected && (
                                  <Badge variant="outline" className="text-xs text-primary border-primary">
                                    Selected
                                  </Badge>
                                )}
                              </h3>
                              <p className="text-sm text-muted-foreground">{city.country}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-muted-foreground">Music Scene</div>
                              <div className="text-2xl font-bold text-primary">{city.music_scene}%</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-xs text-muted-foreground">Population</div>
                              <div className="font-medium">{(city.population / 1000000).toFixed(1)}M</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Venues</div>
                              <div className="font-medium">{city.venues}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Genre</div>
                              <div className="font-medium">{city.dominant_genre}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Local Bonus</div>
                              <div className="font-medium text-green-600">{city.local_bonus}x</div>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Cost of Living</div>
                            <Progress value={city.cost_of_living} className="h-2" />
                            <div className="text-xs text-muted-foreground mt-1">
                              {city.cost_of_living}% of global average
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-2">Cultural Events</div>
                            {city.cultural_events.length ? (
                              <div className="flex flex-wrap gap-1">
                                {city.cultural_events.map((event, index) => (
                                  <Badge key={`${city.id}-event-${index}`} variant="outline" className="text-xs">
                                    {event}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No cultural events recorded.</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No cities are available right now. Check back soon for new destinations.
                  </CardContent>
                </Card>
              )}
            </div>
            <div className="space-y-4">
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle>City Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {selectedCity ? (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-primary" />
                              <h3 className="text-xl font-bold">{selectedCity.name}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">{selectedCity.country}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant="outline" className="text-xs">
                              Music Scene {selectedCity.music_scene}%
                            </Badge>
                            {isInSelectedCity ? (
                              <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700 text-xs">
                                You are here
                              </Badge>
                            ) : travelInProgress && travelModeDisplayName ? (
                              <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 text-xs">
                                Traveling via {travelModeDisplayName}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-xs text-muted-foreground">Population</div>
                            <div className="font-medium">{(selectedCity.population / 1000000).toFixed(1)}M</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Venues</div>
                            <div className="font-medium">{selectedCity.venues}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Cost of Living</div>
                            <div className="font-medium">{selectedCity.cost_of_living}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Local Bonus</div>
                            <div className="font-medium text-green-600">{selectedCity.local_bonus}x</div>
                          </div>
                        </div>
                        {travelInProgress && travelEtaDate && (
                          <p className="text-xs text-muted-foreground">
                            Arrival expected {travelEtaDate.toLocaleString()}.
                          </p>
                        )}
                        <Separator />
                      </div>
                      <div className="space-y-4">
                        <section className="space-y-2">
                          <h4 className="flex items-center gap-2 text-sm font-semibold">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            Famous Resident
                          </h4>
                          {cityDetailsLoading ? (
                            <Skeleton className="h-4 w-2/3" />
                          ) : cityDetails?.metadata?.famousResident ? (
                            <p className="text-sm">{cityDetails.metadata.famousResident}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No famous resident recorded for this city yet.
                            </p>
                          )}
                        </section>
                        <Separator />
                        <section className="space-y-2">
                          <h4 className="flex items-center gap-2 text-sm font-semibold">
                            <Building className="w-4 h-4 text-blue-500" />
                            Intra-city Locations
                          </h4>
                          {cityDetailsLoading ? (
                            <div className="space-y-2">
                              <Skeleton className="h-16 w-full" />
                              <Skeleton className="h-16 w-full" />
                            </div>
                          ) : cityLocations.length ? (
                            <div className="space-y-2">
                              {cityLocations.map((location) => (
                                <div key={location.id} className="border rounded-lg p-3 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{location.name}</span>
                                    {location.category && (
                                      <Badge variant="outline" className="text-xs capitalize">
                                        {location.category}
                                      </Badge>
                                    )}
                                  </div>
                                  {location.description && (
                                    <p className="text-xs text-muted-foreground">{location.description}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No intra-city locations have been cataloged here yet.
                            </p>
                          )}
                        </section>
                        <Separator />
                        <section className="space-y-3">
                          <h4 className="flex items-center gap-2 text-sm font-semibold">
                            <Mountain className="w-4 h-4 text-amber-500" />
                            Travel Modes
                          </h4>
                          {cityDetailsLoading && !cityDetails ? (
                            <div className="space-y-2">
                              <Skeleton className="h-20 w-full" />
                              <Skeleton className="h-20 w-full" />
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {travelOptions.map((mode) => {
                                const insufficientFunds = typeof mode.cost === 'number' && mode.cost > playerCash;
                                const disableTravel = travelInProgress || isInSelectedCity || insufficientFunds || activeTravelModeId === mode.id;
                                return (
                                  <div key={mode.id} className="border rounded-lg p-3 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-sm font-semibold">{mode.name}</div>
                                        {mode.description && (
                                          <p className="text-xs text-muted-foreground mt-1">{mode.description}</p>
                                        )}
                                      </div>
                                      <Badge variant="outline" className="text-xs">
                                        Comfort {Math.round(mode.comfort)}
                                      </Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        {mode.travelTimeHours.toFixed(1)}h
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <DollarSign className="w-4 h-4" />
                                        ${Math.max(0, Math.round(mode.cost)).toLocaleString()}
                                      </span>
                                    </div>
                                    <Button
                                      size="sm"
                                      className="w-full"
                                      disabled={disableTravel}
                                      onClick={() => handleTravelTo(mode)}
                                    >
                                      {activeTravelModeId === mode.id && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      )}
                                      {travelInProgress ? 'Travel in progress' : isInSelectedCity ? 'Already in city' : insufficientFunds ? 'Insufficient funds' : `Travel via ${mode.name}`}
                                    </Button>
                                    {insufficientFunds && (
                                      <p className="text-xs text-red-600">
                                        Requires ${Math.max(0, Math.round(mode.cost)).toLocaleString()} – you have ${playerCash.toLocaleString()}.
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </section>
                        <Separator />
                        <section className="space-y-3">
                          <h4 className="flex items-center gap-2 text-sm font-semibold">
                            <Users className="w-4 h-4 text-indigo-500" />
                            Players Currently Here
                          </h4>
                          {cityDetailsLoading && !cityDetails ? (
                            <div className="space-y-2">
                              <Skeleton className="h-14 w-full" />
                              <Skeleton className="h-14 w-full" />
                            </div>
                          ) : playersInCity.length ? (
                            <div className="space-y-2">
                              {playersInCity.slice(0, 6).map((player) => {
                                const displayName = player.displayName ?? player.username;
                                return (
                                  <div key={player.profileId} className="flex items-center justify-between gap-3 border rounded-lg p-3">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-8 w-8">
                                        <AvatarImage src={player.avatarUrl ?? undefined} alt={displayName} />
                                        <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <div className="text-sm font-medium">{displayName}</div>
                                        <div className="text-xs text-muted-foreground">@{player.username}</div>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      {typeof player.level === 'number' && (
                                        <Badge variant="outline" className="text-xs">
                                          Lvl {player.level}
                                        </Badge>
                                      )}
                                      {player.primaryInstrument && (
                                        <span className="text-xs text-muted-foreground">{player.primaryInstrument}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {playersInCity.length > 6 && (
                                <p className="text-xs text-muted-foreground">
                                  and {playersInCity.length - 6} more players exploring the city.
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No players are currently registered in this city.
                            </p>
                          )}
                        </section>
                        <Separator />
                        <section className="space-y-3">
                          <h4 className="flex items-center gap-2 text-sm font-semibold">
                            <Calendar className="w-4 h-4 text-rose-500" />
                            Upcoming Gigs
                          </h4>
                          {cityDetailsLoading && !cityDetails ? (
                            <div className="space-y-2">
                              <Skeleton className="h-20 w-full" />
                              <Skeleton className="h-20 w-full" />
                            </div>
                          ) : gigsInCity.length ? (
                            <div className="space-y-2">
                              {gigsInCity.map((gig) => (
                                <div key={gig.id} className="border rounded-lg p-3 space-y-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="text-sm font-semibold">{gig.venue.name}</div>
                                      <p className="text-xs text-muted-foreground">
                                        {gig.venue.location ?? selectedCity.name}
                                      </p>
                                    </div>
                                    <Badge variant="outline" className="text-xs capitalize">
                                      {gig.status.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-4 h-4" />
                                      {new Date(gig.scheduledDate).toLocaleString()}
                                    </span>
                                    {typeof gig.payment === 'number' && (
                                      <span className="flex items-center gap-1">
                                        <DollarSign className="w-4 h-4" />
                                        ${gig.payment.toLocaleString()}
                                      </span>
                                    )}
                                    {typeof gig.venue.capacity === 'number' && (
                                      <span className="flex items-center gap-1">
                                        <Users className="w-4 h-4" />
                                        {gig.venue.capacity.toLocaleString()} cap
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No upcoming gigs scheduled here yet.
                            </p>
                          )}
                        </section>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select a city on the left to explore detailed insights.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Live Game Events</h2>
                <p className="text-sm text-muted-foreground">
                  Join limited-time challenges to earn rewards alongside the community.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshGameEvents()}
                disabled={eventsLoading || eventsRefreshing}
              >
                {eventsRefreshing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Refreshing
                  </>
                ) : (
                  'Refresh'
                )}
              </Button>
            </div>

            {eventsError && (
              <Alert variant="destructive">
                <AlertTitle>Unable to load events</AlertTitle>
                <AlertDescription>{eventsError}</AlertDescription>
              </Alert>
            )}

            {eventsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : liveEvents.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  No live events are active right now. Check back soon!
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {liveEvents.map((event) => {
                  const rewardEntries = formatRewardEntries(event.rewards);
                  const requirementEntries = formatRequirementEntries(event.requirements);
                  const startDate = new Date(event.start_date);
                  const endDate = new Date(event.end_date);
                  const now = Date.now();
                  const isExpired = endDate.getTime() < now;
                  const statusLabel = event.is_active
                    ? 'Active'
                    : isExpired
                      ? 'Completed'
                      : 'Upcoming';
                  const statusVariant = event.is_active
                    ? 'default'
                    : isExpired
                      ? 'outline'
                      : 'secondary';
                  const participantProgress = typeof event.max_participants === 'number'
                    ? Math.min(100, Math.round((event.participantCount / Math.max(event.max_participants, 1)) * 100))
                    : null;
                  const joinDisabled = !event.is_active || event.isUserParticipant || (event.availableSlots !== null && event.availableSlots <= 0);
                  const completionDisabled = !event.isUserParticipant || event.isUserRewardClaimed;

                  return (
                    <Card key={event.id} className="border-primary/40">
                      <CardContent className="space-y-4 p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Music className="h-5 w-5 text-primary" />
                              <h3 className="text-lg font-bold">{event.title}</h3>
                            </div>
                            {event.description && (
                              <p className="text-sm text-muted-foreground">{event.description}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={statusVariant} className="capitalize">
                              {statusLabel}
                            </Badge>
                            {event.isUserParticipant && (
                              <Badge variant={event.isUserRewardClaimed ? 'outline' : 'secondary'}>
                                {event.isUserRewardClaimed ? 'Reward claimed' : 'Joined'}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {startDate.toLocaleString()} – {endDate.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>
                              {event.participantCount}
                              {typeof event.max_participants === 'number'
                                ? ` / ${event.max_participants} participants`
                                : ' participants'}
                            </span>
                          </div>
                        </div>

                        {participantProgress !== null && (
                          <div className="space-y-2">
                            <Progress value={participantProgress} />
                            <p className="text-xs text-muted-foreground">
                              {event.availableSlots === 0
                                ? 'Event is full'
                                : `${event.availableSlots} slots remaining`}
                            </p>
                          </div>
                        )}

                        {requirementEntries.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold">Requirements</h4>
                            <div className="flex flex-wrap gap-2 text-xs">
                              {requirementEntries.map((requirement) => (
                                <Badge key={`${event.id}-requirement-${requirement.key}`} variant="outline">
                                  {requirement.label}: {requirement.value}+
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {rewardEntries.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold">Rewards</h4>
                            <div className="flex flex-wrap gap-2 text-xs">
                              {rewardEntries.map((reward) => (
                                <Badge key={`${event.id}-reward-${reward.key}`} variant="secondary">
                                  {reward.label}: {reward.value > 0 ? '+' : ''}{reward.value}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <Button
                            size="sm"
                            onClick={() => void handleJoinGameEvent(event)}
                            disabled={joinDisabled || joiningEventId === event.id}
                          >
                            {joiningEventId === event.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Joining...
                              </>
                            ) : (
                              'Join Event'
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleCompleteGameEvent(event)}
                            disabled={completionDisabled || completingEventId === event.id}
                          >
                            {event.isUserRewardClaimed ? (
                              'Rewards claimed'
                            ) : completingEventId === event.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Claiming...
                              </>
                            ) : (
                              'Complete Event'
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">World Simulation Events</h2>
              <p className="text-sm text-muted-foreground">
                These global conditions influence demand, rewards, and tour planning across the world.
              </p>
            </div>
            {worldEvents.map((event) => (
              <Card key={event.id} className={event.is_active ? 'border-green-500' : 'border-gray-300'}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getEventTypeIcon(event.type)}
                      <div>
                        <h3 className="text-lg font-bold">{event.title}</h3>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      </div>
                    </div>
                    <Badge variant={event.is_active ? "default" : "secondary"}>
                      {event.is_active ? "Active" : "Upcoming"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Duration</div>
                      <div className="font-medium">
                        {new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Affected Areas</div>
                      <div className="font-medium">
                        {event.affected_cities.includes('all') ? 'Global' : event.affected_cities.join(', ')}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Participation Reward</div>
                      <div className="font-medium text-green-600">
                        ${event.participation_reward.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-sm font-medium mb-2">Global Effects:</div>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(event.global_effects).map(([key, value]) => (
                        <div key={key} className={`p-2 rounded text-center text-sm ${
                          value > 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          <div className="font-medium">{key.replace('_', ' ')}</div>
                          <div>{value > 1 ? '+' : ''}{Math.round((value - 1) * 100)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {event.is_active && event.participation_reward > 0 && (
                    <Button onClick={() => void participateInWorldEvent(event.id)} className="w-full">
                      Participate in Event
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="random" className="space-y-6">
          <div className="space-y-4">
            {randomEvents.map((event) => (
              <Card key={event.id} className={getRarityColor(event.rarity)}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold">{event.title}</h3>
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {event.rarity}
                    </Badge>
                  </div>

                  <div className="text-sm text-muted-foreground mb-4">
                    Expires: {new Date(event.expiry).toLocaleString()}
                  </div>

                  <div className="space-y-3">
                    {event.choices.map((choice) => (
                      <div key={choice.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{choice.text}</span>
                          {choice.requirements && (
                            <Badge variant="outline" className="text-xs">
                              Level {choice.requirements.level}+ required
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          Effects: {Object.entries(choice.effects).map(([key, value]) => 
                            `${key}: ${value > 0 ? '+' : ''}${value}`
                          ).join(', ')}
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => handleRandomEventChoice(event.id, choice.id)}
                          disabled={choice.requirements?.level && profile && profile.level < choice.requirements.level}
                        >
                          Choose
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="economics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <div className="text-2xl font-bold">+3.2%</div>
                <div className="text-sm text-muted-foreground">Global Music Market</div>
                <div className="text-xs text-green-600">Growing</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <div className="text-2xl font-bold">87%</div>
                <div className="text-sm text-muted-foreground">Streaming Revenue</div>
                <div className="text-xs text-blue-600">Market Share</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <div className="text-2xl font-bold">2.1B</div>
                <div className="text-sm text-muted-foreground">Active Listeners</div>
                <div className="text-xs text-purple-600">Worldwide</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Building className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                <div className="text-2xl font-bold">15,420</div>
                <div className="text-sm text-muted-foreground">Active Venues</div>
                <div className="text-xs text-orange-600">Globally</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Economic Trends</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">Positive Trends</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Streaming platform competition increasing royalty rates</li>
                  <li>• Live music venues reopening post-pandemic</li>
                  <li>• New markets emerging in developing countries</li>
                  <li>• Virtual concert technology creating new revenue streams</li>
                </ul>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">Market Challenges</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Rising costs of touring and equipment</li>
                  <li>• Increased competition from AI-generated music</li>
                  <li>• Economic uncertainty affecting consumer spending</li>
                  <li>• Platform algorithm changes impacting discoverability</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorldEnvironment;