import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth-context';
import { useGameData } from '@/hooks/useGameData';
import { useGameEvents, type GameEventWithStatus } from '@/hooks/useGameEvents';
import { toast } from '@/components/ui/sonner-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchWorldEnvironmentSnapshot,
  type WeatherCondition,
  type City,
  type WorldEvent,
  type RandomEvent,
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
  Loader2
} from 'lucide-react';

const REFRESH_INTERVAL = 60_000;

const WorldEnvironment: React.FC = () => {
  const { user } = useAuth();
  const { profile, updateProfile, addActivity } = useGameData();
  const [weather, setWeather] = useState<WeatherCondition[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [worldEvents, setWorldEvents] = useState<WorldEvent[]>([]);
  const [randomEvents, setRandomEvents] = useState<RandomEvent[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(false);

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
  }, [user]);

  useEffect(() => {
    if (!user) {
      setWeather([]);
      setCities([]);
      setWorldEvents([]);
      setRandomEvents([]);
      setSelectedCity(null);
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
          <div className="grid grid-cols-1 xl:grid-cols-[2fr,1fr] gap-6 items-start">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {cities.map((city) => {
                const isSelected = selectedCity?.id === city.id;
                const signatureDistricts = city.locations.slice(0, 2);

                return (
                  <Card
                    key={city.id}
                    className={`cursor-pointer transition-shadow ${
                      isSelected ? 'border-primary shadow-lg' : 'hover:shadow-lg'
                    }`}
                    onClick={() => setSelectedCity(city)}
                  >
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold">{city.name}</h3>
                          <p className="text-sm text-muted-foreground">{city.country}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">Music Scene</div>
                          <div className="text-2xl font-bold text-primary">{city.music_scene}%</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Population</div>
                          <div className="font-medium">{(city.population / 1_000_000).toFixed(1)}M</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Venues</div>
                          <div className="font-medium">{city.venues}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Genre</div>
                          <div className="font-medium">{city.dominant_genre}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Local Bonus</div>
                          <div className="font-medium text-green-600">{city.local_bonus}x</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground mb-2">Cost of Living</div>
                        <Progress value={city.cost_of_living} className="h-2" />
                        <div className="text-xs text-muted-foreground mt-1">{city.cost_of_living}% of global average</div>
                      </div>

                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>
                            <span className="font-medium text-foreground">{city.famousResident}</span> is the resident icon
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>
                            Travel hub: <span className="font-medium text-foreground">{city.travelHub || 'Multiple hubs'}</span>
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium mb-2">Cultural Events</div>
                        <div className="flex flex-wrap gap-1">
                          {city.cultural_events.map((event, index) => (
                            <Badge key={`${city.id}-event-${index}`} variant="outline" className="text-xs">
                              {event}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {signatureDistricts.length > 0 && (
                        <div>
                          <div className="text-sm font-medium mb-2">Signature Districts</div>
                          <div className="space-y-2">
                            {signatureDistricts.map((district) => (
                              <div key={`${city.id}-${district.name}`} className="border rounded-lg p-3 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold">{district.name}</span>
                                  {typeof district.averageTicketPrice === 'number' && (
                                    <Badge variant="outline" className="text-xs">
                                      ~${district.averageTicketPrice}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{district.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {selectedCity && (
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Explore {selectedCity.name}</CardTitle>
                  {selectedCity.description && (
                    <p className="text-sm text-muted-foreground">{selectedCity.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>
                        Famous resident: <span className="font-medium text-foreground">{selectedCity.famousResident}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>
                        Travel hub: <span className="font-medium text-foreground">{selectedCity.travelHub || 'Multiple hubs'}</span>
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Cultural Events</div>
                    {selectedCity.cultural_events.length ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedCity.cultural_events.map((event, index) => (
                          <Badge key={`${selectedCity.id}-detail-event-${index}`} variant="secondary" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No cultural events recorded yet.</p>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Intra-city Highlights</div>
                    {selectedCity.locations.length ? (
                      <div className="space-y-3">
                        {selectedCity.locations.map((location) => (
                          <div key={`${selectedCity.id}-${location.name}`} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{location.name}</span>
                              {typeof location.averageTicketPrice === 'number' && (
                                <Badge variant="outline" className="text-xs">
                                  ~${location.averageTicketPrice}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{location.description}</p>
                            {location.vibe && (
                              <div className="text-xs text-muted-foreground italic">Vibe: {location.vibe}</div>
                            )}
                            {location.highlights.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {location.highlights.map((highlight, index) => (
                                  <Badge key={`${location.name}-${index}`} variant="outline" className="text-xs">
                                    {highlight}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {location.signatureVenue && (
                              <div className="text-xs text-muted-foreground">
                                Signature venue:{' '}
                                <span className="font-medium text-foreground">{location.signatureVenue}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No district data available.</p>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Travel Options</div>
                    {selectedCity.travelOptions.length ? (
                      <div className="space-y-3">
                        {selectedCity.travelOptions.map((option) => (
                          <div key={`${selectedCity.id}-${option.mode}-${option.name}`} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs capitalize">{option.label}</Badge>
                                <span className="font-medium">{option.name}</span>
                              </div>
                              {typeof option.averageCost === 'number' && (
                                <span className="text-xs text-muted-foreground">Avg cost: ${option.averageCost}</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              {typeof option.durationMinutes === 'number' && (
                                <span>Duration: {option.durationMinutes} min</span>
                              )}
                              {option.frequency && <span>Frequency: {option.frequency}</span>}
                              {option.connectsTo.length > 0 && (
                                <span>Connects to: {option.connectsTo.join(', ')}</span>
                              )}
                            </div>
                            {option.comfort && (
                              <div className="text-[11px] text-muted-foreground">Comfort: {option.comfort}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Travel data coming soon.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
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