import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Music, Users, Globe, Sparkles, Bug, MessageCircle, 
  Radio, Guitar, TrendingUp, Award, ArrowLeft 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/rockmundo-new-logo.png";
import discordLogo from "@/assets/discord-logo.png";

const About = () => {
  const navigate = useNavigate();

  const features = [
    { icon: Guitar, title: "Band Management", description: "Create and manage your own virtual rock band" },
    { icon: Music, title: "Songwriting & Recording", description: "Write lyrics, compose music, and record in professional studios" },
    { icon: Radio, title: "Media & Promotion", description: "Get radio airplay, TV appearances, and build your fanbase" },
    { icon: TrendingUp, title: "Streaming & Charts", description: "Release on streaming platforms and climb the charts" },
    { icon: Globe, title: "World Tour", description: "Travel the globe, perform at venues worldwide" },
    { icon: Award, title: "Fame & Legacy", description: "Build your reputation and become a rock legend" },
  ];

  const handleDiscordClick = () => {
    window.open("https://discord.gg/KB45k3XJuZ", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/auth")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Button>

        {/* Logo and Title */}
        <div className="text-center mb-8">
          <img 
            src={logo} 
            alt="RockMundo" 
            className="h-32 w-auto mx-auto mb-4 drop-shadow-2xl"
          />
          <div className="flex items-center justify-center gap-2 mb-2">
            <h1 className="text-4xl font-bebas tracking-wide">RockMundo</h1>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-lg px-3 py-1">
              BETA
            </Badge>
          </div>
          <p className="text-xl text-muted-foreground font-oswald">
            Live The Dream - A Rock Star Simulation Game
          </p>
        </div>

        {/* Beta Warning */}
        <Alert className="mb-8 border-warning/50 bg-warning/10">
          <Bug className="h-5 w-5 text-warning" />
          <AlertTitle className="text-warning font-bold">Beta Version</AlertTitle>
          <AlertDescription className="text-foreground">
            RockMundo is currently in active development. You may encounter bugs, 
            missing features, or unexpected behavior. We appreciate your patience 
            as we work to make the game better every day!
          </AlertDescription>
        </Alert>

        {/* What is RockMundo */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              What is RockMundo?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              RockMundo is a browser-based rock star simulation game where you live the dream of 
              becoming a world-famous musician. Start from nothing, form a band, write songs, 
              record albums, perform at venues around the world, and build your legacy.
            </p>
            <p className="text-muted-foreground">
              With AI-generated music, deep band management mechanics, and a living world of 
              radio stations, streaming platforms, and competitive charts, RockMundo offers 
              an immersive experience for anyone who's ever dreamed of rock stardom.
            </p>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Game Features</CardTitle>
            <CardDescription>What you can do in RockMundo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div 
                    key={feature.title}
                    className="p-4 rounded-lg border border-border/50 bg-card hover:border-primary/30 transition-colors"
                  >
                    <Icon className="h-8 w-8 text-primary mb-2" />
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Development Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Development Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">Active Development</Badge>
              <Badge variant="secondary">Daily Updates</Badge>
              <Badge variant="outline">Community Driven</Badge>
            </div>
            <p className="text-muted-foreground">
              Our development team pushes updates almost daily, adding new features, 
              fixing bugs, and improving gameplay based on community feedback. 
              Check the Version History in-game to see what's changed!
            </p>
          </CardContent>
        </Card>

        {/* Bug Reporting */}
        <Card className="mb-8 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-destructive" />
              Found a Bug?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Help us make RockMundo better! If you encounter any bugs, glitches, or 
              unexpected behavior, please report them on our Discord server in the 
              <strong className="text-foreground"> #bug-log</strong> channel.
            </p>
            <Button onClick={handleDiscordClick} className="gap-2">
              <img src={discordLogo} alt="Discord" className="h-5 w-5" />
              Join Discord & Report Bugs
            </Button>
          </CardContent>
        </Card>

        {/* Community */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Join Our Community
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Connect with other players, share your music career achievements, 
              get help, suggest features, and stay updated on the latest developments!
            </p>
            <Button 
              onClick={handleDiscordClick} 
              variant="outline" 
              size="lg"
              className="gap-2"
            >
              <img src={discordLogo} alt="Discord" className="h-5 w-5" />
              Join the RockMundo Discord
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>© 2024-2025 RockMundo. All rights reserved.</p>
          <p className="mt-1">Made with ♪ for music lovers everywhere.</p>
        </div>
      </div>
    </div>
  );
};

export default About;
