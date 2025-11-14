import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Mic2, 
  Play, 
  Music, 
  ListMusic, 
  Disc, 
  TrendingUp,
  ArrowRight,
  Sparkles
} from "lucide-react";

const MusicStudio = () => {
  const musicFeatures = [
    {
      title: "Recording Studio",
      description: "Record your songs with professional producers and studios. Choose from 50+ producers with varying specialties and hire orchestras for premium recordings.",
      icon: Mic2,
      path: "/recording-studio",
      color: "bg-purple-500/10 text-purple-500",
      highlights: ["50+ Producers", "Orchestra Hiring", "Alternative Versions"],
    },
    {
      title: "Songwriting",
      description: "Create original songs with AI-powered lyrics generation, collaborate with co-writers, and manage your creative projects.",
      icon: Play,
      path: "/studio/songwriting",
      color: "bg-blue-500/10 text-blue-500",
      highlights: ["AI Lyrics", "Collaboration", "Genre Variety"],
    },
    {
      title: "Song Manager",
      description: "Organize your song catalog, track royalties, manage releases, and view performance analytics.",
      icon: Music,
      path: "/songs",
      color: "bg-green-500/10 text-green-500",
      highlights: ["Catalog Management", "Royalty Tracking", "Analytics"],
    },
    {
      title: "Setlist Manager",
      description: "Build and organize setlists for live performances, rehearsals, and tours. Optimize song order for maximum impact.",
      icon: ListMusic,
      path: "/setlists",
      color: "bg-amber-500/10 text-amber-500",
      highlights: ["Live Setlists", "Rehearsal Planning", "Tour Ready"],
    },
    {
      title: "Song Marketplace",
      description: "Buy, sell, and trade songs with other artists. Discover hidden gems or monetize your unused compositions.",
      icon: TrendingUp,
      path: "/song-market",
      color: "bg-pink-500/10 text-pink-500",
      highlights: ["Buy Songs", "Sell Compositions", "Trading"],
    },
    {
      title: "Streaming Platforms",
      description: "Release your music on streaming platforms, track plays, build playlists, and grow your audience.",
      icon: Disc,
      path: "/streaming",
      color: "bg-indigo-500/10 text-indigo-500",
      highlights: ["Platform Release", "Play Tracking", "Audience Growth"],
    },
  ];

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Hero Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold">Music Hub</h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Your central command center for all things music creation. From writing and recording to releasing and performing, 
          manage every aspect of your musical journey.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {musicFeatures.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.path} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-4`}>
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
                <CardDescription className="text-sm">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Highlights */}
                <div className="flex flex-wrap gap-2">
                  {feature.highlights.map((highlight) => (
                    <span
                      key={highlight}
                      className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>

                {/* Action Button */}
                <Link to={feature.path}>
                  <Button className="w-full group" variant="outline">
                    Open {feature.title}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Stats or Tips Section */}
      <Card className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Pro Tip
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            💡 <strong>Recording Tip:</strong> Start with songwriting to create your tracks, then head to the Recording Studio 
            to enhance their quality with professional producers. Higher quality songs perform better on streaming platforms 
            and at live shows!
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MusicStudio;
