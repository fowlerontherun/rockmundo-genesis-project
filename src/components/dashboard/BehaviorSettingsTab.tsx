import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  useBehaviorSettings, 
  type BehaviorSettings,
} from "@/hooks/useBehaviorSettings";
import { 
  Plane, Hotel, PartyPopper, Users, Mic, Moon, UsersRound,
  Heart, TrendingUp, AlertTriangle, Shield, Flame
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingOption {
  value: string;
  label: string;
  description: string;
  riskLevel: "low" | "medium" | "high" | "extreme";
}

interface SettingCategory {
  key: keyof BehaviorSettings;
  title: string;
  description: string;
  icon: React.ReactNode;
  options: SettingOption[];
}

const SETTING_CATEGORIES: SettingCategory[] = [
  {
    key: "travel_comfort",
    title: "Travel Comfort",
    description: "How you travel between cities and venues",
    icon: <Plane className="h-5 w-5" />,
    options: [
      { value: "budget", label: "Budget", description: "Cramped buses, cheap flights", riskLevel: "medium" },
      { value: "standard", label: "Standard", description: "Comfortable but not flashy", riskLevel: "low" },
      { value: "luxury", label: "Luxury", description: "First class, private vehicles", riskLevel: "low" },
    ],
  },
  {
    key: "hotel_standard",
    title: "Hotel Standard",
    description: "Where you rest between shows",
    icon: <Hotel className="h-5 w-5" />,
    options: [
      { value: "hostel", label: "Hostel", description: "Shared rooms, basic facilities", riskLevel: "high" },
      { value: "budget", label: "Budget", description: "No frills, gets the job done", riskLevel: "medium" },
      { value: "standard", label: "Standard", description: "Clean and comfortable", riskLevel: "low" },
      { value: "luxury", label: "Luxury", description: "Premium amenities, great service", riskLevel: "low" },
      { value: "suite", label: "Suite", description: "The best of the best", riskLevel: "low" },
    ],
  },
  {
    key: "partying_intensity",
    title: "Partying Intensity",
    description: "Your after-show lifestyle",
    icon: <PartyPopper className="h-5 w-5" />,
    options: [
      { value: "abstinent", label: "Abstinent", description: "No alcohol or partying", riskLevel: "low" },
      { value: "light", label: "Light", description: "Occasional social drinks", riskLevel: "low" },
      { value: "moderate", label: "Moderate", description: "Regular celebrations", riskLevel: "medium" },
      { value: "heavy", label: "Heavy", description: "Party hard, recover harder", riskLevel: "high" },
      { value: "legendary", label: "Legendary", description: "Stories that can't be told", riskLevel: "extreme" },
    ],
  },
  {
    key: "fan_interaction",
    title: "Fan Interaction",
    description: "How you engage with your audience",
    icon: <Users className="h-5 w-5" />,
    options: [
      { value: "distant", label: "Distant", description: "Keep fans at arm's length", riskLevel: "low" },
      { value: "professional", label: "Professional", description: "Friendly but boundaries", riskLevel: "low" },
      { value: "friendly", label: "Friendly", description: "Accessible and warm", riskLevel: "medium" },
      { value: "wild", label: "Wild", description: "Crowd surfing, stage diving", riskLevel: "high" },
    ],
  },
  {
    key: "media_behavior",
    title: "Media Behavior",
    description: "How you handle press and interviews",
    icon: <Mic className="h-5 w-5" />,
    options: [
      { value: "reclusive", label: "Reclusive", description: "Avoid media spotlight", riskLevel: "low" },
      { value: "professional", label: "Professional", description: "Polished, on-message", riskLevel: "low" },
      { value: "outspoken", label: "Outspoken", description: "Say what you think", riskLevel: "medium" },
      { value: "controversial", label: "Controversial", description: "Court drama for headlines", riskLevel: "extreme" },
    ],
  },
  {
    key: "afterparty_attendance",
    title: "Afterparty Attendance",
    description: "Post-show party participation",
    icon: <Moon className="h-5 w-5" />,
    options: [
      { value: "never", label: "Never", description: "Straight to bed after shows", riskLevel: "low" },
      { value: "sometimes", label: "Sometimes", description: "On special occasions", riskLevel: "medium" },
      { value: "always", label: "Always", description: "Never miss a party", riskLevel: "high" },
    ],
  },
  {
    key: "entourage_size",
    title: "Entourage Size",
    description: "How many people travel with you",
    icon: <UsersRound className="h-5 w-5" />,
    options: [
      { value: "solo", label: "Solo", description: "Just you and the music", riskLevel: "low" },
      { value: "small", label: "Small", description: "Essential crew only", riskLevel: "low" },
      { value: "medium", label: "Medium", description: "Crew plus some friends", riskLevel: "medium" },
      { value: "large", label: "Large", description: "Full entourage experience", riskLevel: "medium" },
    ],
  },
];

const getRiskBadgeVariant = (level: SettingOption["riskLevel"]) => {
  switch (level) {
    case "low": return "secondary";
    case "medium": return "outline";
    case "high": return "default";
    case "extreme": return "destructive";
  }
};

export function BehaviorSettingsTab() {
  const { 
    settings, 
    isLoading, 
    updateSettings, 
    isUpdating, 
    riskScore, 
    riskLevel,
    healthModifiers 
  } = useBehaviorSettings();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Unable to load behavior settings. Please try again.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Risk Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Lifestyle Risk Profile
          </CardTitle>
          <CardDescription>
            Your current touring lifestyle settings and their impact
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Risk Score */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Risk Score</span>
                <span className={cn("font-bold", riskLevel.color)}>{riskScore}/100</span>
              </div>
              <Progress value={riskScore} className="h-3" />
              <p className={cn("text-sm font-medium", riskLevel.color)}>
                {riskLevel.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {riskLevel.description}
              </p>
            </div>

            {/* Health Impact */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Heart className="h-4 w-4 text-red-500" />
                Health Recovery
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-lg font-bold",
                  healthModifiers.recoveryModifier > 0 ? "text-green-500" : 
                  healthModifiers.recoveryModifier < 0 ? "text-red-500" : ""
                )}>
                  {healthModifiers.recoveryModifier > 0 ? "+" : ""}{healthModifiers.recoveryModifier}%
                </span>
                <span className="text-xs text-muted-foreground">recovery rate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-lg font-bold",
                  healthModifiers.restEffectiveness > 0 ? "text-green-500" : 
                  healthModifiers.restEffectiveness < 0 ? "text-red-500" : ""
                )}>
                  {healthModifiers.restEffectiveness > 0 ? "+" : ""}{healthModifiers.restEffectiveness}%
                </span>
                <span className="text-xs text-muted-foreground">rest effectiveness</span>
              </div>
            </div>

            {/* Event Likelihood */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-primary" />
                Event Likelihood
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Wild party events</span>
                  <span className={riskScore > 50 ? "text-orange-500" : "text-muted-foreground"}>
                    {riskScore > 50 ? "High" : riskScore > 25 ? "Medium" : "Low"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Fan encounters</span>
                  <span className={settings.fan_interaction === "wild" ? "text-orange-500" : "text-muted-foreground"}>
                    {settings.fan_interaction === "wild" ? "High" : settings.fan_interaction === "friendly" ? "Medium" : "Low"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Media incidents</span>
                  <span className={settings.media_behavior === "controversial" ? "text-red-500" : "text-muted-foreground"}>
                    {settings.media_behavior === "controversial" ? "Very High" : settings.media_behavior === "outspoken" ? "Medium" : "Low"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {riskScore > 60 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">High Risk Lifestyle</p>
                <p className="text-xs text-muted-foreground">
                  Your current settings will lead to more health drain and dramatic events. 
                  Consider moderating some behaviors for sustainability.
                </p>
              </div>
            </div>
          )}

          {riskScore < 20 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <Shield className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-600">Safe Lifestyle</p>
                <p className="text-xs text-muted-foreground">
                  You're playing it safe. Great for health, but you might miss some legendary opportunities.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Categories */}
      <div className="grid gap-4 md:grid-cols-2">
        {SETTING_CATEGORIES.map((category) => (
          <Card key={category.key}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {category.icon}
                {category.title}
              </CardTitle>
              <CardDescription className="text-xs">
                {category.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={settings[category.key] as string}
                onValueChange={(value) => updateSettings({ [category.key]: value })}
                disabled={isUpdating}
                className="space-y-2"
              >
                {category.options.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={`${category.key}-${option.value}`} />
                    <Label 
                      htmlFor={`${category.key}-${option.value}`} 
                      className="flex flex-1 items-center justify-between cursor-pointer"
                    >
                      <div>
                        <span className="font-medium">{option.label}</span>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                      <Badge variant={getRiskBadgeVariant(option.riskLevel)} className="ml-2 text-xs">
                        {option.riskLevel}
                      </Badge>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
