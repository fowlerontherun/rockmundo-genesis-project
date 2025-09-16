import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Music, Mail, Lock, User, AlertCircle, Guitar, Star, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import rockmundoLogo from "@/assets/rockmundo-logo.png";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [loginData, setLoginData] = useState({
    email: "",
    password: ""
  });
  
  const [signupData, setSignupData] = useState({
    email: "",
    password: "",
    username: "",
    displayName: ""
  });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        navigate("/");
      }
    };
    checkUser();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) {
        setError(error.message);
      } else if (data.user) {
        toast({
          title: "Welcome back!",
          description: "Successfully logged into Rockmundo",
        });
        navigate("/");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username: signupData.username,
            display_name: signupData.displayName
          }
        }
      });

      if (error) {
        setError(error.message);
      } else if (data.user) {
        toast({
          title: "Account created!",
          description: "Check your email to confirm your account",
        });
        // Don't navigate immediately - wait for email confirmation
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const createAdminUser = async () => {
    setCreatingAdmin(true);
    setError("");

    try {
      // First, sign up the admin user
      const { data, error } = await supabase.auth.signUp({
        email: 'j.fowler1986@gmail.com',
        password: 'admin123',
        options: {
          data: {
            username: 'admin',
            display_name: 'Admin User'
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;

      if (data.user) {
        // Wait for the trigger to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update the user role to admin
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: 'admin' })
          .eq('user_id', data.user.id);

        if (roleError) throw roleError;

        // Update profile with admin stats
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            cash: 1000000,
            fame: 10000,
            level: 10,
            experience: 5000
          })
          .eq('user_id', data.user.id);

        if (profileError) throw profileError;

        // Update skills
        const { error: skillsError } = await supabase
          .from('player_skills')
          .update({
            guitar: 95,
            vocals: 95,
            drums: 95,
            bass: 95,
            performance: 95,
            songwriting: 95
          })
          .eq('user_id', data.user.id);

        if (skillsError) throw skillsError;

        toast({
          title: "Admin User Created!",
          description: "Admin user has been created successfully. You can now login with j.fowler1986@gmail.com / admin123"
        });
      }
    } catch (error: any) {
      console.error('Error creating admin user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create admin user"
      });
    } finally {
      setCreatingAdmin(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-stage flex flex-col items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-sm sm:max-w-md">
        {/* Logo and Branding */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center mb-4">
            <img 
              src={rockmundoLogo} 
              alt="RockMundo Logo" 
              className="h-16 w-16 sm:h-20 sm:w-20" 
            />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bebas tracking-wider text-foreground mb-2">
            ROCKMUNDO
          </h1>
          <p className="text-lg sm:text-xl font-oswald text-accent tracking-wide mb-1">
            LIVE THE DREAM
          </p>
          <p className="text-sm text-muted-foreground font-oswald">
            The Ultimate Music Career Simulation
          </p>
        </div>

        <Card className="bg-card/90 backdrop-blur-sm border-primary/30 shadow-electric">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-xl sm:text-2xl font-bebas tracking-wide">
              JOIN THE REVOLUTION
            </CardTitle>
            <CardDescription className="text-center text-sm font-oswald">
              Create your musical legacy or continue your journey
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <Tabs defaultValue="login" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
                <TabsTrigger value="login" className="font-oswald">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="font-oswald">Sign Up</TabsTrigger>
              </TabsList>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="font-oswald text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="your@email.com"
                        className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="font-oswald text-sm">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-gradient-primary hover:shadow-electric font-oswald text-base tracking-wide transition-all duration-200"
                    disabled={loading}
                  >
                    {loading ? "SIGNING IN..." : "SIGN IN"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="font-oswald text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your@email.com"
                        className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                        value={signupData.email}
                        onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-username" className="font-oswald text-sm">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-username"
                        type="text"
                        placeholder="rockstar123"
                        className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                        value={signupData.username}
                        onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                        required
                        minLength={3}
                        maxLength={20}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-displayname" className="font-oswald text-sm">Stage Name</Label>
                    <div className="relative">
                      <Star className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-displayname"
                        type="text"
                        placeholder="Rock Legend"
                        className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                        value={signupData.displayName}
                        onChange={(e) => setSignupData({ ...signupData, displayName: e.target.value })}
                        required
                        maxLength={50}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="font-oswald text-sm">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                        value={signupData.password}
                        onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-gradient-primary hover:shadow-electric font-oswald text-base tracking-wide transition-all duration-200 mt-4"
                    disabled={loading}
                  >
                    {loading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center mt-6 space-y-4">
          <Alert className="bg-primary/10 border-primary/20">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-left space-y-2">
              <div>
                <strong>Admin Access:</strong> For testing admin features, use:<br/>
                Email: <code>j.fowler1986@gmail.com</code><br/>
                Password: <code>admin123</code>
              </div>
              <Button 
                onClick={createAdminUser} 
                disabled={creatingAdmin}
                size="sm"
                className="w-full mt-2"
                variant="outline"
              >
                <Shield className="h-4 w-4 mr-2" />
                {creatingAdmin ? "Creating Admin User..." : "Create Admin User"}
              </Button>
            </AlertDescription>
          </Alert>
          
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Guitar className="h-4 w-4" />
            <p className="text-sm font-oswald">Ready to rock the world?</p>
            <Guitar className="h-4 w-4" />
          </div>
          <p className="text-xs text-muted-foreground/70 font-oswald">
            Join thousands of musicians living their dream
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;