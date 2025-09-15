import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Upload, 
  Palette, 
  Music, 
  Edit,
  Save,
  Camera
} from "lucide-react";

interface PlayerProfile {
  id: number;
  username: string;
  email: string;
  bio: string;
  social_links: string[];
  avatar?: Avatar;
}

interface Avatar {
  id: number;
  nickname: string;
  body_type: string;
  skin_tone: string;
  face_shape: string;
  hair_style: string;
  hair_color: string;
  top_clothing: string;
  bottom_clothing: string;
  shoes: string;
}

const Profile = () => {
  const { toast } = useToast();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingAvatar, setIsCreatingAvatar] = useState(false);
  const [avatarForm, setAvatarForm] = useState({
    nickname: "",
    body_type: "athletic",
    skin_tone: "medium",
    face_shape: "oval",
    hair_style: "shaggy",
    hair_color: "black",
    top_clothing: "leather_jacket",
    bottom_clothing: "ripped_jeans",
    shoes: "combat_boots"
  });

  const bodyTypes = ["slim", "athletic", "stocky", "curvy"];
  const skinTones = ["light", "medium", "tan", "dark"];
  const faceShapes = ["oval", "round", "square", "heart"];
  const hairStyles = ["shaggy", "mohawk", "long", "buzz", "curly", "straight"];
  const hairColors = ["black", "brown", "blonde", "red", "blue", "purple", "green"];
  const clothing = {
    tops: ["t_shirt", "leather_jacket", "hoodie", "band_tee", "vest"],
    bottoms: ["jeans", "ripped_jeans", "leather_pants", "shorts", "skirt"],
    shoes: ["sneakers", "combat_boots", "dress_shoes", "sandals", "high_tops"]
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // Simulated API call - replace with actual API
      const mockProfile = {
        id: 1,
        username: "rockstar_demo",
        email: "demo@rockmundo.test",
        bio: "Rising rock star from the underground scene",
        social_links: ["@rockstar_demo", "youtube.com/rockstardemo"],
        avatar: {
          id: 1,
          nickname: "Storm",
          body_type: "athletic",
          skin_tone: "medium",
          face_shape: "oval",
          hair_style: "shaggy",
          hair_color: "black",
          top_clothing: "leather_jacket",
          bottom_clothing: "ripped_jeans",
          shoes: "combat_boots"
        }
      };
      setProfile(mockProfile);
      if (mockProfile.avatar) {
        setAvatarForm(mockProfile.avatar);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive"
      });
    }
  };

  const saveProfile = async () => {
    try {
      // Simulated API call
      toast({
        title: "Success",
        description: "Profile updated successfully"
      });
      setIsEditing(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive"
      });
    }
  };

  const createAvatar = async () => {
    try {
      // Simulated API call
      const newAvatar = { ...avatarForm, id: Date.now() };
      setProfile(prev => prev ? { ...prev, avatar: newAvatar } : prev);
      setIsCreatingAvatar(false);
      toast({
        title: "Success",
        description: "Avatar created successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create avatar",
        variant: "destructive"
      });
    }
  };

  if (!profile) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Profile & Avatar
          </h1>
          <Button 
            onClick={() => setIsEditing(!isEditing)}
            variant={isEditing ? "destructive" : "default"}
            className="bg-gradient-primary hover:shadow-electric"
          >
            {isEditing ? <Save className="h-4 w-4 mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
            {isEditing ? "Save" : "Edit"}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Info */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Player Profile
              </CardTitle>
              <CardDescription>Your RockMundo identity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={profile.username}
                  disabled={!isEditing}
                  onChange={(e) => setProfile({...profile, username: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  disabled={!isEditing}
                  onChange={(e) => setProfile({...profile, email: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={profile.bio}
                  disabled={!isEditing}
                  onChange={(e) => setProfile({...profile, bio: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Social Links</Label>
                <div className="flex flex-wrap gap-2">
                  {profile.social_links.map((link, index) => (
                    <Badge key={index} variant="outline" className="border-primary/20">
                      {link}
                    </Badge>
                  ))}
                </div>
                {isEditing && (
                  <Input
                    placeholder="Add social link..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value) {
                        setProfile({
                          ...profile, 
                          social_links: [...profile.social_links, e.currentTarget.value]
                        });
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                )}
              </div>

              {isEditing && (
                <Button onClick={saveProfile} className="w-full bg-gradient-primary">
                  <Save className="h-4 w-4 mr-2" />
                  Save Profile
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Avatar */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-accent" />
                Avatar
              </CardTitle>
              <CardDescription>Your visual identity in RockMundo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.avatar ? (
                <div className="text-center space-y-4">
                  <Avatar className="w-24 h-24 mx-auto ring-2 ring-primary/20">
                    <AvatarImage src="/placeholder.svg" />
                    <AvatarFallback className="bg-gradient-primary text-white text-xl">
                      {profile.avatar.nickname.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-primary">{profile.avatar.nickname}</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mt-2">
                      <div>Body: {profile.avatar.body_type}</div>
                      <div>Skin: {profile.avatar.skin_tone}</div>
                      <div>Hair: {profile.avatar.hair_style}</div>
                      <div>Color: {profile.avatar.hair_color}</div>
                    </div>
                  </div>

                  <Button 
                    onClick={() => setIsCreatingAvatar(true)}
                    variant="outline"
                    className="w-full border-primary/20 hover:bg-primary/10"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Customize Avatar
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 mx-auto rounded-full bg-secondary/30 flex items-center justify-center">
                    <User className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <Button 
                    onClick={() => setIsCreatingAvatar(true)}
                    className="w-full bg-gradient-primary"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Create Avatar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Avatar Creation Modal */}
        {isCreatingAvatar && (
          <Card className="bg-card/90 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-accent" />
                {profile.avatar ? "Customize" : "Create"} Avatar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nickname">Nickname</Label>
                  <Input
                    id="nickname"
                    value={avatarForm.nickname}
                    onChange={(e) => setAvatarForm({...avatarForm, nickname: e.target.value})}
                    placeholder="Enter avatar nickname"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Body Type</Label>
                  <Select value={avatarForm.body_type} onValueChange={(value) => setAvatarForm({...avatarForm, body_type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {bodyTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Skin Tone</Label>
                  <Select value={avatarForm.skin_tone} onValueChange={(value) => setAvatarForm({...avatarForm, skin_tone: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {skinTones.map((tone) => (
                        <SelectItem key={tone} value={tone}>
                          {tone.charAt(0).toUpperCase() + tone.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Face Shape</Label>
                  <Select value={avatarForm.face_shape} onValueChange={(value) => setAvatarForm({...avatarForm, face_shape: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {faceShapes.map((shape) => (
                        <SelectItem key={shape} value={shape}>
                          {shape.charAt(0).toUpperCase() + shape.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Hair Style</Label>
                  <Select value={avatarForm.hair_style} onValueChange={(value) => setAvatarForm({...avatarForm, hair_style: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hairStyles.map((style) => (
                        <SelectItem key={style} value={style}>
                          {style.replace('_', ' ').charAt(0).toUpperCase() + style.replace('_', ' ').slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Hair Color</Label>
                  <Select value={avatarForm.hair_color} onValueChange={(value) => setAvatarForm({...avatarForm, hair_color: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hairColors.map((color) => (
                        <SelectItem key={color} value={color}>
                          {color.charAt(0).toUpperCase() + color.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Top</Label>
                  <Select value={avatarForm.top_clothing} onValueChange={(value) => setAvatarForm({...avatarForm, top_clothing: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {clothing.tops.map((top) => (
                        <SelectItem key={top} value={top}>
                          {top.replace('_', ' ').charAt(0).toUpperCase() + top.replace('_', ' ').slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Bottom</Label>
                  <Select value={avatarForm.bottom_clothing} onValueChange={(value) => setAvatarForm({...avatarForm, bottom_clothing: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {clothing.bottoms.map((bottom) => (
                        <SelectItem key={bottom} value={bottom}>
                          {bottom.replace('_', ' ').charAt(0).toUpperCase() + bottom.replace('_', ' ').slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Shoes</Label>
                  <Select value={avatarForm.shoes} onValueChange={(value) => setAvatarForm({...avatarForm, shoes: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {clothing.shoes.map((shoe) => (
                        <SelectItem key={shoe} value={shoe}>
                          {shoe.replace('_', ' ').charAt(0).toUpperCase() + shoe.replace('_', ' ').slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={createAvatar}
                  className="flex-1 bg-gradient-primary"
                  disabled={!avatarForm.nickname}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {profile.avatar ? "Update" : "Create"} Avatar
                </Button>
                <Button 
                  onClick={() => setIsCreatingAvatar(false)}
                  variant="outline"
                  className="border-primary/20"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Profile;