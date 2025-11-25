import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { TwaaterProfilePage } from "@/components/twaater/TwaaterProfilePage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TwaaterProfile = () => {
  const { profile } = useGameData();
  const { account, isLoading } = useTwaaterAccount("persona", profile?.id);

  if (!profile) {
    return (
      <div className="container mx-auto py-6">
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
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container mx-auto py-6">
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
      </div>
    );
  }

  return <TwaaterProfilePage viewerAccountId={account.id} />;
};

export default TwaaterProfile;
