import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import { toast } from '@/components/ui/sonner-toast';
import {
  Users,
  BarChart3,
  AlertTriangle,
  Shield,
  Database,
  Activity,
  Globe,
  Zap,
  DollarSign,
  Music,
  Calendar,
  Flag,
  Ban,
  Eye,
  RefreshCw,
  Building2,
  MapPin,
  ShoppingBag,
  SparklesIcon
} from 'lucide-react';

interface SystemMetrics {
  total_users: number;
  active_users_24h: number;
  total_bands: number;
  total_gigs_today: number;
  total_revenue_24h: number;
  server_uptime: string;
  database_size: string;
  active_sessions: number;
}

interface FeatureFlag {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  category: string | null;
}

interface UserAction {
  id: string;
  user_id: string | null;
  username: string | null;
  action: string;
  details: string | null;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface SeasonConfig {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  multipliers: Record<string, number>;
  active: boolean;
}

interface NewSeasonForm {
  name: string;
  start_date: string;
  end_date: string;
  multipliers: string;
  active: boolean;
}

interface City {
  id: string;
  name: string;
  country: string;
  description: string | null;
  bonuses: string | null;
  unlocked: boolean;
}

interface CityFormData {
  name: string;
  country: string;
  description: string;
  bonuses: string;
  unlocked: boolean;
}

interface Location {
  id: string;
  name: string;
  city_id: string;
  location_type: string | null;
  description: string | null;
  bonuses: string | null;
  is_featured: boolean;
}

interface LocationFormData {
  name: string;
  city_id: string;
  location_type: string;
  description: string;
  bonuses: string;
  is_featured: boolean;
}

interface Shop {
  id: string;
  name: string;
  city_id: string;
  description: string | null;
  inventory: string | null;
  currency: string | null;
  is_open: boolean;
}

interface ShopFormData {
  name: string;
  city_id: string;
  description: string;
  inventory: string;
  currency: string;
  is_open: boolean;
}

interface SpecialItem {
  id: string;
  name: string;
  rarity: string | null;
  effect: string | null;
  description: string | null;
  cost: number | null;
  is_limited: boolean;
}

interface SpecialItemFormData {
  name: string;
  rarity: string;
  effect: string;
  description: string;
  cost: string;
  isLimited: boolean;
}

const USER_ACTIONS_PAGE_SIZE = 10;

type FeatureFlagRecord = {
  id: string;
  name: string;
  description?: string | null;
  enabled?: boolean | null;
  category?: string | null;
};

type SeasonRecord = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  multipliers?: Record<string, number> | null;
  active?: boolean | null;
};

type UserActionRecord = {
  id: string;
  user_id?: string | null;
  username?: string | null;
  action?: string | null;
  details?: string | null;
  timestamp?: string | null;
  created_at?: string | null;
  severity?: string | null;
};

type CityRecord = {
  id: string;
  name?: string | null;
  country?: string | null;
  description?: string | null;
  bonuses?: string | null;
  unlocked?: boolean | null;
};

type LocationRecord = {
  id: string;
  name?: string | null;
  city_id?: string | null;
  location_type?: string | null;
  description?: string | null;
  bonuses?: string | null;
  is_featured?: boolean | null;
};

type ShopRecord = {
  id: string;
  name?: string | null;
  city_id?: string | null;
  description?: string | null;
  inventory?: string | null;
  currency?: string | null;
  is_open?: boolean | null;
};

