import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { Music } from "lucide-react";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Demo credentials from your repo
    if (username === "demo@rockmundo.test" && password === "demo123") {
      // Simulate API call
      setTimeout(() => {
        localStorage.setItem("rockmundo_token", "demo_token");
        toast({
          title: "Welcome to RockMundo!",
          description: "Let's build your music empire.",
        });
        navigate("/dashboard");
        setIsLoading(false);
      }, 1000);
    } else {
      setTimeout(() => {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Invalid credentials. Try demo@rockmundo.test / demo123",
        });
        setIsLoading(false);
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-hero opacity-20" />
      
      <Card className="w-full max-w-md relative z-10 border-primary/20 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center">
          {/* Logo and branding */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="/src/assets/rockmundo-logo.png" 
                alt="RockMundo Logo"
                className="h-24 w-auto animate-glow"
              />
            </div>
            <h1 className="text-5xl font-bebas tracking-wider text-foreground mb-2">
              ROCKMUNDO
            </h1>
            <p className="text-lg font-oswald text-muted-foreground tracking-wide">
              LIVE THE DREAM
            </p>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Email</Label>
              <Input
                id="username"
                type="email"
                placeholder="demo@rockmundo.test"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-secondary/50 border-primary/20 focus:border-primary"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="demo123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-secondary/50 border-primary/20 focus:border-primary"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-gradient-primary hover:shadow-electric transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Enter RockMundo"}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Demo Credentials:</p>
            <p>Email: demo@rockmundo.test</p>
            <p>Password: demo123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;