import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Disc, Radio, Video, ListMusic, TrendingUp, Music4 } from "lucide-react";

const MusicHub = () => {
  const navigate = useNavigate();

  const musicSections = [
    {
      title: "Songwriting",
      description: "Write new songs and manage your song catalog",
      icon: Music,
      path: "/songwriting",
      color: "text-purple-500",
    },
    {
      title: "Recording Studio",
      description: "Record your songs and improve quality",
      icon: Disc,
      path: "/recording-studio",
      color: "text-blue-500",
    },
    {
      title: "Release Manager",
      description: "Create and manage music releases",
      icon: Music4,
      path: "/release-manager",
      color: "text-green-500",
    },
    {
      title: "Streaming",
      description: "Distribute music to streaming platforms",
      icon: TrendingUp,
      path: "/streaming",
      color: "text-orange-500",
    },
    {
      title: "Radio",
      description: "Submit songs to radio stations",
      icon: Radio,
      path: "/radio",
      color: "text-red-500",
    },
    {
      title: "Music Videos",
      description: "Create and manage music videos",
      icon: Video,
      path: "/music-videos",
      color: "text-pink-500",
    },
    {
      title: "Song Manager",
      description: "View and manage all your songs",
      icon: ListMusic,
      path: "/song-manager",
      color: "text-cyan-500",
    },
  ];

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Music Hub</h1>
        <p className="text-muted-foreground">
          Your central hub for all music-related activities
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {musicSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card
              key={section.path}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(section.path)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${section.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{section.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default MusicHub;
