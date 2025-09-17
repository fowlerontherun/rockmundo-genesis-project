import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CharacterSelect from "@/components/CharacterSelect";
import { 
  User, 
  Camera, 
  Save,
  Star,
  Trophy,
  Music,
  Users,
  DollarSign,
  Upload,
  Edit3,
  TrendingUp,
  Heart,
  RotateCcw
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData, type PlayerAttributes, type PlayerSkills } from "@/hooks/useGameData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

interface FanMetrics {
  total_fans: number | null;
  weekly_growth: number | null;
  engagement_rate: number | null;
  updated_at: string | null;
}

type ProfileGender = Database["public"]["Enums"]["profile_gender"];

type CityOption = {
  id: string;
  name: string | null;
  country: string | null;
};

type ProfileFormState = {
  display_name: string;
  username: string;
  bio: string;
  gender: ProfileGender;
  age: string;
  city_of_birth: string | null;
};

const genderOptions: { value: ProfileGender; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const Profile = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile, skills, attributes, updateProfile } = useGameData();

  const instrumentSkillKeys: (keyof PlayerSkills)[] = [
    "vocals",
    "guitar",
    "drums",
    "bass",
    "performance",
    "songwriting",
    "composition"
  ];
  const attributeKeys: (keyof PlayerAttributes)[] = [
    "creativity",
    "business",
    "marketing",
    "technical"
  ];

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [fanMetrics, setFanMetrics] = useState<FanMetrics | null>(null);
  const [formData, setFormData] = useState<ProfileFormState>({
    display_name: "",
    username: "",
    bio: "",
    gender: "prefer_not_to_say",
    age: "16",
    city_of_birth: null,
  });
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);

  const showProfileDetails = Boolean(profile && skills && attributes);

  useEffect(() => {
    if (!showProfileDetails) {
      setIsEditing(false);
    }
  }, [showProfileDetails]);

  const fetchFanMetrics = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('fan_demographics')
        .select('total_fans, weekly_growth, engagement_rate, updated_at')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          setFanMetrics(null);
          return;
        }
        throw error;
      }

      setFanMetrics(data as FanMetrics);
    } catch (err) {
      console.error('Error fetching fan metrics:', err);
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || "",
        username: profile.username || "",
        bio: profile.bio || "",
        gender: (profile.gender as ProfileGender) || "prefer_not_to_say",
        age: typeof profile.age === "number" ? String(profile.age) : "16",
        city_of_birth: profile.city_of_birth ?? null,
      });
    }
  }, [profile]);

  useEffect(() => {
    const fetchCities = async () => {
      try {
        setCityLoading(true);
        setCityError(null);

        const { data, error } = await supabase
          .from("cities")
          .select("id, name, country")
          .order("name", { ascending: true });

        if (error) throw error;

        setCityOptions((data as CityOption[] | null) ?? []);
      } catch (error) {
        console.error("Error loading cities:", error);
        setCityError("We couldn't load cities right now. You can try again later.");
      } finally {
        setCityLoading(false);
      }
    };

    void fetchCities();
  }, []);

  const birthCityLabel = useMemo(() => {
    if (!profile?.city_of_birth) return null;
    const match = cityOptions.find((city) => city.id === profile.city_of_birth);
    if (!match) return null;
    const cityName = match.name ?? "Unnamed City";
    return match.country ? `${cityName}, ${match.country}` : cityName;
  }, [profile?.city_of_birth, cityOptions]);

  const profileGenderLabel = useMemo(() => {
    if (!profile?.gender) return "Prefer not to say";
    return (
      genderOptions.find((option) => option.value === (profile.gender as ProfileGender))?.label ??
      "Prefer not to say"
    );
  }, [profile?.gender]);

  useEffect(() => {
    if (!user) {
      setFanMetrics(null);
      return;
    }

    fetchFanMetrics();
  }, [user, fetchFanMetrics]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-fan-metrics-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fan_demographics',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchFanMetrics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'social_posts',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchFanMetrics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const activityType = (payload.new as { activity_type?: string })?.activity_type;
          if (activityType === 'campaign') {
            fetchFanMetrics();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, fetchFanMetrics]);

  const handleSave = async () => {
    if (!user) return;

    const parsedAge = Number.parseInt(formData.age, 10);
    if (!Number.isFinite(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      toast({
        variant: "destructive",
        title: "Invalid age",
        description: "Age must be between 13 and 120 to keep your persona grounded.",
      });
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        display_name: formData.display_name,
        username: formData.username,
        bio: formData.bio,
        gender: formData.gender,
        age: parsedAge,
        city_of_birth: formData.city_of_birth,
      });
      setIsEditing(false);
      toast({
        title: "Profile Updated!",
        description: "Your profile has been successfully updated.",
      });
    } catch (error: unknown) {
      const fallbackMessage = "Failed to update profile";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error updating profile:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      await updateProfile({ avatar_url: data.publicUrl });

      toast({
        title: "Avatar Updated!",
        description: "Your profile picture has been successfully updated.",
      });
    } catch (error: unknown) {
      const fallbackMessage = "Failed to upload avatar";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error uploading avatar:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    } finally {
      setUploading(false);
    }
  };

  const totalFansValue = fanMetrics?.total_fans ?? 0;
  const weeklyGrowthValue = fanMetrics?.weekly_growth ?? 0;
  const weeklyGrowthDisplay = `${weeklyGrowthValue >= 0 ? '+' : ''}${Math.abs(weeklyGrowthValue).toLocaleString()}`;
  const weeklyGrowthClass = weeklyGrowthValue >= 0 ? 'text-success' : 'text-destructive';
  const engagementRateValue = fanMetrics?.engagement_rate ?? 0;
  const engagementRateDisplay = Number.isFinite(engagementRateValue)
    ? Number(engagementRateValue).toFixed(1).replace(/\.0$/, '')
    : '0';
  const lastUpdatedLabel = fanMetrics?.updated_at ? new Date(fanMetrics.updated_at).toLocaleString() : null;

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Player Profile
            </h1>
            <p className="text-muted-foreground">Manage your musical identity</p>
          </div>
          {showProfileDetails && (
            <Button
              onClick={() => setIsEditing(!isEditing)}
              variant={isEditing ? "outline" : "default"}
              className={isEditing ? "" : "bg-gradient-primary"}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              {isEditing ? "Cancel" : "Edit Profile"}
            </Button>
          )}
        </div>

        <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Character Management
            </CardTitle>
            <CardDescription>
              Switch between unlocked performers or purchase additional character slots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CharacterSelect />
          </CardContent>
        </Card>

        {showProfileDetails ? (
          <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile Info</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <Avatar className="h-32 w-32">
                        <AvatarImage src={profile.avatar_url || ""} />
                        <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xl">
                          {(profile.display_name || profile.username || 'U')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute bottom-0 right-0">
                        <label htmlFor="avatar-upload" className="cursor-pointer">
                          <div className="bg-primary hover:bg-primary/80 rounded-full p-2 border-2 border-background">
                            {uploading ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background"></div>
                            ) : (
                              <Camera className="h-4 w-4 text-primary-foreground" />
                            )}
                          </div>
                          <input
                            id="avatar-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                            disabled={uploading}
                          />
                        </label>
                      </div>
                    </div>
                    <div className="text-center space-y-1">
                      <h2 className="text-2xl font-bold">{profile.display_name || profile.username}</h2>
                      <p className="text-muted-foreground">@{profile.username}</p>
                      <div className="flex items-center gap-2 justify-center mt-2">
                        <Badge variant="outline" className="border-primary text-primary">
                          Level {profile.level || 1}
                        </Badge>
                        <Badge variant="outline" className="border-accent text-accent">
                          {profile.fame || 0} Fame
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="border-border text-foreground/80">
                          Age {profile.age ?? 16}
                        </Badge>
                        <Badge variant="outline" className="border-border text-foreground/80">
                          {profileGenderLabel}
                        </Badge>
                        <Badge variant="outline" className="border-border text-foreground/80">
                          {profile.city_of_birth
                            ? birthCityLabel ?? "Loading birth city..."
                            : "Birth city not set"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Display Name</Label>
                        <Input
                          id="displayName"
                          value={formData.display_name}
                          onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                          disabled={!isEditing}
                          className={!isEditing ? "bg-secondary/50" : ""}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          disabled={!isEditing}
                          className={!isEditing ? "bg-secondary/50" : ""}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        disabled={!isEditing}
                        className={!isEditing ? "bg-secondary/50" : ""}
                        placeholder="Tell the world about your musical journey..."
                        rows={4}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="gender">Gender</Label>
                        <Select
                          value={formData.gender}
                          onValueChange={(value) =>
                            setFormData((prev) => ({ ...prev, gender: value as ProfileGender }))
                          }
                          disabled={!isEditing}
                        >
                          <SelectTrigger id="gender" className={!isEditing ? "bg-secondary/50" : ""}>
                            <SelectValue placeholder="Select a gender" />
                          </SelectTrigger>
                          <SelectContent>
                            {genderOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="age">Age</Label>
                        <Input
                          id="age"
                          type="number"
                          min={13}
                          max={120}
                          value={formData.age}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, age: event.target.value }))
                          }
                          disabled={!isEditing}
                          className={!isEditing ? "bg-secondary/50" : ""}
                        />
                        <p className="text-xs text-muted-foreground">Age helps us tailor narrative beats.</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city-of-birth">City of Birth</Label>
                        <Select
                          value={formData.city_of_birth ?? ""}
                          onValueChange={(value) =>
                            setFormData((prev) => ({ ...prev, city_of_birth: value || null }))
                          }
                          disabled={!isEditing || cityLoading}
                        >
                          <SelectTrigger
                            id="city-of-birth"
                            className={!isEditing ? "bg-secondary/50" : ""}
                          >
                            <SelectValue
                              placeholder={cityLoading ? "Loading cities..." : "Select a city"}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No listed city</SelectItem>
                            {cityOptions.map((city) => (
                              <SelectItem key={city.id} value={city.id}>
                                {city.name ?? "Unnamed City"}
                                {city.country ? `, ${city.country}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {cityError && <p className="text-xs text-destructive">{cityError}</p>}
                      </div>
                    </div>
                    {isEditing && (
                      <div className="flex gap-2 pt-4">
                        <Button 
                          onClick={handleSave}
                          disabled={saving}
                          className="bg-gradient-primary"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {saving ? "Saving..." : "Save Changes"}
                        </Button>
                        <Button 
                          onClick={() => setIsEditing(false)}
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Level</CardTitle>
                  <Star className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{profile.level || 1}</div>
                  <Progress value={((profile.experience || 0) % 1000) / 10} className="h-2 mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">{profile.experience || 0} XP</p>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Fame</CardTitle>
                  <Users className="h-4 w-4 text-accent" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent">{profile.fame || 0}</div>
                  <p className="text-xs text-muted-foreground">Total followers</p>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cash</CardTitle>
                  <DollarSign className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">${(profile.cash || 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Available funds</p>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Experience</CardTitle>
                  <Trophy className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">{profile.experience || 0}</div>
                  <p className="text-xs text-muted-foreground">Total XP earned</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Fan Insights
                </CardTitle>
                <CardDescription>Real-time metrics from your audience growth</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-primary/10 bg-secondary/40 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span>Total Fans</span>
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-2xl font-bold text-primary">{totalFansValue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">All-time supporters cheering you on</p>
                  </div>
                  <div className="rounded-lg border border-primary/10 bg-secondary/40 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span>Weekly Growth</span>
                      <TrendingUp className="h-4 w-4 text-success" />
                    </div>
                    <p className={`text-2xl font-bold ${weeklyGrowthClass}`}>{weeklyGrowthDisplay}</p>
                    <p className="text-xs text-muted-foreground">New fans gained over the last seven days</p>
                  </div>
                  <div className="rounded-lg border border-primary/10 bg-secondary/40 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span>Engagement Rate</span>
                      <Heart className="h-4 w-4 text-accent" />
                    </div>
                    <p className="text-2xl font-bold text-accent">{engagementRateDisplay}%</p>
                    <p className="text-xs text-muted-foreground">Percentage of fans interacting with your content</p>
                  </div>
                </div>
                {lastUpdatedLabel && (
                  <p className="mt-4 text-xs text-muted-foreground text-right">
                    Updated {lastUpdatedLabel}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5 text-primary" />
                  Musical Skills
                </CardTitle>
                <CardDescription>Your musical abilities and expertise levels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {instrumentSkillKeys.map(skillKey => {
                    const value = Number(skills?.[skillKey] ?? 0);
                    return (
                      <div key={skillKey} className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium capitalize">{skillKey}</span>
                          <span className="text-sm font-bold text-primary">{value}/100</span>
                        </div>
                        <Progress value={value} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          {value >= 80
                            ? "Expert"
                            : value >= 60
                              ? "Advanced"
                              : value >= 40
                                ? "Intermediate"
                                : "Beginner"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Professional Attributes
                </CardTitle>
                <CardDescription>Business, creative, and technical strengths</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {attributeKeys.map(attributeKey => {
                    const value = Number(attributes?.[attributeKey] ?? 0);
                    const percent = Math.min(100, (value / 1000) * 100);
                    return (
                      <div key={attributeKey} className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium capitalize">{attributeKey}</span>
                          <span className="text-sm font-bold text-primary">{value}/1000</span>
                        </div>
                        <Progress value={percent} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          High values unlock greater opportunities and campaign performance.
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          </Tabs>
        ) : (
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl font-bebas tracking-wide">No Active Character Selected</CardTitle>
              <CardDescription>
                Use the manager above to create or activate a performer to unlock detailed profile controls and statistics.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Profile;