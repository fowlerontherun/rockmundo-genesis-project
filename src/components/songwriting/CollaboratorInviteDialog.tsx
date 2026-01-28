import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCollaborationInvites } from "@/hooks/useCollaborationInvites";
import { Users, DollarSign, Percent, Search, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface CollaboratorInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  userBandId?: string;
}

interface PotentialCollaborator {
  id: string;
  username: string;
  avatar_url: string | null;
  isBandMember: boolean;
}

type CompensationType = "none" | "flat_fee" | "royalty";

export const CollaboratorInviteDialog = ({
  open,
  onOpenChange,
  projectId,
  userBandId,
}: CollaboratorInviteDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [potentialCollaborators, setPotentialCollaborators] = useState<PotentialCollaborator[]>([]);
  const [selectedCollaborator, setSelectedCollaborator] = useState<PotentialCollaborator | null>(null);
  const [compensationType, setCompensationType] = useState<CompensationType>("none");
  const [flatFeeAmount, setFlatFeeAmount] = useState(500);
  const [royaltyPercentage, setRoyaltyPercentage] = useState(15);
  const [loading, setLoading] = useState(false);
  const [userCash, setUserCash] = useState(0);

  const { inviteCollaborator, collaborators } = useCollaborationInvites(projectId);

  useEffect(() => {
    if (open) {
      fetchPotentialCollaborators();
      fetchUserCash();
    }
  }, [open, userBandId]);

  const fetchUserCash = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("cash")
      .eq("user_id", user.id)
      .single();

    setUserCash(data?.cash || 0);
  };

  const fetchPotentialCollaborators = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's profile ID for friendship matching
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      
      if (!userProfile) return;
      const userProfileId = userProfile.id;

      const collaboratorIds = new Set<string>();
      const results: PotentialCollaborator[] = [];

      // Get existing collaborators for this project to exclude them
      const existingIds = new Set(collaborators?.map(c => c.invitee_profile_id) || []);

      // Get band members if user is in a band
      if (userBandId) {
        const { data: bandMembers } = await supabase
          .from("band_members")
          .select(`
            user_id,
            profiles:user_id (
              id,
              username,
              avatar_url
            )
          `)
          .eq("band_id", userBandId)
          .neq("user_id", user.id);

        bandMembers?.forEach((member: any) => {
          if (member.profiles && !existingIds.has(member.profiles.id)) {
            collaboratorIds.add(member.profiles.id);
            results.push({
              id: member.profiles.id,
              username: member.profiles.username || "Unknown",
              avatar_url: member.profiles.avatar_url,
              isBandMember: true,
            });
          }
        });
      }

      // Get friends - use correct column names: requestor_id and addressee_id
      const { data: friendships } = await supabase
        .from("friendships")
        .select(`
          requestor_id,
          addressee_id,
          requestor_profile:profiles!friendships_requestor_id_fkey (
            id,
            username,
            avatar_url
          ),
          addressee_profile:profiles!friendships_addressee_id_fkey (
            id,
            username,
            avatar_url
          )
        `)
        .or(`requestor_id.eq.${userProfileId},addressee_id.eq.${userProfileId}`)
        .eq("status", "accepted");

      friendships?.forEach((friendship: any) => {
        // The friend is whichever profile is NOT the current user
        const isFriendTheAddressee = friendship.requestor_id === userProfileId;
        const profile = isFriendTheAddressee ? friendship.addressee_profile : friendship.requestor_profile;
        
        if (profile && !collaboratorIds.has(profile.id) && !existingIds.has(profile.id)) {
          collaboratorIds.add(profile.id);
          results.push({
            id: profile.id,
            username: profile.username || "Unknown",
            avatar_url: profile.avatar_url,
            isBandMember: false,
          });
        }
      });

      setPotentialCollaborators(results);
    } catch (error) {
      console.error("Error fetching potential collaborators:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCollaborators = potentialCollaborators.filter(
    (c) => c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort: band members first
  const sortedCollaborators = [...filteredCollaborators].sort((a, b) => {
    if (a.isBandMember && !b.isBandMember) return -1;
    if (!a.isBandMember && b.isBandMember) return 1;
    return a.username.localeCompare(b.username);
  });

  const handleSelectCollaborator = (collaborator: PotentialCollaborator) => {
    setSelectedCollaborator(collaborator);
    // Band members default to no compensation
    if (collaborator.isBandMember) {
      setCompensationType("none");
    } else {
      setCompensationType("flat_fee");
    }
  };

  const handleSendInvitation = async () => {
    if (!selectedCollaborator) return;

    // Validate flat fee
    if (compensationType === "flat_fee" && flatFeeAmount > userCash) {
      toast.error("You don't have enough cash for this fee");
      return;
    }

    await inviteCollaborator.mutateAsync({
      projectId,
      inviteeProfileId: selectedCollaborator.id,
      isBandMember: selectedCollaborator.isBandMember,
      compensationType,
      flatFeeAmount: compensationType === "flat_fee" ? flatFeeAmount : undefined,
      royaltyPercentage: compensationType === "royalty" ? royaltyPercentage : undefined,
    });

    // Reset and close
    setSelectedCollaborator(null);
    setCompensationType("none");
    setFlatFeeAmount(500);
    setRoyaltyPercentage(15);
    onOpenChange(false);
  };

  const renderCollaboratorSelection = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search band members & friends..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sortedCollaborators.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No collaborators found. Add friends or join a band to invite co-writers.
          </div>
        ) : (
          <div className="space-y-2">
            {sortedCollaborators.map((collaborator) => (
              <button
                key={collaborator.id}
                onClick={() => handleSelectCollaborator(collaborator)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={collaborator.avatar_url || undefined} />
                  <AvatarFallback>{collaborator.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">{collaborator.username}</div>
                  {collaborator.isBandMember && (
                    <Badge variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      Band Member
                    </Badge>
                  )}
                </div>
                {collaborator.isBandMember && (
                  <Badge variant="outline" className="text-xs text-primary border-primary">
                    No fee required
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const renderCompensationSelection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-lg">
        <Avatar className="h-12 w-12">
          <AvatarImage src={selectedCollaborator?.avatar_url || undefined} />
          <AvatarFallback>{selectedCollaborator?.username[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium">{selectedCollaborator?.username}</div>
          {selectedCollaborator?.isBandMember && (
            <Badge variant="secondary" className="text-xs">Band Member</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setSelectedCollaborator(null)}
        >
          Change
        </Button>
      </div>

      {!selectedCollaborator?.isBandMember && (
        <div className="space-y-4">
          <Label className="text-base font-semibold">Compensation Type</Label>
          <RadioGroup
            value={compensationType}
            onValueChange={(v) => setCompensationType(v as CompensationType)}
            className="space-y-3"
          >
            <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
              <RadioGroupItem value="flat_fee" id="flat_fee" className="mt-1" />
              <Label htmlFor="flat_fee" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 font-medium">
                  <DollarSign className="h-4 w-4" />
                  One-off Writing Fee
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Pay upfront for their contribution. No ongoing royalties.
                </p>
              </Label>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
              <RadioGroupItem value="royalty" id="royalty" className="mt-1" />
              <Label htmlFor="royalty" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 font-medium">
                  <Percent className="h-4 w-4" />
                  Royalty Split
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Share ongoing royalties from the completed song.
                </p>
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {compensationType === "flat_fee" && !selectedCollaborator?.isBandMember && (
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Writing Fee Amount</Label>
            <span className="text-sm text-muted-foreground">
              Your cash: ${userCash.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold">${flatFeeAmount.toLocaleString()}</span>
          </div>
          <Slider
            value={[flatFeeAmount]}
            onValueChange={([value]) => setFlatFeeAmount(value)}
            min={50}
            max={10000}
            step={50}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>$50</span>
            <span>$10,000</span>
          </div>
          {flatFeeAmount > userCash && (
            <p className="text-sm text-destructive">Insufficient funds</p>
          )}
        </div>
      )}

      {compensationType === "royalty" && !selectedCollaborator?.isBandMember && (
        <div className="space-y-3">
          <Label>Royalty Percentage</Label>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold">{royaltyPercentage}%</span>
          </div>
          <Slider
            value={[royaltyPercentage]}
            onValueChange={([value]) => setRoyaltyPercentage(value)}
            min={5}
            max={50}
            step={1}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5%</span>
            <span>50%</span>
          </div>
          <p className="text-sm text-muted-foreground">
            They'll receive {royaltyPercentage}% of all royalties from this song.
          </p>
        </div>
      )}

      {selectedCollaborator?.isBandMember && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
          <p className="text-sm text-primary">
            ✨ As a band member, no compensation is required. They can join your songwriting project directly.
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={() => setSelectedCollaborator(null)} className="flex-1">
          Back
        </Button>
        <Button
          onClick={handleSendInvitation}
          disabled={
            inviteCollaborator.isPending ||
            (compensationType === "flat_fee" && flatFeeAmount > userCash)
          }
          className="flex-1"
        >
          {inviteCollaborator.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <UserPlus className="h-4 w-4 mr-2" />
          )}
          Send Invitation
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Invite Collaborator
          </DialogTitle>
          <DialogDescription>
            {selectedCollaborator
              ? "Set compensation terms for your collaboration"
              : "Select a band member or friend to co-write with"}
          </DialogDescription>
        </DialogHeader>

        {selectedCollaborator ? renderCompensationSelection() : renderCollaboratorSelection()}
      </DialogContent>
    </Dialog>
  );
};
