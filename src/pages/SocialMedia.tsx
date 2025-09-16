import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Heart, MessageCircle, Repeat2, Share, TrendingUp, Users, Eye, Calendar } from "lucide-react";

const SocialMedia = () => {
  const { toast } = useToast();
  const [newPost, setNewPost] = useState("");
  const [followers] = useState(24500);
  const [posts, setPosts] = useState([
    {
      id: 1,
      content: "Just finished recording our new single! Can't wait for you all to hear it 🎸🔥",
      timestamp: "2 hours ago",
      likes: 1250,
      comments: 89,
      reposts: 234,
      views: 15600,
      engagement: 9.8
    },
    {
      id: 2,
      content: "Behind the scenes at today's photo shoot. New album artwork coming soon! 📸✨",
      timestamp: "1 day ago",
      likes: 2100,
      comments: 156,
      reposts: 445,
      views: 28900,
      engagement: 12.4
    },
    {
      id: 3,
      content: "Thank you Chicago! What an incredible show tonight. You were AMAZING! 🎤❤️",
      timestamp: "3 days ago",
      likes: 3400,
      comments: 298,
      reposts: 678,
      views: 45200,
      engagement: 15.2
    }
  ]);

  const campaigns = [
    {
      id: 1,
      name: "New Single Launch",
      platform: "All Platforms",
      budget: 5000,
      reach: 150000,
      engagement: 8.5,
      status: "Active",
      startDate: "Nov 1, 2024",
      endDate: "Nov 15, 2024"
    },
    {
      id: 2,
      name: "Tour Announcement",
      platform: "Instagram + TikTok",
      budget: 3000,
      reach: 89000,
      engagement: 12.2,
      status: "Completed",
      startDate: "Oct 15, 2024",
      endDate: "Oct 30, 2024"
    }
  ];

  const handleCreatePost = () => {
    if (!newPost.trim()) return;

    const post = {
      id: posts.length + 1,
      content: newPost,
      timestamp: "Just now",
      likes: 0,
      comments: 0,
      reposts: 0,
      views: 0,
      engagement: 0
    };

    setPosts([post, ...posts]);
    setNewPost("");
    toast({
      title: "Post Published!",
      description: "Your post has been shared across all platforms.",
    });
  };

  const handleLike = (postId: number) => {
    setPosts(posts.map(post => 
      post.id === postId 
        ? { ...post, likes: post.likes + 1 }
        : post
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-primary p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bebas text-cream tracking-wider">
            SOCIAL MEDIA HUB
          </h1>
          <p className="text-xl text-cream/80 font-oswald">
            Build your fanbase and create viral content
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-card/80 border-accent">
            <CardHeader className="pb-2">
              <CardTitle className="text-cream text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Followers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{followers.toLocaleString()}</div>
              <p className="text-cream/60 text-sm">+12% this week</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80 border-accent">
            <CardHeader className="pb-2">
              <CardTitle className="text-cream text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Engagement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">8.9%</div>
              <p className="text-cream/60 text-sm">Above average</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80 border-accent">
            <CardHeader className="pb-2">
              <CardTitle className="text-cream text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Monthly Reach
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">2.1M</div>
              <p className="text-cream/60 text-sm">+8% vs last month</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80 border-accent">
            <CardHeader className="pb-2">
              <CardTitle className="text-cream text-sm">Viral Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">7.8/10</div>
              <p className="text-cream/60 text-sm">Strong potential</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Post */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Create New Post</CardTitle>
                <CardDescription>Share updates with your fans across all platforms</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="What's happening in the studio? Share your thoughts..."
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  className="min-h-24 bg-background/50 border-accent text-cream placeholder:text-cream/60"
                />
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <Badge variant="outline">Instagram</Badge>
                    <Badge variant="outline">Twitter</Badge>
                    <Badge variant="outline">TikTok</Badge>
                    <Badge variant="outline">Facebook</Badge>
                  </div>
                  <Button 
                    onClick={handleCreatePost}
                    className="bg-accent hover:bg-accent/80 text-background font-bold"
                    disabled={!newPost.trim()}
                  >
                    Post Now
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Posts Feed */}
            <div className="space-y-4">
              <h3 className="text-2xl font-bebas text-cream tracking-wide">Recent Posts</h3>
              {posts.map((post) => (
                <Card key={post.id} className="bg-card/80 border-accent">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <p className="text-cream leading-relaxed">{post.content}</p>
                      <div className="flex justify-between items-center text-cream/60 text-sm">
                        <span>{post.timestamp}</span>
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            {post.views.toLocaleString()}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {post.engagement}% engagement
                          </Badge>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-accent/20">
                        <div className="flex gap-6">
                          <button 
                            onClick={() => handleLike(post.id)}
                            className="flex items-center gap-2 text-cream/80 hover:text-accent transition-colors"
                          >
                            <Heart className="h-4 w-4" />
                            <span>{post.likes}</span>
                          </button>
                          <button className="flex items-center gap-2 text-cream/80 hover:text-accent transition-colors">
                            <MessageCircle className="h-4 w-4" />
                            <span>{post.comments}</span>
                          </button>
                          <button className="flex items-center gap-2 text-cream/80 hover:text-accent transition-colors">
                            <Repeat2 className="h-4 w-4" />
                            <span>{post.reposts}</span>
                          </button>
                        </div>
                        <button className="flex items-center gap-2 text-cream/80 hover:text-accent transition-colors">
                          <Share className="h-4 w-4" />
                          Share
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Campaigns Sidebar */}
          <div className="space-y-6">
            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Active Campaigns</CardTitle>
                <CardDescription>Manage your promotional campaigns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="space-y-3 p-4 border border-accent/20 rounded-lg">
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-cream">{campaign.name}</h4>
                      <Badge 
                        variant={campaign.status === 'Active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {campaign.status}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-cream/80">
                        <span>Platform:</span>
                        <span>{campaign.platform}</span>
                      </div>
                      <div className="flex justify-between text-cream/80">
                        <span>Budget:</span>
                        <span>${campaign.budget.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-cream/80">
                        <span>Reach:</span>
                        <span>{campaign.reach.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-cream/80">
                        <span>Engagement:</span>
                        <span className="text-accent font-semibold">{campaign.engagement}%</span>
                      </div>
                    </div>
                    <div className="text-xs text-cream/60">
                      {campaign.startDate} - {campaign.endDate}
                    </div>
                  </div>
                ))}
                <Button className="w-full bg-accent hover:bg-accent/80 text-background">
                  Create Campaign
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Content Ideas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <h4 className="text-cream font-semibold">Trending Topics</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">#NewMusic</Badge>
                    <Badge variant="outline" className="text-xs">#BehindTheScenes</Badge>
                    <Badge variant="outline" className="text-xs">#LiveMusic</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-cream font-semibold">Suggested Posts</h4>
                  <ul className="text-sm text-cream/80 space-y-1">
                    <li>• Share studio photos</li>
                    <li>• Post gear close-ups</li>
                    <li>• Announce upcoming shows</li>
                    <li>• Share fan art</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialMedia;