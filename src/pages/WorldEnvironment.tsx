import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useGameData } from '@/hooks/useGameData';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
  Sparkles,
  Globe,
  Mountain,
  Building,
  Users,
  TrendingUp,
  DollarSign,
  Music,
  Thermometer
} from 'lucide-react';

const REFRESH_INTERVAL = 60_000;

const WEATHER_CONDITIONS: WeatherCondition['condition'][] = ['sunny', 'cloudy', 'rainy', 'stormy', 'snowy'];
const WORLD_EVENT_TYPES: WorldEvent['type'][] = ['festival', 'competition', 'disaster', 'celebration', 'economic'];
const RANDOM_EVENT_RARITIES: RandomEvent['rarity'][] = ['common', 'rare', 'epic', 'legendary'];

const parseNumericRecord = (record: Record<string, unknown> | null | undefined) => {
  if (!record || typeof record !== 'object') {
    return {} as Record<string, number>;
  }

  return Object.entries(record).reduce<Record<string, number>>((acc, [key, value]) => {
    if (typeof value === 'number') {
      acc[key] = value;
      return acc;
    }

    const numericValue = Number(value);
    if (!Number.isNaN(numericValue)) {
      acc[key] = numericValue;
    }
    return acc;
  }, {});
};

const toNumber = (value: unknown, defaultValue = 0) => {
  if (typeof value === 'number') {
    return value;
  }

  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? defaultValue : numericValue;
};

interface WeatherCondition {
  id: string;
  city: string;
  country: string;
  temperature: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy';
  humidity: number;
  wind_speed: number;
  effects: {
    gig_attendance: number;
    travel_cost: number;
    mood_modifier: number;
    equipment_risk: number;
  };
}

interface City {
  id: string;
  name: string;
  country: string;
  population: number;
  music_scene: number;
  cost_of_living: number;
  dominant_genre: string;
  venues: number;
  local_bonus: number;
  cultural_events: string[];
}

interface WorldEvent {
  id: string;
  title: string;
  description: string;
  type: 'festival' | 'competition' | 'disaster' | 'celebration' | 'economic';
  start_date: string;
  end_date: string;
  affected_cities: string[];
  global_effects: Record<string, number>;
  participation_reward: number;
  is_active: boolean;
}