type SpecialItemRecord = {
  id: string;
  name?: string | null;
  rarity?: string | null;
  effect?: string | null;
  description?: string | null;
  cost?: number | null;
  is_limited?: boolean | null;
};

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [userActions, setUserActions] = useState<UserAction[]>([]);
  const [seasons, setSeasons] = useState<SeasonConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState('');
  const [banReason, setBanReason] = useState('');
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    type: 'tournament',
    start_date: '',
    end_date: '',
    rewards: ''
  });
  const [userActionsPage, setUserActionsPage] = useState(0);
  const [userActionsTotal, setUserActionsTotal] = useState(0);
  const [userActionsLoading, setUserActionsLoading] = useState(false);
  const [userActionsHasMore, setUserActionsHasMore] = useState(false);
  const [userActionsTotalKnown, setUserActionsTotalKnown] = useState(true);
  const [updatingFlagId, setUpdatingFlagId] = useState<string | null>(null);
  const [banningUser, setBanningUser] = useState(false);
  const [creatingSeason, setCreatingSeason] = useState(false);
  const [newSeason, setNewSeason] = useState<NewSeasonForm>({
    name: '',
    start_date: '',
    end_date: '',
    multipliers: '',
    active: false
  });
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [cityForm, setCityForm] = useState<CityFormData>({
    name: '',
    country: '',
    description: '',
    bonuses: '',
    unlocked: false
  });
  const [editingCityId, setEditingCityId] = useState<string | null>(null);
  const [citySaving, setCitySaving] = useState(false);
  const [deletingCityId, setDeletingCityId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationForm, setLocationForm] = useState<LocationFormData>({
    name: '',
    city_id: '',
    location_type: '',
    description: '',
    bonuses: '',
    is_featured: false
  });
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locationSaving, setLocationSaving] = useState(false);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopForm, setShopForm] = useState<ShopFormData>({
    name: '',
    city_id: '',
    description: '',
    inventory: '',
    currency: '',
    is_open: false
  });
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [shopSaving, setShopSaving] = useState(false);
  const [deletingShopId, setDeletingShopId] = useState<string | null>(null);
  const [specialItems, setSpecialItems] = useState<SpecialItem[]>([]);
  const [specialItemsLoading, setSpecialItemsLoading] = useState(false);
  const [specialItemForm, setSpecialItemForm] = useState<SpecialItemFormData>({
    name: '',
    rarity: '',
    effect: '',
    description: '',
    cost: '',
    isLimited: false
  });
  const [editingSpecialItemId, setEditingSpecialItemId] = useState<string | null>(null);
  const [specialItemSaving, setSpecialItemSaving] = useState(false);
  const [deletingSpecialItemId, setDeletingSpecialItemId] = useState<string | null>(null);

  const fetchFeatureFlags = useCallback(async () => {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    const normalizedFlags = (data ?? []).map((flag: FeatureFlagRecord) => ({
      id: flag.id,
      name: flag.name,
      description: flag.description ?? null,
      enabled: Boolean(flag.enabled),
      category: flag.category ?? null
    })) as FeatureFlag[];

    setFeatureFlags(normalizedFlags);
  }, []);

  const fetchSeasons = useCallback(async () => {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      throw error;
    }

    const normalizedSeasons = (data ?? []).map((season: SeasonRecord) => ({
      id: season.id,
      name: season.name,
      start_date: season.start_date,
      end_date: season.end_date,
      multipliers: (season.multipliers as Record<string, number> | null) ?? {},
      active: Boolean(season.active)
    })) as SeasonConfig[];

    setSeasons(normalizedSeasons);
  }, []);

  const fetchUserActions = useCallback(async (page: number) => {
    setUserActionsLoading(true);

    try {
      const from = page * USER_ACTIONS_PAGE_SIZE;
      const to = from + USER_ACTIONS_PAGE_SIZE - 1;

      let result = await supabase
        .from('user_actions')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false })
        .range(from, to);

      if (result.error && result.error.message?.toLowerCase().includes('timestamp')) {
        result = await supabase
          .from('user_actions')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);
      }

      if (result.error) {
        throw result.error;
      }

      const normalizedActions = (result.data ?? []).map((action: UserActionRecord) => ({
        id: action.id,
        user_id: action.user_id ?? null,
        username: action.username ?? null,
        action: action.action ?? '',
        details: action.details ?? null,
        timestamp: action.timestamp ?? action.created_at ?? new Date().toISOString(),
        severity: (action.severity ?? 'low') as UserAction['severity'],
      })) as UserAction[];

      const totalCount = result.count ?? normalizedActions.length;

      setUserActions(normalizedActions);
      setUserActionsTotal(totalCount);
      setUserActionsTotalKnown(result.count !== null && result.count !== undefined);
      setUserActionsHasMore(
        result.count === null
          ? normalizedActions.length === USER_ACTIONS_PAGE_SIZE
          : (page + 1) * USER_ACTIONS_PAGE_SIZE < totalCount
      );
      setUserActionsPage(page);
    } finally {
      setUserActionsLoading(false);
    }
  }, []);

  const fetchCities = useCallback(async () => {
    setCitiesLoading(true);

    try {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      const normalizedCities = (data ?? []).map((city: CityRecord) => ({
        id: city.id,
        name: city.name ?? '',
        country: city.country ?? '',
        description: city.description ?? null,
        bonuses: city.bonuses ?? null,
        unlocked: Boolean(city.unlocked)
      })) as City[];

      setCities(normalizedCities);
    } catch (error) {
      console.error('Error fetching cities:', error);
      throw error;
    } finally {
      setCitiesLoading(false);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    setLocationsLoading(true);

    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      const normalizedLocations = (data ?? []).map((location: LocationRecord) => ({
        id: location.id,
        name: location.name ?? '',
        city_id: location.city_id ?? '',
        location_type: location.location_type ?? null,
        description: location.description ?? null,
        bonuses: location.bonuses ?? null,
        is_featured: Boolean(location.is_featured)
      })) as Location[];

      setLocations(normalizedLocations);
    } catch (error) {
      console.error('Error fetching locations:', error);
      throw error;
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  const fetchShops = useCallback(async () => {
    setShopsLoading(true);

    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      const normalizedShops = (data ?? []).map((shop: ShopRecord) => ({
        id: shop.id,
        name: shop.name ?? '',
        city_id: shop.city_id ?? '',
        description: shop.description ?? null,
        inventory: shop.inventory ?? null,
        currency: shop.currency ?? null,
        is_open: Boolean(shop.is_open)
      })) as Shop[];

      setShops(normalizedShops);
    } catch (error) {
      console.error('Error fetching shops:', error);
      throw error;
    } finally {
      setShopsLoading(false);
    }
  }, []);

  const fetchSpecialItems = useCallback(async () => {
    setSpecialItemsLoading(true);

    try {
      const { data, error } = await supabase
        .from('special_items')
        .select('*')
        .order('rarity', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      const normalizedItems = (data ?? []).map((item: SpecialItemRecord) => ({
        id: item.id,
        name: item.name ?? '',
        rarity: item.rarity ?? null,
        effect: item.effect ?? null,
        description: item.description ?? null,
        cost: typeof item.cost === 'number' ? item.cost : null,
        is_limited: Boolean(item.is_limited)
      })) as SpecialItem[];

      setSpecialItems(normalizedItems);
    } catch (error) {
      console.error('Error fetching special items:', error);
      throw error;
    } finally {
      setSpecialItemsLoading(false);
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);

      const metricsData: SystemMetrics = {
        total_users: 1247,
        active_users_24h: 156,
        total_bands: 423,
        total_gigs_today: 28,
        total_revenue_24h: 15420,
        server_uptime: '7d 14h 32m',
        database_size: '2.4 GB',
        active_sessions: 89
      };
      setMetrics(metricsData);

      const tasks = [
        { name: 'feature flags', promise: fetchFeatureFlags() },
        { name: 'seasons', promise: fetchSeasons() },
        { name: 'user actions', promise: fetchUserActions(0) },
        { name: 'cities', promise: fetchCities() },
        { name: 'locations', promise: fetchLocations() },
        { name: 'shops', promise: fetchShops() },
        { name: 'special items', promise: fetchSpecialItems() }
      ];

      const results = await Promise.allSettled(tasks.map(task => task.promise));
      const failures = results
        .map((result, index) => ({ result, name: tasks[index].name }))
        .filter((item): item is { result: PromiseRejectedResult; name: string } => item.result.status === 'rejected');

      if (failures.length > 0) {
        failures.forEach((failure) => {
          console.error(`Error loading ${failure.name}:`, failure.result.reason);
        });
        const failureNames = failures.map((failure) => failure.name).join(', ');
        toast.error(`Failed to load ${failureNames}. Please try again.`);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [
    fetchFeatureFlags,
    fetchSeasons,
    fetchUserActions,
    fetchCities,
    fetchLocations,
    fetchShops,
    fetchSpecialItems
  ]);

  const toggleFeatureFlag = async (flagId: string, newValue: boolean) => {
    const previousFlags = featureFlags.map(flag => ({ ...flag }));

    setUpdatingFlagId(flagId);
    setFeatureFlags(prev => prev.map(flag =>
      flag.id === flagId ? { ...flag, enabled: newValue } : flag
    ));

    try {
      const { error } = await supabase
        .from('feature_flags')
        .update({ enabled: newValue })
        .eq('id', flagId);

      if (error) {
        throw error;
      }

      toast.success('Feature flag updated successfully');
    } catch (error) {
      console.error('Error updating feature flag:', error);
      setFeatureFlags(previousFlags);
      toast.error('Failed to update feature flag');
    } finally {
      setUpdatingFlagId(null);
    }
  };

  const banUser = async () => {
    if (!selectedUser || !banReason) {
      toast.error('Please select a user and provide a reason');
      return;
    }

    try {
      setBanningUser(true);

      const payload = {
        user_id: selectedUser,
        username: selectedUser,
        action: 'User Ban',
        details: banReason,
        timestamp: new Date().toISOString(),
        severity: 'critical' as const
      };

      const { error } = await supabase.from('user_actions').insert([payload]);

      if (error) {
        throw error;
      }

      toast.success(`User ${selectedUser} has been banned: ${banReason}`);
      setSelectedUser('');
      setBanReason('');

      try {
        await fetchUserActions(0);
      } catch (refreshError) {
        console.error('Error refreshing user actions:', refreshError);
        toast.error('User banned, but failed to refresh activity log');
      }
    } catch (error) {
      console.error('Error banning user:', error);
      toast.error('Failed to ban user');
    } finally {
      setBanningUser(false);
    }
  };

  const createEvent = async () => {
    if (!newEvent.title || !newEvent.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // In a real implementation, this would create an event in the database
      toast.success(`Event "${newEvent.title}" created successfully`);
      setNewEvent({
        title: '',
        description: '',
        type: 'tournament',
        start_date: '',
        end_date: '',
        rewards: ''
      });
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event');
    }
  };

  const createSeason = async () => {
    if (!newSeason.name || !newSeason.start_date || !newSeason.end_date) {
      toast.error('Please provide a name, start date, and end date for the season');
      return;
    }

    let multipliersPayload: Record<string, number> = {};

    if (newSeason.multipliers.trim()) {
      try {
        const parsed = JSON.parse(newSeason.multipliers);

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Multipliers must be a JSON object');
        }

        multipliersPayload = Object.entries(parsed).reduce((acc, [key, value]) => {
          const numericValue = Number(value);

          if (!Number.isFinite(numericValue)) {
            throw new Error('Multipliers must contain numeric values');
          }

          acc[key] = numericValue;
          return acc;
        }, {} as Record<string, number>);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid multipliers format';
        toast.error(message);
        return;
      }
    }

    try {
      setCreatingSeason(true);

      const { error } = await supabase.from('seasons').insert([{
        name: newSeason.name,
        start_date: newSeason.start_date,
        end_date: newSeason.end_date,
        multipliers: multipliersPayload,
        active: newSeason.active
      }]);

      if (error) {
        throw error;
      }

      toast.success(`Season "${newSeason.name}" created successfully`);
      setNewSeason({
        name: '',
        start_date: '',
        end_date: '',
        multipliers: '',
        active: false
      });

      try {
        await fetchSeasons();
      } catch (refreshError) {
        console.error('Error refreshing seasons:', refreshError);
        toast.error('Season created, but failed to refresh list');
      }
    } catch (error) {
      console.error('Error creating season:', error);
      toast.error('Failed to create season');
    } finally {
      setCreatingSeason(false);
    }
  };

  const resetCityForm = () => {
    setCityForm({
      name: '',
      country: '',
      description: '',
      bonuses: '',
      unlocked: false
    });
    setEditingCityId(null);
  };

  const handleCitySubmit = async () => {
    if (!cityForm.name.trim() || !cityForm.country.trim()) {
      toast.error('City name and country are required');
      return;
    }

    const payload = {
      name: cityForm.name.trim(),
      country: cityForm.country.trim(),
      description: cityForm.description.trim() || null,
      bonuses: cityForm.bonuses.trim() || null,
      unlocked: cityForm.unlocked
    };

    setCitySaving(true);

    try {
      if (editingCityId) {
        const { error } = await supabase
          .from('cities')
          .update(payload)
          .eq('id', editingCityId);

        if (error) {
          throw error;
        }

        toast.success('City updated successfully');
      } else {
        const { error } = await supabase.from('cities').insert([payload]);

        if (error) {
          throw error;
        }

        toast.success('City created successfully');
      }

      resetCityForm();

      try {
        await fetchCities();
      } catch (refreshError) {
        console.error('Error refreshing cities:', refreshError);
        toast.error('City saved, but failed to refresh list');
      }
    } catch (error) {
      console.error('Error saving city:', error);
      toast.error('Failed to save city');
    } finally {
      setCitySaving(false);
    }
  };

  const handleCityEdit = (city: City) => {
    setEditingCityId(city.id);
    setCityForm({
      name: city.name,
      country: city.country,
      description: city.description ?? '',
      bonuses: city.bonuses ?? '',
      unlocked: city.unlocked
    });
  };

  const handleCityDelete = async (cityId: string) => {
    setDeletingCityId(cityId);

    try {
      const { error } = await supabase
        .from('cities')
        .delete()
        .eq('id', cityId);

      if (error) {
        throw error;
      }

      toast.success('City deleted successfully');

      if (editingCityId === cityId) {
        resetCityForm();
      }

      try {
        await fetchCities();
      } catch (refreshError) {
        console.error('Error refreshing cities:', refreshError);
        toast.error('City deleted, but failed to refresh list');
      }
    } catch (error) {
      console.error('Error deleting city:', error);
      toast.error('Failed to delete city');
    } finally {
      setDeletingCityId(null);
    }
  };

  const resetLocationForm = () => {
    setLocationForm({
      name: '',
      city_id: '',
      location_type: '',
      description: '',
      bonuses: '',
      is_featured: false
    });
    setEditingLocationId(null);
  };

  const handleLocationSubmit = async () => {
    if (!locationForm.name.trim()) {
      toast.error('Location name is required');
      return;
    }

    if (!locationForm.city_id) {
      toast.error('Please select a city for this location');
      return;
    }

    const payload = {
      name: locationForm.name.trim(),
      city_id: locationForm.city_id,
      location_type: locationForm.location_type.trim() || null,
      description: locationForm.description.trim() || null,
      bonuses: locationForm.bonuses.trim() || null,
      is_featured: locationForm.is_featured
    };

    setLocationSaving(true);

    try {
      if (editingLocationId) {
        const { error } = await supabase
          .from('locations')
          .update(payload)
          .eq('id', editingLocationId);

        if (error) {
          throw error;
        }

        toast.success('Location updated successfully');
      } else {
        const { error } = await supabase.from('locations').insert([payload]);

        if (error) {
          throw error;
        }

        toast.success('Location created successfully');
      }

      resetLocationForm();

      try {
        await fetchLocations();
      } catch (refreshError) {
        console.error('Error refreshing locations:', refreshError);
        toast.error('Location saved, but failed to refresh list');
      }
    } catch (error) {
      console.error('Error saving location:', error);
      toast.error('Failed to save location');
    } finally {
      setLocationSaving(false);
    }
  };

  const handleLocationEdit = (location: Location) => {
    setEditingLocationId(location.id);
    setLocationForm({
      name: location.name,
      city_id: location.city_id,
      location_type: location.location_type ?? '',
      description: location.description ?? '',
      bonuses: location.bonuses ?? '',
      is_featured: location.is_featured
    });
  };

  const handleLocationDelete = async (locationId: string) => {
    setDeletingLocationId(locationId);

    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', locationId);

      if (error) {
        throw error;
      }

      toast.success('Location deleted successfully');

      if (editingLocationId === locationId) {
        resetLocationForm();
      }

      try {
        await fetchLocations();
      } catch (refreshError) {
        console.error('Error refreshing locations:', refreshError);
        toast.error('Location deleted, but failed to refresh list');
      }
    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error('Failed to delete location');
    } finally {
      setDeletingLocationId(null);
    }
  };

  const resetShopForm = () => {
    setShopForm({
      name: '',
      city_id: '',
      description: '',
      inventory: '',
      currency: '',
      is_open: false
    });
    setEditingShopId(null);
  };

  const handleShopSubmit = async () => {
    if (!shopForm.name.trim()) {
      toast.error('Shop name is required');
      return;
    }

    if (!shopForm.city_id) {
      toast.error('Please select a city for this shop');
      return;
    }

    const payload = {
      name: shopForm.name.trim(),
      city_id: shopForm.city_id,
      description: shopForm.description.trim() || null,
      inventory: shopForm.inventory.trim() || null,
      currency: shopForm.currency.trim() || null,
      is_open: shopForm.is_open
    };

    setShopSaving(true);

    try {
      if (editingShopId) {
        const { error } = await supabase
          .from('shops')
          .update(payload)
          .eq('id', editingShopId);

        if (error) {
          throw error;
        }

        toast.success('Shop updated successfully');
      } else {
        const { error } = await supabase.from('shops').insert([payload]);

        if (error) {
          throw error;
        }

        toast.success('Shop created successfully');
      }

      resetShopForm();

      try {
        await fetchShops();
      } catch (refreshError) {
        console.error('Error refreshing shops:', refreshError);
        toast.error('Shop saved, but failed to refresh list');
      }
    } catch (error) {
      console.error('Error saving shop:', error);
      toast.error('Failed to save shop');
    } finally {
      setShopSaving(false);
    }
  };

  const handleShopEdit = (shop: Shop) => {
    setEditingShopId(shop.id);
    setShopForm({
      name: shop.name,
      city_id: shop.city_id,
      description: shop.description ?? '',
      inventory: shop.inventory ?? '',
      currency: shop.currency ?? '',
      is_open: shop.is_open
    });
  };

  const handleShopDelete = async (shopId: string) => {
    setDeletingShopId(shopId);

    try {
      const { error } = await supabase
        .from('shops')
        .delete()
        .eq('id', shopId);

      if (error) {
        throw error;
      }

      toast.success('Shop deleted successfully');

      if (editingShopId === shopId) {
        resetShopForm();
      }

      try {
        await fetchShops();
      } catch (refreshError) {
        console.error('Error refreshing shops:', refreshError);
        toast.error('Shop deleted, but failed to refresh list');
      }
    } catch (error) {
      console.error('Error deleting shop:', error);
      toast.error('Failed to delete shop');
    } finally {
      setDeletingShopId(null);
    }
  };

  const resetSpecialItemForm = () => {
    setSpecialItemForm({
      name: '',
      rarity: '',
      effect: '',
      description: '',
      cost: '',
      isLimited: false
    });
    setEditingSpecialItemId(null);
  };

  const handleSpecialItemSubmit = async () => {
    if (!specialItemForm.name.trim()) {
      toast.error('Special item name is required');
      return;
    }

    if (!specialItemForm.rarity.trim()) {
      toast.error('Please provide a rarity for the special item');
      return;
    }

    if (!specialItemForm.effect.trim()) {
      toast.error('Please describe the special item effect');
      return;
    }

    const parsedCost = Number.parseFloat(specialItemForm.cost);

    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      toast.error('Cost must be a valid non-negative number');
      return;
    }

    const payload = {
      name: specialItemForm.name.trim(),
      rarity: specialItemForm.rarity.trim(),
      effect: specialItemForm.effect.trim(),
      description: specialItemForm.description.trim() || null,
      cost: parsedCost,
      is_limited: specialItemForm.isLimited
    };

    setSpecialItemSaving(true);

    try {
      if (editingSpecialItemId) {
        const { error } = await supabase
          .from('special_items')
          .update(payload)
          .eq('id', editingSpecialItemId);

        if (error) {
          throw error;
        }

        toast.success('Special item updated successfully');
      } else {
        const { error } = await supabase.from('special_items').insert([payload]);

        if (error) {
          throw error;
        }

        toast.success('Special item created successfully');
      }

      resetSpecialItemForm();

      try {
        await fetchSpecialItems();
      } catch (refreshError) {
        console.error('Error refreshing special items:', refreshError);
        toast.error('Special item saved, but failed to refresh list');
      }
    } catch (error) {
      console.error('Error saving special item:', error);
      toast.error('Failed to save special item');
    } finally {
      setSpecialItemSaving(false);
    }
  };

  const handleSpecialItemEdit = (item: SpecialItem) => {
    setEditingSpecialItemId(item.id);
    setSpecialItemForm({
      name: item.name,
      rarity: item.rarity ?? '',
      effect: item.effect ?? '',
      description: item.description ?? '',
      cost: item.cost !== null && item.cost !== undefined ? String(item.cost) : '',
      isLimited: item.is_limited
    });
  };

  const handleSpecialItemDelete = async (itemId: string) => {
    setDeletingSpecialItemId(itemId);

    try {
      const { error } = await supabase
        .from('special_items')
        .delete()
        .eq('id', itemId);

      if (error) {
        throw error;
      }

      toast.success('Special item deleted successfully');

      if (editingSpecialItemId === itemId) {
        resetSpecialItemForm();
      }

      try {
        await fetchSpecialItems();
      } catch (refreshError) {
        console.error('Error refreshing special items:', refreshError);
        toast.error('Special item deleted, but failed to refresh list');
      }
    } catch (error) {
      console.error('Error deleting special item:', error);
      toast.error('Failed to delete special item');
    } finally {
      setDeletingSpecialItemId(null);
    }
  };

  const handleUserActionsPageChange = async (direction: 'previous' | 'next') => {
    const totalPages = userActionsTotal > 0
      ? Math.ceil(userActionsTotal / USER_ACTIONS_PAGE_SIZE)
      : userActionsHasMore
        ? userActionsPage + 2
        : 1;

    if (direction === 'previous') {
      if (userActionsPage === 0) {
        return;
      }

      const previousPage = userActionsPage - 1;

      try {
        await fetchUserActions(previousPage);
      } catch (error) {
        console.error('Error loading user actions:', error);
        toast.error('Failed to load user actions');
      }

      return;
    }

    if (!userActionsHasMore && userActionsPage + 1 >= totalPages) {
      return;
    }

    const nextPage = userActionsPage + 1;

    try {
      await fetchUserActions(nextPage);
    } catch (error) {
      console.error('Error loading user actions:', error);
      toast.error('Failed to load user actions');
    }
  };

  const totalUserActionsPages = userActionsTotal > 0
    ? Math.max(1, Math.ceil(userActionsTotal / USER_ACTIONS_PAGE_SIZE))
    : userActionsHasMore
      ? userActionsPage + 2
      : Math.max(1, userActionsPage + (userActions.length > 0 ? 1 : 0));

  const userActionsStart = userActions.length === 0 ? 0 : userActionsPage * USER_ACTIONS_PAGE_SIZE + 1;
  const userActionsEnd = userActions.length === 0 ? 0 : userActionsPage * USER_ACTIONS_PAGE_SIZE + userActions.length;
  const canGoToPreviousPage = userActionsPage > 0;
  const canGoToNextPage = userActionsHasMore || (userActionsTotal > 0 && userActionsPage + 1 < totalUserActionsPages);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  useEffect(() => {
    if (user) {
      loadAdminData();
    }
  }, [user, loadAdminData]);

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
        <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
          Admin Control Center
        </h1>
        <p className="text-muted-foreground">
          Monitor, manage, and moderate the RockMundo universe
        </p>
      </div>

      {/* System Overview */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold">{metrics.total_users.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Users</div>
              <div className="text-xs text-green-600">+{metrics.active_users_24h} active (24h)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Music className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold">{metrics.total_bands.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Bands</div>
              <div className="text-xs text-blue-600">{metrics.total_gigs_today} gigs today</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold">${metrics.total_revenue_24h.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Revenue (24h)</div>
              <div className="text-xs text-green-600">+12% vs yesterday</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Activity className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <div className="text-2xl font-bold">{metrics.active_sessions}</div>
              <div className="text-sm text-muted-foreground">Active Sessions</div>
              <div className="text-xs text-muted-foreground">Uptime: {metrics.server_uptime}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="monitoring" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 xl:grid-cols-10">
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="cities">Cities</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="shops">Shops</TabsTrigger>
          <TabsTrigger value="special-items">Special Items</TabsTrigger>
          <TabsTrigger value="moderation">Moderation</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="seasons">Seasons</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-6 h-6" />
                Real-time Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Server Status</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>API Response Time</span>
                      <Badge variant="outline" className="text-green-600">142ms</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Database Connections</span>
                      <Badge variant="outline">23/100</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Memory Usage</span>
                      <Badge variant="outline" className="text-yellow-600">67%</Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Recent Alerts</h4>
                  <div className="space-y-2">
                    <div className="p-2 bg-yellow-50 rounded text-sm">
                      <div className="font-medium">High CPU Usage</div>
                      <div className="text-muted-foreground">Server load at 78%</div>
                    </div>
                    <div className="p-2 bg-blue-50 rounded text-sm">
                      <div className="font-medium">New User Spike</div>
                      <div className="text-muted-foreground">+50 registrations in 1h</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6" />
                Suspicious Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-muted-foreground">
                    {userActions.length === 0
                      ? 'No actions to display'
                      : userActionsTotalKnown
                        ? `Showing ${userActionsStart}-${userActionsEnd} of ${userActionsTotal}`
                        : `Showing ${userActionsStart}-${userActionsEnd}${userActionsHasMore ? '+' : ''}`}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUserActionsPageChange('previous')}
                      disabled={userActionsLoading || !canGoToPreviousPage}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {userActionsPage + 1}
                      {userActionsTotalKnown ? ` of ${totalUserActionsPages}` : userActionsHasMore ? ' +' : ''}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUserActionsPageChange('next')}
                      disabled={userActionsLoading || !canGoToNextPage}
                    >
                      Next
                    </Button>
                  </div>
                </div>
                {userActionsLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : userActions.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No suspicious activity found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userActions.map((action) => (
                      <div key={action.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge className={getSeverityColor(action.severity)}>
                            {action.severity.toUpperCase()}
                          </Badge>
                          <div>
                            <div className="font-medium">{action.username ?? 'Unknown user'}</div>
                            <div className="text-sm text-muted-foreground">{action.action}</div>
                            {action.details && (
                              <div className="text-xs text-muted-foreground">{action.details}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <div className="text-sm text-muted-foreground">
                            {new Date(action.timestamp).toLocaleString()}
                          </div>
                          <Button size="sm" variant="outline">
                            Investigate
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="w-6 h-6" />
                Feature Flags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {featureFlags.map((flag) => (
                  <div key={flag.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{flag.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {flag.description ?? 'No description provided'}
                      </div>
                      <Badge variant="outline" className="mt-1">
                        {flag.category ?? 'uncategorized'}
                      </Badge>
                    </div>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={(checked) => toggleFeatureFlag(flag.id, checked)}
                      disabled={updatingFlagId === flag.id}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cities" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-6 h-6" />
                Cities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Create or Update City</h3>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={cityForm.name}
                      onChange={(e) => setCityForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="MegaCity Prime"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Country</label>
                    <Input
                      value={cityForm.country}
                      onChange={(e) => setCityForm((prev) => ({ ...prev, country: e.target.value }))}
                      placeholder="Neo Brazil"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={cityForm.description}
                      onChange={(e) => setCityForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="A bustling hub for intergalactic rock fans"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Bonuses</label>
                    <Textarea
                      value={cityForm.bonuses}
                      onChange={(e) => setCityForm((prev) => ({ ...prev, bonuses: e.target.value }))}
                      placeholder="+10% merch sales, +5% fan loyalty"
                    />
                  </div>
                  <div className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <div>
                      <div className="text-sm font-medium">Unlocked</div>
                      <div className="text-xs text-muted-foreground">Available to players immediately</div>
                    </div>
                    <Switch
                      checked={cityForm.unlocked}
                      onCheckedChange={(checked) => setCityForm((prev) => ({ ...prev, unlocked: checked }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCitySubmit} disabled={citySaving} className="flex-1">
                      {citySaving
                        ? editingCityId
                          ? 'Updating...'
                          : 'Creating...'
                        : editingCityId
                          ? 'Update City'
                          : 'Create City'}
                    </Button>
                    {editingCityId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetCityForm}
                        disabled={citySaving}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Existing Cities</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await fetchCities();
                        } catch (error) {
                          console.error('Error refreshing cities:', error);
                          toast.error('Failed to refresh cities');
                        }
                      }}
                      disabled={citiesLoading}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                  {citiesLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : cities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No cities configured yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {cities.map((city) => (
                        <div key={city.id} className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="font-semibold text-base">{city.name}</div>
                              <div className="text-sm text-muted-foreground">{city.country}</div>
                            </div>
                            <Badge variant={city.unlocked ? 'default' : 'outline'}>
                              {city.unlocked ? 'Unlocked' : 'Locked'}
                            </Badge>
                          </div>
                          {city.description && (
                            <p className="text-sm text-muted-foreground">{city.description}</p>
                          )}
                          {city.bonuses && (
                            <p className="text-sm">
                              <span className="font-medium">Bonuses:</span> {city.bonuses}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleCityEdit(city)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleCityDelete(city.id)}
                              disabled={deletingCityId === city.id}
                            >
                              {deletingCityId === city.id ? 'Deleting...' : 'Delete'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-6 h-6" />
                Locations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Create or Update Location</h3>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={locationForm.name}
                      onChange={(e) => setLocationForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Starport Amphitheater"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">City</label>
                    <select
                      className="w-full border rounded-md bg-background px-3 py-2 text-sm"
                      value={locationForm.city_id}
                      onChange={(e) => setLocationForm((prev) => ({ ...prev, city_id: e.target.value }))}
                    >
                      <option value="">Select a city</option>
                      {cities.map((city) => (
                        <option key={city.id} value={city.id}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <Input
                      value={locationForm.location_type}
                      onChange={(e) => setLocationForm((prev) => ({ ...prev, location_type: e.target.value }))}
                      placeholder="Arena, landmark, festival ground"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={locationForm.description}
                      onChange={(e) => setLocationForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Iconic venue orbiting the city core"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Bonuses</label>
                    <Textarea
                      value={locationForm.bonuses}
                      onChange={(e) => setLocationForm((prev) => ({ ...prev, bonuses: e.target.value }))}
                      placeholder="+15% ticket demand during cosmic events"
                    />
                  </div>
                  <div className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <div>
                      <div className="text-sm font-medium">Featured Location</div>
                      <div className="text-xs text-muted-foreground">Promote in seasonal rotations</div>
                    </div>
                    <Switch
                      checked={locationForm.is_featured}
                      onCheckedChange={(checked) => setLocationForm((prev) => ({ ...prev, is_featured: checked }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleLocationSubmit} disabled={locationSaving} className="flex-1">
                      {locationSaving
                        ? editingLocationId
                          ? 'Updating...'
                          : 'Creating...'
                        : editingLocationId
                          ? 'Update Location'
                          : 'Create Location'}
                    </Button>
                    {editingLocationId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetLocationForm}
                        disabled={locationSaving}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Existing Locations</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await fetchLocations();
                        } catch (error) {
                          console.error('Error refreshing locations:', error);
                          toast.error('Failed to refresh locations');
                        }
                      }}
                      disabled={locationsLoading}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                  {locationsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : locations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No locations configured yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {locations.map((location) => {
                        const cityName = cities.find((city) => city.id === location.city_id)?.name ?? 'Unknown City';
                        return (
                          <div key={location.id} className="p-4 border rounded-lg space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="font-semibold text-base">{location.name}</div>
                                <div className="text-sm text-muted-foreground">{cityName}</div>
                              </div>
                              <Badge variant={location.is_featured ? 'default' : 'outline'}>
                                {location.is_featured ? 'Featured' : 'Standard'}
                              </Badge>
                            </div>
                            {location.location_type && (
                              <p className="text-sm">
                                <span className="font-medium">Type:</span> {location.location_type}
                              </p>
                            )}
                            {location.description && (
                              <p className="text-sm text-muted-foreground">{location.description}</p>
                            )}
                            {location.bonuses && (
                              <p className="text-sm">
                                <span className="font-medium">Bonuses:</span> {location.bonuses}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleLocationEdit(location)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleLocationDelete(location.id)}
                                disabled={deletingLocationId === location.id}
                              >
                                {deletingLocationId === location.id ? 'Deleting...' : 'Delete'}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shops" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="w-6 h-6" />
                Shops
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Create or Update Shop</h3>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={shopForm.name}
                      onChange={(e) => setShopForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Galactic Gear Outfitters"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">City</label>
                    <select
                      className="w-full border rounded-md bg-background px-3 py-2 text-sm"
                      value={shopForm.city_id}
                      onChange={(e) => setShopForm((prev) => ({ ...prev, city_id: e.target.value }))}
                    >
                      <option value="">Select a city</option>
                      {cities.map((city) => (
                        <option key={city.id} value={city.id}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={shopForm.description}
                      onChange={(e) => setShopForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Specializes in rare guitar mods and stage outfits"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Inventory Notes</label>
                    <Textarea
                      value={shopForm.inventory}
                      onChange={(e) => setShopForm((prev) => ({ ...prev, inventory: e.target.value }))}
                      placeholder="List available items or JSON payload"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Currency</label>
                    <Input
                      value={shopForm.currency}
                      onChange={(e) => setShopForm((prev) => ({ ...prev, currency: e.target.value }))}
                      placeholder="Star Credits"
                    />
                  </div>
                  <div className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <div>
                      <div className="text-sm font-medium">Shop Open</div>
                      <div className="text-xs text-muted-foreground">Visible in-game marketplace</div>
                    </div>
                    <Switch
                      checked={shopForm.is_open}
                      onCheckedChange={(checked) => setShopForm((prev) => ({ ...prev, is_open: checked }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleShopSubmit} disabled={shopSaving} className="flex-1">
                      {shopSaving
                        ? editingShopId
                          ? 'Updating...'
                          : 'Creating...'
                        : editingShopId
                          ? 'Update Shop'
                          : 'Create Shop'}
                    </Button>
                    {editingShopId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetShopForm}
                        disabled={shopSaving}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Existing Shops</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await fetchShops();
                        } catch (error) {
                          console.error('Error refreshing shops:', error);
                          toast.error('Failed to refresh shops');
                        }
                      }}
                      disabled={shopsLoading}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                  {shopsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : shops.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No shops configured yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {shops.map((shop) => {
                        const cityName = cities.find((city) => city.id === shop.city_id)?.name ?? 'Unknown City';
                        return (
                          <div key={shop.id} className="p-4 border rounded-lg space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="font-semibold text-base">{shop.name}</div>
                                <div className="text-sm text-muted-foreground">{cityName}</div>
                              </div>
                              <Badge variant={shop.is_open ? 'default' : 'outline'}>
                                {shop.is_open ? 'Open' : 'Closed'}
                              </Badge>
                            </div>
                            {shop.currency && (
                              <p className="text-sm">
                                <span className="font-medium">Currency:</span> {shop.currency}
                              </p>
                            )}
                            {shop.description && (
                              <p className="text-sm text-muted-foreground">{shop.description}</p>
                            )}
                            {shop.inventory && (
                              <p className="text-sm">
                                <span className="font-medium">Inventory:</span> {shop.inventory}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleShopEdit(shop)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleShopDelete(shop.id)}
                                disabled={deletingShopId === shop.id}
                              >
                                {deletingShopId === shop.id ? 'Deleting...' : 'Delete'}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="special-items" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SparklesIcon className="w-6 h-6" />
                Special Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Create or Update Special Item</h3>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={specialItemForm.name}
                      onChange={(e) => setSpecialItemForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Phoenix Feather Pick"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rarity</label>
                    <Input
                      value={specialItemForm.rarity}
                      onChange={(e) => setSpecialItemForm((prev) => ({ ...prev, rarity: e.target.value }))}
                      placeholder="Legendary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Effect</label>
                    <Textarea
                      value={specialItemForm.effect}
                      onChange={(e) => setSpecialItemForm((prev) => ({ ...prev, effect: e.target.value }))}
                      placeholder="Doubles solo performance power for one show"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={specialItemForm.description}
                      onChange={(e) => setSpecialItemForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Forged from supernova fragments by the ancients"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cost</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={specialItemForm.cost}
                      onChange={(e) => setSpecialItemForm((prev) => ({ ...prev, cost: e.target.value }))}
                      placeholder="5000"
                    />
                  </div>
                  <div className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <div>
                      <div className="text-sm font-medium">Limited Availability</div>
                      <div className="text-xs text-muted-foreground">Restrict stock to special events</div>
                    </div>
                    <Switch
                      checked={specialItemForm.isLimited}
                      onCheckedChange={(checked) => setSpecialItemForm((prev) => ({ ...prev, isLimited: checked }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSpecialItemSubmit} disabled={specialItemSaving} className="flex-1">
                      {specialItemSaving
                        ? editingSpecialItemId
                          ? 'Updating...'
                          : 'Creating...'
                        : editingSpecialItemId
                          ? 'Update Item'
                          : 'Create Item'}
                    </Button>
                    {editingSpecialItemId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetSpecialItemForm}
                        disabled={specialItemSaving}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Existing Special Items</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await fetchSpecialItems();
                        } catch (error) {
                          console.error('Error refreshing special items:', error);
                          toast.error('Failed to refresh special items');
                        }
                      }}
                      disabled={specialItemsLoading}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                  {specialItemsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : specialItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No special items configured yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {specialItems.map((item) => (
                        <div key={item.id} className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="font-semibold text-base">{item.name}</div>
                              <div className="text-sm text-muted-foreground">{item.rarity ?? 'Unspecified rarity'}</div>
                            </div>
                            <Badge variant={item.is_limited ? 'default' : 'outline'}>
                              {item.is_limited ? 'Limited' : 'Unlimited'}
                            </Badge>
                          </div>
                          {item.cost !== null && (
                            <p className="text-sm">
                              <span className="font-medium">Cost:</span> {item.cost}
                            </p>
                          )}
                          {item.effect && (
                            <p className="text-sm">
                              <span className="font-medium">Effect:</span> {item.effect}
                            </p>
                          )}
                          {item.description && (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          )}
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleSpecialItemEdit(item)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleSpecialItemDelete(item.id)}
                              disabled={deletingSpecialItemId === item.id}
                            >
                              {deletingSpecialItemId === item.id ? 'Deleting...' : 'Delete'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="moderation" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ban className="w-6 h-6" />
                  User Moderation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Username</label>
                  <Input
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    placeholder="Enter username to moderate"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Reason</label>
                  <Textarea
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Reason for action..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={banUser}
                    variant="destructive"
                    className="flex-1"
                    disabled={banningUser}
                  >
                    {banningUser ? 'Banning...' : 'Ban User'}
                  </Button>
                  <Button variant="outline" className="flex-1" disabled={banningUser}>
                    Warn User
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-6 h-6" />
                  Content Moderation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="p-3 border rounded-lg">
                    <div className="font-medium">Reported Song: "Inappropriate Title"</div>
                    <div className="text-sm text-muted-foreground">By: BandUser123</div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="destructive">Remove</Button>
                      <Button size="sm" variant="outline">Approve</Button>
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="font-medium">Reported Profile: Offensive Bio</div>
                    <div className="text-sm text-muted-foreground">By: NewUser456</div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="destructive">Remove</Button>
                      <Button size="sm" variant="outline">Approve</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-6 h-6" />
                Create Live Event
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Event Title</label>
                  <Input
                    value={newEvent.title}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Summer Music Festival"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Event Type</label>
                  <select 
                    className="w-full p-2 border rounded"
                    value={newEvent.type}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="tournament">Tournament</option>
                    <option value="festival">Festival</option>
                    <option value="challenge">Challenge</option>
                    <option value="season">Season Event</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Event description and rules..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="datetime-local"
                    value={newEvent.start_date}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="datetime-local"
                    value={newEvent.end_date}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Rewards</label>
                  <Input
                    value={newEvent.rewards}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, rewards: e.target.value }))}
                    placeholder="$10,000 + Trophy"
                  />
                </div>
              </div>
              <Button onClick={createEvent} className="w-full">
                Create Event
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seasons" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-6 h-6" />
                Create Season
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Season Name</label>
                  <Input
                    value={newSeason.name}
                    onChange={(e) => setNewSeason(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Summer Festival Season"
                  />
                </div>
                <div className="flex items-center gap-3 md:justify-end pt-2">
                  <Switch
                    id="season-active"
                    checked={newSeason.active}
                    onCheckedChange={(checked) => setNewSeason(prev => ({ ...prev, active: checked }))}
                  />
                  <label htmlFor="season-active" className="text-sm font-medium">Active</label>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={newSeason.start_date}
                    onChange={(e) => setNewSeason(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={newSeason.end_date}
                    onChange={(e) => setNewSeason(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Multipliers (JSON)</label>
                <Textarea
                  value={newSeason.multipliers}
                  onChange={(e) => setNewSeason(prev => ({ ...prev, multipliers: e.target.value }))}
                  placeholder='{"gig_payment": 1.5, "fan_gain": 1.3}'
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Provide key-value pairs where each value is a numeric multiplier (e.g. 1.5).
                </p>
              </div>
              <Button onClick={createSeason} className="w-full" disabled={creatingSeason}>
                {creatingSeason ? 'Creating Season...' : 'Create Season'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-6 h-6" />
                Season Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {seasons.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No seasons configured yet.
                  </div>
                ) : (
                  seasons.map((season) => (
                    <div key={season.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-medium">{season.name}</h3>
                          <div className="text-sm text-muted-foreground">
                            {new Date(season.start_date).toLocaleDateString()} - {new Date(season.end_date).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant={season.active ? "default" : "secondary"}>
                          {season.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.entries(season.multipliers).length > 0 ? (
                          Object.entries(season.multipliers).map(([key, value]) => (
                            <div key={key} className="text-center p-2 bg-muted rounded">
                              <div className="text-sm font-medium">{key.replace(/_/g, ' ')}</div>
                              <div className="text-lg font-bold text-primary">{value}x</div>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-full text-center text-sm text-muted-foreground">
                            No multipliers configured.
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-6 h-6" />
                  User Engagement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Daily Active Users</span>
                    <span className="font-bold text-green-600">+8.3%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Average Session Time</span>
                    <span className="font-bold">34m 12s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Retention Rate (7d)</span>
                    <span className="font-bold text-blue-600">73%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Revenue per User</span>
                    <span className="font-bold text-green-600">$12.40</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-6 h-6" />
                  System Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>API Uptime</span>
                    <span className="font-bold text-green-600">99.97%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Database Performance</span>
                    <span className="font-bold text-green-600">Excellent</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Error Rate</span>
                    <span className="font-bold text-red-600">0.03%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Storage Used</span>
                    <span className="font-bold">2.4GB / 100GB</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-center">
        <Button onClick={loadAdminData} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh Data
        </Button>
      </div>
    </div>
  );
};

export default AdminDashboard;