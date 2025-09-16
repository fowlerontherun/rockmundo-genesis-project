import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Edit3
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";

const Profile = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, skills, updateProfile } = useGameData();
  
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    bio: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        username: profile.username || '',
        bio: profile.bio || ''
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await updateProfile(formData);
      setIsEditing(false);
      toast({
        title: "Profile Updated!",
        description: "Your profile has been successfully updated.",
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update profile",
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
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Failed to upload avatar",
      });
    } finally {
      setUploading(false);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Player Profile
            </h1>
            <p className="text-muted-foreground">Manage your musical identity</p>
          </div>
          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant={isEditing ? "outline" : "default"}
            className={isEditing ? "" : "bg-gradient-primary"}
          >
            <Edit3 className="h-4 w-4 mr-2" />
            {isEditing ? "Cancel" : "Edit Profile"}
          </Button>
        </div>

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
                  <Music className="h-5 w-5 text-primary" />
                  Musical Skills
                </CardTitle>
                <CardDescription>Your musical abilities and expertise levels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {skills && Object.entries(skills)
                    .filter(([key]) => !['id', 'user_id', 'created_at', 'updated_at'].includes(key))
                    .map(([skill, value]) => (
                      <div key={skill} className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium capitalize">{skill}</span>
                          <span className="text-sm font-bold text-primary">{value}/100</span>
                        </div>
                        <Progress value={value as number} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          {(value as number) >= 80 ? 'Expert' : 
                           (value as number) >= 60 ? 'Advanced' : 
                           (value as number) >= 40 ? 'Intermediate' : 'Beginner'}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;