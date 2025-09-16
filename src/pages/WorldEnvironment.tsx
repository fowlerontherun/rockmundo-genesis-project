import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useGameData } from '@/hooks/useGameData';
import { toast } from 'sonner';
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

  useEffect(() => {
    if (user) {
      loadWorldData();
    }
  }, [user]);

  const loadWorldData = async () => {
    try {
      setLoading(true);
      
      // Load weather conditions
      const weatherData: WeatherCondition[] = [
        {
          id: '1',
          city: 'New York',
          country: 'USA',
          temperature: 22,
          condition: 'sunny',
          humidity: 65,
          wind_speed: 12,
          effects: { gig_attendance: 1.1, travel_cost: 1.0, mood_modifier: 1.05, equipment_risk: 0.9 }
        },
        {
          id: '2',
          city: 'London',
          country: 'UK',
          temperature: 15,
          condition: 'cloudy',
          humidity: 78,
          wind_speed: 18,
          effects: { gig_attendance: 0.95, travel_cost: 1.1, mood_modifier: 0.98, equipment_risk: 1.0 }
        },
        {
          id: '3',
          city: 'Tokyo',
          country: 'Japan',
          temperature: 28,
          condition: 'rainy',
          humidity: 85,
          wind_speed: 8,
          effects: { gig_attendance: 0.8, travel_cost: 1.3, mood_modifier: 0.9, equipment_risk: 1.4 }
        },
        {
          id: '4',
          city: 'Los Angeles',
          country: 'USA',
          temperature: 26,
          condition: 'sunny',
          humidity: 55,
          wind_speed: 10,
          effects: { gig_attendance: 1.15, travel_cost: 0.9, mood_modifier: 1.1, equipment_risk: 0.8 }
        },
        {
          id: '5',
          city: 'Berlin',
          country: 'Germany',
          temperature: 12,
          condition: 'stormy',
          humidity: 82,
          wind_speed: 25,
          effects: { gig_attendance: 0.7, travel_cost: 1.5, mood_modifier: 0.85, equipment_risk: 1.6 }
        }
      ];
      setWeather(weatherData);

      // Load cities
      const citiesData: City[] = [
        {
          id: '1',
          name: 'Nashville',
          country: 'USA',
          population: 2200000,
          music_scene: 95,
          cost_of_living: 110,
          dominant_genre: 'Country',
          venues: 180,
          local_bonus: 1.3,
          cultural_events: ['Country Music Awards', 'Music City Festival', 'Songwriter Showcase']
        },
        {
          id: '2',
          name: 'Austin',
          country: 'USA',
          population: 2300000,
          music_scene: 92,
          cost_of_living: 105,
          dominant_genre: 'Alternative Rock',
          venues: 165,
          local_bonus: 1.25,
          cultural_events: ['SXSW', 'Austin City Limits', 'Local Music Venues Tour']
        },
        {
          id: '3',
          name: 'Liverpool',
          country: 'UK',
          population: 900000,
          music_scene: 88,
          cost_of_living: 95,
          dominant_genre: 'Rock',
          venues: 120,
          local_bonus: 1.4,
          cultural_events: ['Beatles Festival', 'Mersey Beat Revival', 'Cavern Club Sessions']
        },
        {
          id: '4',
          name: 'Berlin',
          country: 'Germany',
          population: 3600000,
          music_scene: 90,
          cost_of_living: 85,
          dominant_genre: 'Electronic',
          venues: 200,
          local_bonus: 1.2,
          cultural_events: ['Love Parade', 'Techno Underground', 'Electronic Music Conference']
        },
        {
          id: '5',
          name: 'São Paulo',
          country: 'Brazil',
          population: 22400000,
          music_scene: 85,
          cost_of_living: 65,
          dominant_genre: 'Latin',
          venues: 300,
          local_bonus: 1.1,
          cultural_events: ['Carnival', 'Rock in Rio', 'Brazilian Music Festival']
        }
      ];
      setCities(citiesData);

      // Load world events
      const eventsData: WorldEvent[] = [
        {
          id: '1',
          title: 'Global Music Unity Festival',
          description: 'A worldwide celebration of music bringing together artists from all genres',
          type: 'festival',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          affected_cities: ['all'],
          global_effects: { fan_gain: 1.5, experience: 1.3, gig_payment: 1.2 },
          participation_reward: 10000,
          is_active: true
        },
        {
          id: '2',
          title: 'Economic Recession',
          description: 'Global economic downturn affecting the music industry',
          type: 'economic',
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
          affected_cities: ['all'],
          global_effects: { gig_payment: 0.8, equipment_cost: 1.2, venue_availability: 0.9 },
          participation_reward: 0,
          is_active: true
        },
        {
          id: '3',
          title: 'Streaming Platform Wars',
          description: 'Major streaming services compete for exclusive content',
          type: 'competition',
          start_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000).toISOString(),
          affected_cities: ['all'],
          global_effects: { streaming_revenue: 1.8, chart_competition: 1.4 },
          participation_reward: 25000,
          is_active: false
        }
      ];
      setWorldEvents(eventsData);

      // Load random events
      const randomEventsData: RandomEvent[] = [
        {
          id: '1',
          title: 'Mysterious Talent Scout',
          description: 'A mysterious talent scout approaches you with an unusual offer...',
          choices: [
            {
              id: 'accept',
              text: 'Accept the mysterious contract',
              effects: { fame: 500, cash: -2000, experience: 300 },
              requirements: { level: 10 }
            },
            {
              id: 'investigate',
              text: 'Investigate the scout first',
              effects: { cash: -500, fame: 100 }
            },
            {
              id: 'decline',
              text: 'Politely decline',
              effects: { cash: 1000 }
            }
          ],
          expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          rarity: 'rare'
        }
      ];
      setRandomEvents(randomEventsData);

    } catch (error: any) {
      console.error('Error loading world data:', error);
      toast.error('Failed to load world data');
    } finally {
      setLoading(false);
    }
  };

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
    const event = randomEvents.find(e => e.id === eventId);
    const choice = event?.choices.find(c => c.id === choiceId);
    
    if (!event || !choice || !profile) return;

    // Check requirements
    if (choice.requirements) {
      const meetsRequirements = Object.entries(choice.requirements).every(([key, value]) => {
        if (key === 'level') return profile.level >= value;
        return true;
      });

      if (!meetsRequirements) {
        toast.error('You don\'t meet the requirements for this choice');
        return;
      }
    }

    try {
      // Apply effects
      const updates: any = {};
      if (choice.effects.cash) updates.cash = profile.cash + choice.effects.cash;
      if (choice.effects.fame) updates.fame = profile.fame + choice.effects.fame;
      if (choice.effects.experience) updates.experience = profile.experience + choice.effects.experience;

      await updateProfile(updates);
      
      await addActivity(
        'random_event',
        `${event.title}: ${choice.text}`,
        choice.effects.cash || 0
      );

      // Remove the event
      setRandomEvents(prev => prev.filter(e => e.id !== eventId));
      
      toast.success(`Event completed: ${choice.text}`);
    } catch (error: any) {
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
    } catch (error: any) {
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