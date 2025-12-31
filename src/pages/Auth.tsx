import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Mail, Lock, AlertCircle, Users, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import logo from "@/assets/rockmundo-new-logo.png";
import discordLogo from "@/assets/discord-logo.png";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlayerPresenceStats } from "@/hooks/usePlayerPresenceStats";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsDialog, TERMS_VERSION } from "@/components/legal/TermsDialog";

type AuthTab = "login" | "signup" | "forgot";

interface StatusMessage {
  message: string;
  variant?: "info" | "success" | "error";
  showResend?: boolean;
}

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
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

  const {
    totalPlayers,
    onlinePlayers,
    loading: presenceLoading,
    error: presenceError
  } = usePlayerPresenceStats({
    refreshInterval: 45_000,
    publicMode: true // Use public presence since user isn't logged in yet
  });

  const formatPresenceValue = (value: number | null) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value.toLocaleString();
    }
    return "—";
  };

  const [loginData, setLoginData] = useState({
    email: "",
    password: ""
  });

  const [signupData, setSignupData] = useState({
    email: "",
    password: ""
  });

  const [termsAccepted, setTermsAccepted] = useState(false);

  const getBrowserOrigin = () => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.location.origin;
  };

  const formatRequirementList = (requirements: string[]) => {
    if (requirements.length === 1) {
      return requirements[0];
    }
    if (requirements.length === 2) {
      return `${requirements[0]} and ${requirements[1]}`;
    }
    const allButLast = requirements.slice(0, -1);
    const last = requirements[requirements.length - 1];
    return `${allButLast.join(", ")}, and ${last}`;
  };

  const assessPasswordStrength = (password: string) => {
    const trimmed = password.trim();
    const requirements = [
      { check: trimmed.length >= 8, message: t('auth.passwordReq8Chars') },
      { check: /[a-z]/.test(trimmed), message: t('auth.passwordReqLowercase') },
      { check: /[A-Z]/.test(trimmed), message: t('auth.passwordReqUppercase') },
      { check: /\d/.test(trimmed), message: t('auth.passwordReqNumber') }
    ];
    const unmet = requirements.filter(requirement => !requirement.check).map(requirement => requirement.message);
    if (trimmed.length === 0) {
      return {
        valid: false,
        message: t('auth.passwordHint')
      };
    }
    if (unmet.length === 0) {
      return {
        valid: true,
        message: t('auth.strongPassword')
      };
    }
    return {
      valid: false,
      message: `${t('auth.passwordMustInclude')} ${formatRequirementList(unmet)}.`
    };
  };

  const passwordStrength = assessPasswordStrength(newPassword);
  const signupPasswordStrength = assessPasswordStrength(signupData.password);
  const passwordStrengthTone = passwordStrength.valid ? "text-emerald-500" : newPassword.length > 0 ? "text-destructive" : "text-muted-foreground";
  const signupPasswordStrengthTone = signupPasswordStrength.valid ? "text-emerald-500" : signupData.password.length > 0 ? "text-destructive" : "text-muted-foreground";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    let isMounted = true;
    const hash = window.location.hash;
    const isRecovery = hash.includes("type=recovery");
    if (isRecovery) {
      setIsResettingPassword(true);
      setStatus({
        message: t('auth.enterNewPassword'),
        variant: "info"
      });
    }
    const checkUser = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!isMounted) {
          return;
        }
        if (sessionError) {
          console.error("Failed to fetch auth session:", sessionError);
          setError(t('auth.sessionVerifyError'));
          return;
        }
        if (data.session?.user && !isRecovery) {
          navigate("/");
        }
      } catch (sessionError) {
        console.error("Unexpected error fetching auth session:", sessionError);
        if (!isMounted) {
          return;
        }
        setError(t('auth.sessionVerifyError'));
      }
    };
    void checkUser();
    return () => {
      isMounted = false;
    };
  }, [navigate, t]);

  useEffect(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(event => {
      if (event === "PASSWORD_RECOVERY") {
        setIsResettingPassword(true);
        setStatus({
          message: t('auth.enterNewPassword'),
          variant: "info"
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [t]);

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
        password: loginData.password
      });
      if (error) {
        const message = error.message?.toLowerCase() ?? "";
        if (message.includes("email not confirmed") || message.includes("confirm your email")) {
          setStatus({
            message: t('auth.emailNotVerified'),
            variant: "info",
            showResend: true
          });
          setUnverifiedEmail(loginData.email);
        } else {
          setError(error.message);
        }
      } else if (data.user) {
        setStatus(null);
        setUnverifiedEmail("");
        toast({
          title: t('auth.welcomeBack'),
          description: t('auth.loginSuccess')
        });
        navigate("/dashboard");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.generic');
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
      const email = signupData.email.trim();
      const password = signupData.password.trim();
      const passwordAssessment = assessPasswordStrength(password);
      if (!passwordAssessment.valid) {
        setError(passwordAssessment.message);
        setLoading(false);
        return;
      }
      const origin = getBrowserOrigin();
      if (!origin) {
        setError(t('auth.browserOnlySignup'));
        setLoading(false);
        return;
      }
      const redirectUrl = `${origin}/auth`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });
      if (error) {
        console.error("Supabase signUp failed", { error, context: { email } });
        setError(t('auth.accountCreateError'));
      } else if (data.user) {
        setUnverifiedEmail(email);
        setStatus({
          message: `${t('auth.verificationSent')} ${email}. ${t('auth.confirmEmailToPlay')}`,
          variant: "info",
          showResend: true
        });
        setActiveTab("login");
        setLoginData(prev => ({ ...prev, email }));
        toast({
          title: t('auth.accountCreated'),
          description: t('auth.checkEmailConfirm')
        });
      } else {
        console.warn("Supabase signUp returned without user", { data, email });
      }
    } catch (err) {
      console.error("Unexpected error during signUp", err);
      const message = err instanceof Error ? err.message : t('errors.generic');
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
      const origin = getBrowserOrigin();
      if (!origin) {
        setError(t('auth.originError'));
        setResetLinkLoading(false);
        return;
      }
      const redirectUrl = `${origin}/auth`;
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: redirectUrl
      });
      if (error) {
        setError(error.message);
      } else {
        setStatus({
          message: `${t('auth.resetLinkSent')} ${forgotPasswordEmail}.`,
          variant: "success"
        });
        setForgotPasswordEmail("");
        setActiveTab("login");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.generic');
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
      setError(t('auth.passwordMismatch'));
      return;
    }
    const passwordAssessment = assessPasswordStrength(newPassword);
    if (!passwordAssessment.valid) {
      setError(passwordAssessment.message);
      return;
    }
    setPasswordUpdateLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) {
        setError(error.message);
      } else {
        setStatus({
          message: t('auth.passwordUpdatedSuccess'),
          variant: "success"
        });
        setNewPassword("");
        setConfirmPassword("");
        setIsResettingPassword(false);
        setActiveTab("login");
        if (typeof window !== "undefined" && window.history?.replaceState) {
          window.history.replaceState(null, "", window.location.pathname);
        }
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error("Error signing out after password reset:", signOutError);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.generic');
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
      const origin = getBrowserOrigin();
      if (!origin) {
        setError(t('auth.browserOnlyResend'));
        setResendingVerification(false);
        return;
      }
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: unverifiedEmail,
        options: {
          emailRedirectTo: `${origin}/auth`
        }
      });
      if (error) {
        setError(error.message);
      } else {
        setStatus({
          message: `${t('auth.verificationResent')} ${unverifiedEmail}.`,
          variant: "success",
          showResend: false
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.generic');
      setError(message);
    } finally {
      setResendingVerification(false);
    }
  };

  const handleDiscordLinkClick = async () => {
    const discordUrl = "https://discord.gg/KB45k3XJuZ";
    if (typeof window === "undefined") {
      toast({
        title: t('auth.discordUnavailable'),
        description: "Open this link manually: https://discord.gg/KB45k3XJuZ",
        variant: "destructive"
      });
      return;
    }
    const newWindow = window.open(discordUrl, "_blank", "noopener,noreferrer");
    if (!newWindow) {
      toast({
        title: t('auth.unableOpenDiscord'),
        description: t('auth.linkCopied')
      });
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(discordUrl);
        } else {
          throw new Error("Clipboard API not available");
        }
      } catch (clipboardError) {
        console.error("Failed to copy Discord invite link:", clipboardError);
        toast({
          title: t('auth.copyLinkManually'),
          description: "Please copy this invite link: https://discord.gg/KB45k3XJuZ",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-sm sm:max-w-md">
        {/* Logo and Branding */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src={logo} alt="RockMundo - Live The Dream" className="h-32 w-auto sm:h-40 md:h-48 object-contain drop-shadow-2xl" />
          </div>
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-sm px-3 py-1 mb-2">
            BETA
          </Badge>
          <Button
            variant="link"
            size="sm"
            className="text-muted-foreground hover:text-primary"
            onClick={() => navigate("/about")}
          >
            What is RockMundo?
          </Button>
        </div>

        <Card className="bg-card/90 backdrop-blur-sm border-border/40 shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-xl sm:text-2xl font-bebas tracking-wide">
              {t('auth.joinTheRevolution')}
            </CardTitle>
            <CardDescription className="text-center text-sm font-oswald">
              {t('auth.createLegacy')}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground/80 font-oswald">
                      {t('auth.registeredPlayers')}
                    </p>
                    {presenceLoading ? (
                      <Skeleton className="mt-1 h-6 w-20" />
                    ) : (
                      <p className="text-2xl font-bebas tracking-wide text-foreground">
                        {formatPresenceValue(totalPlayers)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/70">
                      {t('auth.musiciansJoined')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground/80 font-oswald">
                      {t('auth.playersOnline')}
                    </p>
                    {presenceLoading ? (
                      <Skeleton className="mt-1 h-6 w-20" />
                    ) : (
                      <p className="text-2xl font-bebas tracking-wide text-foreground">
                        {formatPresenceValue(onlinePlayers)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/70">
                      {t('auth.exploringWorld')}
                    </p>
                  </div>
                </div>
              </div>
              {presenceError && (
                <p className="text-center text-xs font-oswald text-destructive/80">
                  {presenceError}
                </p>
              )}

              {status && (
                <Alert
                  variant={status.variant === "error" ? "destructive" : "default"}
                  className={cn(
                    status.variant === "info" && "border-border/50 bg-muted/60 text-foreground",
                    status.variant === "success" && "border-success/50 bg-success/15 text-success-foreground"
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
                        {resendingVerification ? t('auth.resending') : t('auth.resendVerification')}
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
                    <Label htmlFor="new-password" className="font-oswald text-sm">
                      {t('auth.newPassword')}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <p className={`text-xs font-oswald ${passwordStrengthTone}`}>
                      {passwordStrength.message}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="font-oswald text-sm">
                      {t('auth.confirmNewPassword')}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
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
                    {passwordUpdateLoading ? t('auth.updatingPassword') : t('auth.updatePassword')}
                  </Button>
                </form>
              ) : (
                <Tabs value={activeTab} onValueChange={value => handleTabChange(value as AuthTab)} className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3 bg-secondary/50">
                    <TabsTrigger value="login" className="font-oswald text-xs sm:text-sm">
                      {t('auth.signIn')}
                    </TabsTrigger>
                    <TabsTrigger value="signup" className="font-oswald text-xs sm:text-sm">
                      {t('auth.signUp')}
                    </TabsTrigger>
                    <TabsTrigger value="forgot" className="font-oswald text-xs sm:text-sm">
                      {t('auth.forgotPassword')}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className="font-oswald text-sm">
                          {t('forms.email')}
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="login-email"
                            type="email"
                            placeholder="your@email.com"
                            className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                            value={loginData.email}
                            onChange={e => setLoginData({ ...loginData, email: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="font-oswald text-sm">
                          {t('forms.password')}
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="login-password"
                            type="password"
                            placeholder="••••••••"
                            className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                            value={loginData.password}
                            onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-11 bg-gradient-primary hover:shadow-electric font-oswald text-base tracking-wide transition-all duration-200"
                        disabled={loading}
                      >
                        {loading ? t('auth.signingIn') : t('auth.signIn')}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form onSubmit={handleSignup} className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="signup-email" className="font-oswald text-sm">
                          {t('forms.email')}
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="your@email.com"
                            className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                            value={signupData.email}
                            onChange={e => setSignupData({ ...signupData, email: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-password" className="font-oswald text-sm">
                          {t('forms.password')}
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="signup-password"
                            type="password"
                            placeholder="••••••••"
                            className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                            value={signupData.password}
                            onChange={e => setSignupData({ ...signupData, password: e.target.value })}
                            required
                            minLength={6}
                          />
                        </div>
                        <p className={`text-xs font-oswald ${signupPasswordStrengthTone}`}>
                          {signupPasswordStrength.message}
                        </p>
                      </div>

                      <div className="flex items-start gap-2 pt-2">
                        <Checkbox
                          id="terms"
                          checked={termsAccepted}
                          onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                        />
                        <Label htmlFor="terms" className="text-xs text-muted-foreground leading-tight cursor-pointer">
                          {t('auth.termsAgreement')} <TermsDialog triggerText={t('auth.termsOfService')} />
                        </Label>
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-11 bg-gradient-primary hover:shadow-electric font-oswald text-base tracking-wide transition-all duration-200 mt-4"
                        disabled={loading || !termsAccepted}
                      >
                        {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="forgot">
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email" className="font-oswald text-sm">
                          {t('forms.email')}
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="forgot-email"
                            type="email"
                            placeholder="your@email.com"
                            className="pl-10 h-11 bg-input/80 border-border/50 focus:border-primary"
                            value={forgotPasswordEmail}
                            onChange={e => setForgotPasswordEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground font-oswald">
                        {t('auth.resetLinkInfo')}
                      </p>

                      <Button
                        type="submit"
                        className="w-full h-11 bg-gradient-primary hover:shadow-electric font-oswald text-base tracking-wide transition-all duration-200"
                        disabled={resetLinkLoading}
                      >
                        {resetLinkLoading ? t('auth.sendingResetLink') : t('auth.sendResetLink')}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6 space-y-4">
          <p className="text-xs text-muted-foreground/70 font-oswald">
            {t('auth.joinThousands')}
          </p>
          <button
            type="button"
            onClick={handleDiscordLinkClick}
            className="flex items-center justify-center gap-3 mx-auto px-6 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] transition-colors text-white font-oswald tracking-wide shadow-lg hover:shadow-xl"
          >
            <img src={discordLogo} alt="Discord" className="h-6 w-auto" />
            <span>{t('auth.joinDiscord')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
