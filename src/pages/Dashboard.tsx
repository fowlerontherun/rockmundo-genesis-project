import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Music, 
  Users, 
  Calendar, 
  TrendingUp, 
  Guitar, 
  Mic, 
  Headphones,
  DollarSign,
  Star,
  Play,
  AlertCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";

const genderLabels: Record<string, string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, skills, activities, loading, error } = useGameData();
  const [birthCityLabel, setBirthCityLabel] = useState<string | null>(null);

  const skillColor = (value: number) => {
    if (value >= 80) return "text-success";
    if (value >= 60) return "text-warning";
    return "text-muted-foreground";
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "gig": return <Play className="h-4 w-4" />;
      case "skill": return <TrendingUp className="h-4 w-4" />;
      case "fan": return <Users className="h-4 w-4" />;
      case "song": return <Music className="h-4 w-4" />;
      case "join": return <Star className="h-4 w-4" />;
      case "busking": return <Mic className="h-4 w-4" />;
      default: return <Star className="h-4 w-4" />;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadCity = async (cityId: string) => {
      try {
        const { data, error } = await supabase
          .from("cities")
          .select("name, country")
          .eq("id", cityId)
          .maybeSingle();

        if (error) throw error;
        if (!isMounted) return;

        if (data) {
          const cityName = data.name ?? "Unnamed City";
          const label = data.country ? `${cityName}, ${data.country}` : cityName;
          setBirthCityLabel(label ?? null);
        } else {
          setBirthCityLabel(null);
        }
      } catch (error) {
        console.error("Error loading birth city:", error);
        if (isMounted) {
          setBirthCityLabel(null);
        }
      }
    };

    if (profile?.city_of_birth) {
      void loadCity(profile.city_of_birth);
    } else {
      setBirthCityLabel(null);
    }

    return () => {
      isMounted = false;
    };
  }, [profile?.city_of_birth]);

  const profileGenderLabel = useMemo(() => {
    if (!profile?.gender) return genderLabels.prefer_not_to_say;
    return genderLabels[profile.gender] ?? genderLabels.prefer_not_to_say;
  }, [profile?.gender]);


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading your music empire...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-stage p-6">
        <div className="max-w-2xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error loading your data: {error}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!profile || !skills) {
    return null;
  }

  // Calculate experience to next level (simple formula)
  const experienceToNext = profile.level * 1000;
  const experienceProgress = (profile.experience % 1000);

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bebas tracking-wider bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              Welcome back, {profile.display_name || profile.username}
            </h1>
            <p className="text-muted-foreground font-oswald">Ready to rock the world?</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
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
          <div className="flex gap-2">
            <Button
              onClick={() => navigate("/band")}
              className="bg-gradient-primary hover:shadow-electric"
            >
              <Users className="h-4 w-4 mr-2" />
              Band Manager
            </Button>
            <Button
              onClick={() => navigate("/gigs")}
              variant="outline"
              className="border-primary/20 hover:bg-primary/10"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Book Gigs
            </Button>
            <Button
              onClick={() => navigate("/busking")}
              variant="outline"
              className="border-primary/20 hover:bg-primary/10"
            >
              <Mic className="h-4 w-4 mr-2" />
              Street Busking
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Level</CardTitle>
              <Star className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{profile.level}</div>
              <Progress 
                value={(experienceProgress / 1000) * 100} 
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {experienceProgress}/1000 XP to level {profile.level + 1}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cash</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                ${profile.cash.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                From recent performances
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fame</CardTitle>
              <TrendingUp className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{profile.fame}</div>
              <p className="text-xs text-muted-foreground">
                Keep performing to gain more fame!
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Band Popularity</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">Solo Artist</div>
              <p className="text-xs text-muted-foreground">
                Create or join a band to unlock more features
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Skills */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Guitar className="h-5 w-5 text-primary" />
                Skills
              </CardTitle>
              <CardDescription>Your musical abilities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(skills).filter(([key]) => 
                ['vocals', 'guitar', 'bass', 'drums', 'songwriting', 'performance'].includes(key)
              ).map(([skill, value]) => (
                <div key={skill} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize font-medium">{skill}</span>
                    <span className={skillColor(value as number)}>{value}/100</span>
                  </div>
                  <Progress value={value as number} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Band Info & Activity */}
          <div className="space-y-4">
            {/* Band Info */}
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-accent" />
                  Solo Career
                </CardTitle>
                <CardDescription>Build your musical empire</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-semibold">Independent Artist</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Next Goal</p>
                    <p className="font-semibold">Form a Band</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5 text-primary" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activities.length > 0 ? activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg bg-secondary/30">
                    <div className="text-primary mt-0.5">
                      {getActivityIcon(activity.activity_type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.created_at).toLocaleDateString()}
                      </p>
                      {activity.earnings > 0 && (
                        <Badge variant="outline" className="mt-1 text-xs border-success text-success">
                          +${activity.earnings}
                        </Badge>
                      )}
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    No recent activity. Start your musical journey!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;