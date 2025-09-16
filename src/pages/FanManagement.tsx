import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Users, 
  Heart, 
  MessageCircle, 
  Share2, 
  TrendingUp,
  Instagram,
  Twitter,
  Music,
  Send,
  ThumbsUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FanManagement = () => {
  const { toast } = useToast();
  const [postContent, setPostContent] = useState("");
  const [fanStats] = useState({
    totalFans: 12847,
    weeklyGrowth: 245,
    engagement: 78,
    demographics: {
      age1825: 35,
      age2635: 42,
      age3645: 18,
      age45plus: 5
    },
    platforms: {
      instagram: 5420,
      twitter: 3890,
      youtube: 2847,
      spotify: 690
    }
  });

  const [socialPosts] = useState([
    {
      id: 1,
      platform: "instagram",
      content: "Just finished recording our new single! 🎸 Can't wait for you all to hear it!",
      likes: 342,
      comments: 87,
      shares: 23,
      time: "2 hours ago"
    },
    {
      id: 2,
      platform: "twitter",
      content: "Big announcement coming tomorrow! Stay tuned rockstars! 🤘",
      likes: 156,
      comments: 45,
      shares: 67,
      time: "1 day ago"
    },
    {
      id: 3,
      platform: "youtube",
      content: "Behind the scenes: Studio session for 'Electric Dreams'",
      likes: 789,
      comments: 234,
      shares: 145,
      time: "3 days ago"
    }
  ]);

  const [fanMessages] = useState([
    { id: 1, name: "RockFan2023", message: "Your music changed my life! When is the next concert?", time: "1 hour ago", sentiment: "positive" },
    { id: 2, name: "MetalHead92", message: "The guitar solo in your last song was INSANE! 🤘", time: "3 hours ago", sentiment: "positive" },
    { id: 3, name: "MusicLover", message: "Would love to see you perform in Chicago!", time: "5 hours ago", sentiment: "request" },
    { id: 4, name: "VinylCollector", message: "Any plans for vinyl releases?", time: "8 hours ago", sentiment: "question" }
  ]);

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "instagram": return <Instagram className="h-4 w-4" />;
      case "twitter": return <Twitter className="h-4 w-4" />;
      case "youtube": return <Music className="h-4 w-4" />;
      default: return <Share2 className="h-4 w-4" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return "border-l-success";
      case "request": return "border-l-warning";
      case "question": return "border-l-primary";
      default: return "border-l-muted";
    }
  };

  const handlePost = () => {
    if (postContent.trim()) {
      toast({
        title: "Post Shared!",
        description: "Your message has been shared across all platforms",
      });
      setPostContent("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Fan Management
            </h1>
            <p className="text-muted-foreground">Connect with your audience and grow your fanbase</p>
          </div>
        </div>

        {/* Fan Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Fans</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{fanStats.totalFans.toLocaleString()}</div>
              <p className="text-xs text-success">+{fanStats.weeklyGrowth} this week</p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Engagement</CardTitle>
              <Heart className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{fanStats.engagement}%</div>
              <Progress value={fanStats.engagement} className="mt-2" />
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weekly Growth</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">+{fanStats.weeklyGrowth}</div>
              <p className="text-xs text-muted-foreground">New followers</p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Platform</CardTitle>
              <Instagram className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{fanStats.platforms.instagram.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Instagram followers</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Post to Social Media */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                Share with Fans
              </CardTitle>
              <CardDescription>Post updates across all your social platforms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="What's on your mind? Share updates, behind-the-scenes, or upcoming shows..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                className="min-h-[100px] bg-secondary/50"
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {Object.entries(fanStats.platforms).map(([platform, followers]) => (
                    <div key={platform} className="flex items-center gap-1 text-xs text-muted-foreground">
                      {getPlatformIcon(platform)}
                      {followers}
                    </div>
                  ))}
                </div>
                <Button 
                  onClick={handlePost}
                  disabled={!postContent.trim()}
                  className="bg-gradient-primary hover:shadow-electric"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Post
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Social Posts */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-accent" />
                Recent Posts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {socialPosts.map((post) => (
                <div key={post.id} className="p-3 rounded-lg bg-secondary/30 space-y-2">
                  <div className="flex items-center gap-2">
                    {getPlatformIcon(post.platform)}
                    <Badge variant="outline" className="text-xs">
                      {post.platform}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{post.time}</span>
                  </div>
                  <p className="text-sm">{post.content}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" /> {post.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" /> {post.comments}
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 className="h-3 w-3" /> {post.shares}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Fan Messages */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-accent" />
                Fan Messages
              </CardTitle>
              <CardDescription>Connect with your most dedicated fans</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {fanMessages.map((message) => (
                <div key={message.id} className={`p-3 rounded-lg bg-secondary/30 border-l-4 ${getSentimentColor(message.sentiment)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{message.name}</span>
                    <span className="text-xs text-muted-foreground">{message.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{message.message}</p>
                  <Button size="sm" variant="outline" className="text-xs">
                    <Heart className="h-3 w-3 mr-1" />
                    Reply
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FanManagement;