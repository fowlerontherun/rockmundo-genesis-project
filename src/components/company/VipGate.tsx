import { ReactNode } from "react";
import { Crown, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useVipStatus } from "@/hooks/useVipStatus";
import { useNavigate } from "react-router-dom";

interface VipGateProps {
  children: ReactNode;
  feature?: string;
  description?: string;
  showUpgradeButton?: boolean;
}

export const VipGate = ({
  children,
  feature = "This feature",
  description = "Upgrade to VIP to unlock exclusive business features and grow your music empire.",
  showUpgradeButton = true,
}: VipGateProps) => {
  const { data: vipStatus, isLoading } = useVipStatus();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (vipStatus?.isVip) {
    return <>{children}</>;
  }

  return (
    <Card className="bg-gradient-to-br from-amber-500/10 via-background to-background border-amber-500/30">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 w-fit rounded-full bg-amber-500/20 p-4">
          <Crown className="h-10 w-10 text-amber-500" />
        </div>
        <CardTitle className="text-2xl flex items-center justify-center gap-2">
          <Lock className="h-5 w-5 text-muted-foreground" />
          VIP Feature
        </CardTitle>
        <CardDescription className="text-base">
          {feature} is exclusive to VIP members
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground max-w-md mx-auto">
          {description}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          {showUpgradeButton && (
            <Button
              onClick={() => navigate("/vip-subscribe")}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to VIP
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>

        <div className="pt-4 border-t border-border mt-6">
          <p className="text-sm text-muted-foreground">
            VIP members enjoy exclusive access to:
          </p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>• Create companies, labels, venues & studios</li>
            <li>• Record songs, release albums & earn royalties</li>
            <li>• Vote on radio charts & influence rankings</li>
            <li>• Tour the world & build city-by-city fame</li>
            <li>• Hire employees, crew & grow your wealth</li>
            <li>• VIP gig audio, social features & chat</li>
            <li>• Awards, PR campaigns & merch sales</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

// Higher-order component version
export const withVipGate = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  feature?: string,
  description?: string
) => {
  return function VipGatedComponent(props: P) {
    return (
      <VipGate feature={feature} description={description}>
        <WrappedComponent {...props} />
      </VipGate>
    );
  };
};
