import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth-context';
import { Users, User, MapPin } from 'lucide-react';
import { INSTRUMENT_ROLES, VOCAL_ROLES } from '@/utils/touringMembers';
import { MUSIC_GENRES } from '@/data/genres';

interface BandCreationFormProps {
  onBandCreated?: () => void;
}

export function BandCreationForm({ onBandCreated }: BandCreationFormProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [creationMode, setCreationMode] = useState<'band' | 'solo'>('band');
  const [name, setName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [genre, setGenre] = useState('Rock');
  const [description, setDescription] = useState('');
  const [maxMembers, setMaxMembers] = useState(4);
  const [instrumentRole, setInstrumentRole] = useState('Guitar');
  const [vocalRole, setVocalRole] = useState('None');
  const [homeCityId, setHomeCityId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Fetch cities for home city selector
  const { data: cities } = useQuery({
    queryKey: ['creation-cities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, country')
        .order('country')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Group cities by country
  const citiesByCountry = cities?.reduce((acc, city) => {
    const country = city.country || 'Unknown';
    if (!acc[country]) acc[country] = [];
    acc[country].push(city);
    return acc;
  }, {} as Record<string, typeof cities>) || {};

  const sortedCountries = Object.keys(citiesByCountry).sort();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Check if user is already in an active band (not a touring member)
      const { data: existingBands } = await supabase
        .from('band_members')
        .select('band_id, is_touring_member, bands!inner(name, status)')
        .eq('user_id', user.id)
        .eq('is_touring_member', false)
        .eq('bands.status', 'active')
        .limit(1);

      if (existingBands && existingBands.length > 0) {
        const bandName = (existingBands[0].bands as any)?.name || 'a band';
        toast({
          title: 'Already in a band',
          description: `You're already a member of ${bandName}. Leave your current band first to create a new one.`,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Clean up any orphaned band_member records for disbanded bands
      await supabase
        .from('band_members')
        .delete()
        .eq('user_id', user.id)
        .eq('is_touring_member', false);

      const isSolo = creationMode === 'solo';
      const bandName = isSolo ? (artistName || `${user.email?.split('@')[0]} (Solo)`) : name;

      const { data: band, error: bandError } = await supabase
        .from('bands')
        .insert({
          name: bandName,
          leader_id: user.id,
          genre,
          description: description || (isSolo ? 'Solo artist' : 'A new band'),
          max_members: isSolo ? 1 : maxMembers,
          is_solo_artist: isSolo,
          artist_name: isSolo ? artistName : null,
          chemistry_level: 100,
          home_city_id: homeCityId || null,
        })
        .select()
        .single();

      if (bandError) throw bandError;

      const { error: memberError } = await supabase
        .from('band_members')
        .insert({
          band_id: band.id,
          user_id: user.id,
          role: 'Founder',
          instrument_role: instrumentRole,
          vocal_role: vocalRole === 'None' ? null : vocalRole,
        });

      if (memberError) throw memberError;

      toast({
        title: isSolo ? 'Solo Artist Profile Created!' : 'Band Created!',
        description: `${bandName} has been created successfully.`,
      });

      if (onBandCreated) {
        onBandCreated();
      } else {
        navigate('/band-manager');
      }
    } catch (error: any) {
      console.error('Error creating band:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create band',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Your Musical Journey</CardTitle>
        <CardDescription>Start as a solo artist or form a band</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <Label>What would you like to create?</Label>
            <RadioGroup value={creationMode} onValueChange={(v) => setCreationMode(v as 'band' | 'solo')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="band" id="band" />
                <Label htmlFor="band" className="flex items-center gap-2 cursor-pointer">
                  <Users className="h-4 w-4" />
                  Form a Band
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="solo" id="solo" />
                <Label htmlFor="solo" className="flex items-center gap-2 cursor-pointer">
                  <User className="h-4 w-4" />
                  Become a Solo Artist
                </Label>
              </div>
            </RadioGroup>
          </div>

          {creationMode === 'band' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Band Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="The Rock Stars"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxMembers">Max Members</Label>
                <Input
                  id="maxMembers"
                  type="number"
                  min={2}
                  max={8}
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(parseInt(e.target.value))}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="artistName">Artist Name</Label>
              <Input
                id="artistName"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Your stage name"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="genre">Genre</Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MUSIC_GENRES.map((genreOption) => (
                  <SelectItem key={genreOption} value={genreOption}>
                    {genreOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="homeCity" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Home City
            </Label>
            <Select value={homeCityId} onValueChange={setHomeCityId}>
              <SelectTrigger>
                <SelectValue placeholder="Select your band's home city" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {sortedCountries.map(country => (
                  <div key={country}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                      {country}
                    </div>
                    {citiesByCountry[country]?.map(city => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">This helps with regional rankings and can only be set once</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{creationMode === 'solo' ? 'Artist Bio' : 'Band Description'}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={creationMode === 'solo' ? 'Tell your story...' : 'Describe your band...'}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instrument">Your Instrument</Label>
            <Select value={instrumentRole} onValueChange={setInstrumentRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTRUMENT_ROLES.map((instrument) => (
                  <SelectItem key={instrument} value={instrument}>
                    {instrument}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vocal">Vocal Role</Label>
            <Select value={vocalRole} onValueChange={setVocalRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOCAL_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating...' : (creationMode === 'solo' ? 'Start Solo Career' : 'Create Band')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