interface RandomEvent {
  id: string;
  title: string;
  description: string;
  choices: {
    id: string;
    text: string;
    effects: Record<string, number>;
    requirements?: Record<string, number>;
  }[];
  expiry: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

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

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadWorldData = useCallback(async (showLoader: boolean = true) => {
    if (!user) {
      return;
    }

    try {
      if (showLoader && isMountedRef.current) {
        setLoading(true);
      }

      const [
        weatherResponse,
        citiesResponse,
        worldEventsResponse,
        randomEventsResponse
      ] = await Promise.all([
        supabase.from('weather').select('*').order('city', { ascending: true }),
        supabase.from('cities').select('*').order('name', { ascending: true }),
        supabase.from('world_events').select('*').order('start_date', { ascending: true }),
        supabase.from('random_events').select('*').order('expiry', { ascending: true })
      ]);

      if (weatherResponse.error) throw weatherResponse.error;
      if (citiesResponse.error) throw citiesResponse.error;
      if (worldEventsResponse.error) throw worldEventsResponse.error;
      if (randomEventsResponse.error) throw randomEventsResponse.error;

      if (!isMountedRef.current) {
        return;
      }

      const normalizedWeather: WeatherCondition[] = (weatherResponse.data || []).map((item: Record<string, unknown>) => {
        const conditionValue = typeof item.condition === 'string' && WEATHER_CONDITIONS.includes(item.condition as WeatherCondition['condition'])
          ? (item.condition as WeatherCondition['condition'])
          : 'sunny';

        const effectsData = parseNumericRecord(item.effects as Record<string, unknown> | null | undefined);
        const temperatureValue = toNumber(item.temperature);
        const humidityValue = toNumber(item.humidity);
        const windSpeedValue = toNumber(item.wind_speed);

        return {
          id: String(item.id),
          city: typeof item.city === 'string' ? item.city : 'Unknown',
          country: typeof item.country === 'string' ? item.country : '',
          temperature: Number.isNaN(temperatureValue) ? 0 : temperatureValue,
          condition: conditionValue,
          humidity: Number.isNaN(humidityValue) ? 0 : humidityValue,
          wind_speed: Number.isNaN(windSpeedValue) ? 0 : windSpeedValue,
          effects: {
            gig_attendance: effectsData.gig_attendance ?? 1,
            travel_cost: effectsData.travel_cost ?? 1,
            mood_modifier: effectsData.mood_modifier ?? 1,
            equipment_risk: effectsData.equipment_risk ?? 1,
          },
        };
      });

      const normalizedCities: City[] = (citiesResponse.data || []).map((item: Record<string, unknown>) => ({
        id: String(item.id),
        name: typeof item.name === 'string' ? item.name : 'Unknown',
        country: typeof item.country === 'string' ? item.country : '',
        population: toNumber(item.population),
        music_scene: toNumber(item.music_scene),
        cost_of_living: toNumber(item.cost_of_living),
        dominant_genre: typeof item.dominant_genre === 'string' ? item.dominant_genre : '',
        venues: toNumber(item.venues),
        local_bonus: toNumber(item.local_bonus, 1),
        cultural_events: Array.isArray(item.cultural_events)
          ? item.cultural_events.filter((event: unknown): event is string => typeof event === 'string')
          : [],
      }));

      const normalizedWorldEvents: WorldEvent[] = (worldEventsResponse.data || []).map((item: Record<string, unknown>) => {
        const typeValue = typeof item.type === 'string' && WORLD_EVENT_TYPES.includes(item.type as WorldEvent['type'])
          ? (item.type as WorldEvent['type'])
          : 'festival';

        const globalEffects = parseNumericRecord(item.global_effects as Record<string, unknown> | null | undefined);
        const affectedCities = Array.isArray(item.affected_cities)
          ? item.affected_cities.filter((city: unknown): city is string => typeof city === 'string')
          : [];

        const startDate = typeof item.start_date === 'string' ? item.start_date : new Date().toISOString();
        const endDate = typeof item.end_date === 'string' ? item.end_date : startDate;

        const title = typeof item.title === 'string' ? item.title : 'Global Event';
        const description = typeof item.description === 'string' ? item.description : '';
        const participationRewardValue = toNumber(item.participation_reward);

        return {
          id: String(item.id),
          title,
          description,
          type: typeValue,
          start_date: startDate,
          end_date: endDate,
          affected_cities: affectedCities,
          global_effects: globalEffects,
          participation_reward: participationRewardValue,
          is_active: Boolean(item.is_active),
        };
      }).sort((a, b) => {
        const startA = Date.parse(a.start_date);
        const startB = Date.parse(b.start_date);
        if (Number.isNaN(startA) || Number.isNaN(startB)) {
          return 0;
        }
        return startA - startB;
      });

      const now = Date.now();
      const normalizedRandomEvents: RandomEvent[] = (randomEventsResponse.data || [])
        .map((item: Record<string, unknown>) => {
          const rarityValue = typeof item.rarity === 'string' && RANDOM_EVENT_RARITIES.includes(item.rarity as RandomEvent['rarity'])
            ? (item.rarity as RandomEvent['rarity'])
            : 'common';

          const expiry = typeof item.expiry === 'string'
            ? item.expiry
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

          const choicesRaw = Array.isArray(item.choices) ? item.choices : [];
          const choices = choicesRaw
            .map((choice: Record<string, unknown>, index: number) => {
              const choiceRecord = choice as Record<string, unknown>;
              const effects = parseNumericRecord(choiceRecord.effects as Record<string, unknown> | null | undefined);
              const requirements = parseNumericRecord(choiceRecord.requirements as Record<string, unknown> | null | undefined);

              const choiceText = choiceRecord.text;
              if (typeof choiceText !== 'string' || !choiceText.trim()) {
                return null;
              }

              const choiceIdValue = choiceRecord.id;

              return {
                id: String(choiceIdValue ?? `${item.id}-choice-${index}`),
                text: choiceText,
                effects,
                requirements: Object.keys(requirements).length > 0 ? requirements : undefined,
              };
            })
            .filter((choice): choice is RandomEvent['choices'][number] => Boolean(choice));

          const title = typeof item.title === 'string' ? item.title : 'Random Event';
          const description = typeof item.description === 'string' ? item.description : '';

          return {
            id: String(item.id),
            title,
            description,
            choices,
            expiry,
            rarity: rarityValue,
          };
        })
        .filter((event) => {
          const expiryTime = Date.parse(event.expiry);
          if (Number.isNaN(expiryTime)) {
            return true;
          }
          return expiryTime > now;
        })
        .sort((a, b) => {
          const expiryA = Date.parse(a.expiry);
          const expiryB = Date.parse(b.expiry);
          if (Number.isNaN(expiryA) || Number.isNaN(expiryB)) {
            return 0;
          }
          return expiryA - expiryB;
        });

      setWeather(normalizedWeather);
      setCities(normalizedCities);
      setWorldEvents(normalizedWorldEvents);
      setRandomEvents(normalizedRandomEvents);
      setSelectedCity((current) => {
        if (!normalizedCities.length) {
          return null;
        }

        if (current) {
          const existing = normalizedCities.find((city) => city.id === current.id);
          return existing ?? normalizedCities[0];
        }

        return normalizedCities[0];
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
      case 'celebration': return <Sparkles className="w-5 h-5 text-yellow-500" />;
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {cities.map((city) => (
              <Card key={city.id} className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedCity(city)}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold">{city.name}</h3>
                      <p className="text-sm text-muted-foreground">{city.country}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">Music Scene</div>
                      <div className="text-2xl font-bold text-primary">{city.music_scene}%</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Population</div>
                      <div className="font-medium">{(city.population / 1000000).toFixed(1)}M</div>
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

                  <div className="mt-4">
                    <div className="text-sm font-medium mb-2">Cultural Events:</div>
                    <div className="flex flex-wrap gap-1">
                      {city.cultural_events.map((event, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <div className="space-y-4">
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
                    <Button onClick={() => participateInWorldEvent(event.id)} className="w-full">
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