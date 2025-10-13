import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";

interface TwaaterAccountSetupProps {
  ownerType: "persona" | "band";
  ownerId: string;
  profileUsername: string;
}

export const TwaaterAccountSetup = ({
  ownerType,
  ownerId,
  profileUsername,
}: TwaaterAccountSetupProps) => {
  const [handle, setHandle] = useState(profileUsername);
  const [displayName, setDisplayName] = useState("");
  const { createAccount, isCreating } = useTwaaterAccount(ownerType, ownerId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    createAccount({
      owner_type: ownerType,
      owner_id: ownerId,
      handle: handle.toLowerCase().replace(/[^a-z0-9_]/g, ""),
      display_name: displayName || handle,
      verified: false,
      fame_score: 0,
    });
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Welcome to Twaater</CardTitle>
        <CardDescription>
          Set up your Twaater account to start posting and building your following
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="handle">Handle (username)</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">@</span>
              <Input
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="yourhandle"
                required
                maxLength={50}
                pattern="[a-zA-Z0-9_]+"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Letters, numbers, and underscores only. This will be your unique identifier.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name or Band Name"
              maxLength={100}
            />
            <p className="text-sm text-muted-foreground">
              This is how others will see your name. Defaults to your handle if left blank.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold">What you'll get:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Daily XP rewards for your first 3 posts (+2 XP bonus for campaign posts)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Build followers that scale with your fame</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Link posts to singles, albums, gigs, and tours for extra engagement</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Random outcome effects that boost your metrics and fame</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>System-generated reviews of your performances</span>
              </li>
            </ul>
          </div>

          <Button type="submit" className="w-full" disabled={isCreating || !handle.trim()}>
            {isCreating ? "Creating Account..." : "Create Twaater Account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
