import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { TwaaterProfilePage } from "@/components/twaater/TwaaterProfilePage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { useSearchParams } from "react-router-dom";
import { useTwaaterRouteAccount } from "@/hooks/useTwaaterRouteAccount";

const TwaaterProfile = () => {
  const { profile } = useGameData();
  const [searchParams] = useSearchParams();
  const { account: personaAccount, isLoading: personaLoading } = useTwaaterAccount("persona", profile?.id);
  const { account, isLoading: routeAccountLoading } = useTwaaterRouteAccount(personaAccount, searchParams.get("account"));
  const isLoading = personaLoading || routeAccountLoading;
  const backTo = account?.id ? `/twaater?account=${account.id}` : "/twaater";

  if (!profile) {
    return (
      <FMPageScaffold title="Twaater Profile" icon={User} backTo={backTo}>
        <Card>
          <CardHeader>
            <CardTitle>Twaater Profile</CardTitle>
            <CardDescription>Create a character to view profiles</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You need to create your character first to access Twaater profiles.
            </p>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  if (isLoading) {
    return (
      <FMPageScaffold title="Twaater Profile" icon={User} backTo={backTo}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </FMPageScaffold>
    );
  }

  if (!account) {
    return (
      <FMPageScaffold title="Twaater Profile" icon={User} backTo={backTo}>
        <Card>
          <CardHeader>
            <CardTitle>Twaater Profile</CardTitle>
            <CardDescription>Set up your Twaater account first</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Visit the Twaater page to set up your account before viewing profiles.
            </p>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  return (
    <FMPageScaffold title="Twaater Profile" icon={User} backTo={backTo} backLabel="Back to Twaater">
      <TwaaterProfilePage viewerAccountId={account.id} />
    </FMPageScaffold>
  );
};

export default TwaaterProfile;
