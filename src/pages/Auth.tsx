import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Lock, User, AlertCircle, Guitar, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import logo from "@/assets/rockmundo-new-logo.png";
import { cn } from "@/lib/utils";

type AuthTab = "login" | "signup" | "forgot";

interface StatusMessage {
  message: string;
  variant?: "info" | "success" | "error";
  showResend?: boolean;
}

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [activeTab, setActiveTab] = useState<AuthTab>("login");
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [resetLinkLoading, setResetLinkLoading] = useState(false);
  const [passwordUpdateLoading, setPasswordUpdateLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resendingVerification, setResendingVerification] = useState(false);

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
  useEffect(() => {
    const hash = window.location.hash;
    const isRecovery = hash.includes("type=recovery");

    if (isRecovery) {
      setIsResettingPassword(true);
      setStatus({
        message: "Enter a new password to finish resetting your account.",
        variant: "info",
      });
    }

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && !isRecovery) {
        navigate("/");
      }
    };
    checkUser();
  }, [navigate]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsResettingPassword(true);
        setStatus({
          message: "Enter a new password to finish resetting your account.",
          variant: "info",
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleTabChange = (value: AuthTab) => {
    setActiveTab(value);
    setError("");
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatus(null);
    setUnverifiedEmail("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) {
        const message = error.message?.toLowerCase() ?? "";
        if (message.includes("email not confirmed") || message.includes("confirm your email")) {
          setStatus({
            message: "Your email hasn't been verified yet. Check your inbox for the confirmation link or resend it below.",
            variant: "info",
            showResend: true,
          });
          setUnverifiedEmail(loginData.email);
        } else {
          setError(error.message);
        }
      } else if (data.user) {
        setStatus(null);
        setUnverifiedEmail("");
        toast({
          title: "Welcome back!",
          description: "Successfully logged into Rockmundo",
        });
        navigate("/");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatus(null);
    setUnverifiedEmail("");

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
        setUnverifiedEmail(signupData.email);
        setStatus({
          message: `We've sent a verification link to ${signupData.email}. Confirm your email to start playing!`,
          variant: "info",
          showResend: true,
        });
        setActiveTab("login");
        setLoginData((prev) => ({ ...prev, email: signupData.email }));
        toast({
          title: "Account created!",
          description: "Check your email to confirm your account",
        });
        // Don't navigate immediately - wait for email confirmation
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setResetLinkLoading(true);
    setError("");
    setStatus(null);

    try {
      const redirectUrl = `${window.location.origin}/auth`;
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        setError(error.message);
      } else {
        setStatus({
          message: `If an account exists for ${forgotPasswordEmail}, you'll receive a password reset link shortly.`,
          variant: "success",
        });
        setForgotPasswordEmail("");
        setActiveTab("login");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setResetLinkLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setPasswordUpdateLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setError(error.message);
      } else {
        setStatus({
          message: "Password updated successfully. You can now sign in with your new password.",
          variant: "success",
        });
        setNewPassword("");
        setConfirmPassword("");
        setIsResettingPassword(false);
        setActiveTab("login");
        window.history.replaceState(null, "", window.location.pathname);
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error("Error signing out after password reset:", signOutError);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setPasswordUpdateLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;

    setResendingVerification(true);
    setError("");

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: unverifiedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setStatus({
          message: `Verification email resent to ${unverifiedEmail}.`,
          variant: "success",
          showResend: false,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setResendingVerification(false);
    }
  };

  const handleDiscordLinkClick = async () => {
    const discordUrl = "https://discord.gg/KB45k3XJuZ";
    const newWindow = window.open(discordUrl, "_blank", "noopener,noreferrer");

    if (!newWindow) {
      toast({
        title: "Unable to open Discord",
        description: "We've copied the invite link so you can join manually.",
      });

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(discordUrl);
        } else {
          throw new Error("Clipboard API not available");
        }
      } catch (clipboardError) {
        console.error("Failed to copy Discord invite link:", clipboardError);
        toast({
          title: "Copy link manually",
          description: "Please copy this invite link: https://discord.gg/KB45k3XJuZ",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-sm sm:max-w-md">
        {/* Logo and Branding */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center mb-6">
            <img 
              src={logo} 
              alt="RockMundo - Live The Dream" 
              className="h-32 w-auto sm:h-40 md:h-48 object-contain drop-shadow-2xl" 
            />
          </div>
          <p className="text-sm text-foreground/80 font-oswald max-w-md mx-auto">
            The Ultimate Music Career Simulation - Build your band, rock the world
          </p>
        </div>

        <Card className="bg-card/90 backdrop-blur-sm border-border/40 shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-xl sm:text-2xl font-bebas tracking-wide">
              JOIN THE REVOLUTION
            </CardTitle>
            <CardDescription className="text-center text-sm font-oswald">
              Create your musical legacy or continue your journey
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="space-y-4">
              {status && (
                <Alert
                  variant={status.variant === "error" ? "destructive" : "default"}
                  className={cn(
                    status.variant === "info" && "border-border/50 bg-muted/60 text-foreground",
                    status.variant === "success" &&
                      "border-success/50 bg-success/15 text-success-foreground",
                  )}
                >
                  <Mail className="h-4 w-4" />
                  <AlertDescription className="space-y-2 text-left">
                    <span>{status.message}</span>
                    {status.showResend && (
                      <Button
                        onClick={handleResendVerification}
                        disabled={resendingVerification}
                        size="sm"
                        className="w-full border-border/60 bg-muted/60 text-foreground hover:bg-muted/80 hover:text-foreground"
                        variant="outline"
                      >
                        {resendingVerification ? "Resending..." : "Resend verification email"}
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {isResettingPassword ? (
                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="font-oswald text-sm">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="font-oswald text-sm">Confirm New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-primary hover:shadow-electric font-oswald text-base tracking-wide transition-all duration-200"
                    disabled={passwordUpdateLoading}
                  >
                    {passwordUpdateLoading ? "UPDATING PASSWORD..." : "UPDATE PASSWORD"}
                  </Button>
                </form>
              ) : (
                <Tabs
                  value={activeTab}
                  onValueChange={(value) => handleTabChange(value as AuthTab)}
                  className="space-y-4"
                >
                  <TabsList className="grid w-full grid-cols-3 bg-secondary/50">
                    <TabsTrigger value="login" className="font-oswald text-xs sm:text-sm">
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger value="signup" className="font-oswald text-xs sm:text-sm">
                      Sign Up
                    </TabsTrigger>
                    <TabsTrigger value="forgot" className="font-oswald text-xs sm:text-sm">
                      Forgot Password
                    </TabsTrigger>
                  </TabsList>

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

                  <TabsContent value="forgot">
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email" className="font-oswald text-sm">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="forgot-email"
                            type="email"
                            placeholder="your@email.com"
                            className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                            value={forgotPasswordEmail}
                            onChange={(e) => setForgotPasswordEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground font-oswald">
                        We'll send you a link to reset your password. Check your inbox and follow the instructions.
                      </p>

                      <Button
                        type="submit"
                        className="w-full h-11 bg-gradient-primary hover:shadow-electric font-oswald text-base tracking-wide transition-all duration-200"
                        disabled={resetLinkLoading}
                      >
                        {resetLinkLoading ? "SENDING RESET LINK..." : "SEND RESET LINK"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6 space-y-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Guitar className="h-4 w-4" />
            <p className="text-sm font-oswald">Ready to rock the world?</p>
            <Guitar className="h-4 w-4" />
          </div>
          <p className="text-xs text-muted-foreground/70 font-oswald">
            Join thousands of musicians living their dream
          </p>
          <Button
            type="button"
            onClick={handleDiscordLinkClick}
            variant="link"
            className="text-xs font-oswald text-primary underline underline-offset-4 hover:text-primary/80 px-0 h-auto"
          >
            Connect with the Rockmundo community on Discord
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;