import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BriefcaseBusiness, CircleDollarSign, Gift, MapPin, MessageSquare, Music, User, UserRoundPlus } from "lucide-react";
import { PresenceIndicator } from "@/components/presence/PresenceIndicator";
import { DirectMessagePanel } from "@/features/relationships/components/DirectMessagePanel";
import { resolveRelationshipPairKey } from "@/features/relationships/api";
import { INVITE_KIND_LABELS, type SocialInviteKind, useCreateInvite } from "@/hooks/useSocialInvites";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import {
  listManageableJobVacancies,
  listTransferableEquipment,
  offerJobToPlayer,
  sendEquipmentToPlayer,
  sendMoneyToPlayer,
} from "@/services/playerProfileActions";

interface PlayerProfileHeaderProps {
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  cityName?: string | null;
  currentBand?: { id: string; name: string } | null;
  mainRole?: string | null;
  fame?: number | null;
  careerLevel?: number | null;
  presence?: any;
  isOwnProfile?: boolean;
  actions?: React.ReactNode;
}

export function PlayerProfileHeader({ name, username, avatarUrl, cityName, currentBand, mainRole, fame, careerLevel, presence, isOwnProfile, actions }: PlayerProfileHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm md:flex-row md:items-start md:p-6">
      <Avatar className="h-24 w-24 border-2 border-primary/30">
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback><User className="h-12 w-12" /></AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold">{name}</h1>
              {presence && <PresenceIndicator state={presence} />}
              {isOwnProfile && <Badge variant="secondary">Your profile</Badge>}
            </div>
            {username && username !== name && <p className="text-sm text-muted-foreground">@{username}</p>}
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {currentBand && <Link to={`/band/${currentBand.id}`} className="inline-flex items-center gap-1 hover:underline"><Music className="h-3 w-3" />{currentBand.name}</Link>}
          {mainRole && <Badge variant="outline">{mainRole}</Badge>}
          {careerLevel != null && <Badge variant="outline">Career level {careerLevel}</Badge>}
          {fame != null && <Badge variant="outline">Fame {fame.toLocaleString()}</Badge>}
          {cityName && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{cityName}</span>}
        </div>
      </div>
    </div>
  );
}

const INVITE_KINDS = Object.keys(INVITE_KIND_LABELS) as SocialInviteKind[];

export function FutureProfileActions() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { profileId, userId } = useActiveProfile();
  const createInvite = useCreateInvite();
  const [messageOpen, setMessageOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [jobOpen, setJobOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [selectedVacancy, setSelectedVacancy] = useState("");
  const [selectedInventory, setSelectedInventory] = useState("");
  const [jobMessage, setJobMessage] = useState("");
  const [itemNote, setItemNote] = useState("");
  const [moneyNote, setMoneyNote] = useState("");
  const [moneyAmount, setMoneyAmount] = useState("");

  const targetProfileId = location.pathname.match(/\/player\/([0-9a-f-]{36})/i)?.[1] ?? null;
  const canInteract = Boolean(profileId && userId && targetProfileId && targetProfileId !== profileId);
  const channel = canInteract ? `dm:${resolveRelationshipPairKey(profileId!, targetProfileId!)}` : null;

  const vacancies = useQuery({
    queryKey: ["profile-action-vacancies", profileId],
    queryFn: () => listManageableJobVacancies(profileId!),
    enabled: Boolean(jobOpen && profileId),
  });

  const equipment = useQuery({
    queryKey: ["profile-action-equipment", profileId],
    queryFn: () => listTransferableEquipment(profileId!),
    enabled: Boolean(itemOpen && profileId),
  });

  const offerJob = useMutation({
    mutationFn: () => offerJobToPlayer({ targetProfileId: targetProfileId!, vacancyId: selectedVacancy, message: jobMessage }),
    onSuccess: () => {
      toast.success("Job offer sent");
      setJobOpen(false); setSelectedVacancy(""); setJobMessage("");
    },
    onError: (error: Error) => toast.error(error.message || "Could not send job offer"),
  });

  const sendItem = useMutation({
    mutationFn: () => sendEquipmentToPlayer({ senderProfileId: profileId!, targetProfileId: targetProfileId!, inventoryId: selectedInventory, note: itemNote }),
    onSuccess: () => {
      toast.success("Item sent");
      setItemOpen(false); setSelectedInventory(""); setItemNote("");
      queryClient.invalidateQueries({ queryKey: ["profile-action-equipment", profileId] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not send item"),
  });

  const sendMoney = useMutation({
    mutationFn: () => sendMoneyToPlayer({ senderProfileId: profileId!, targetProfileId: targetProfileId!, amount: Number(moneyAmount), note: moneyNote }),
    onSuccess: () => {
      toast.success("Money sent");
      setMoneyOpen(false); setMoneyAmount(""); setMoneyNote("");
      queryClient.invalidateQueries({ queryKey: ["active-profile"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not send money"),
  });

  const sendInvite = async (kind: SocialInviteKind) => {
    if (!targetProfileId) return;
    await createInvite.mutateAsync({ to_profile_id: targetProfileId, kind });
    setInviteOpen(false);
  };

  if (!canInteract) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setMessageOpen(true)}><MessageSquare className="mr-1 h-4 w-4" /> Message</Button>
      <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}><UserRoundPlus className="mr-1 h-4 w-4" /> Invite to activity</Button>
      <Button size="sm" variant="outline" onClick={() => setJobOpen(true)}><BriefcaseBusiness className="mr-1 h-4 w-4" /> Offer job</Button>
      <Button size="sm" variant="outline" onClick={() => setItemOpen(true)}><Gift className="mr-1 h-4 w-4" /> Send item</Button>
      <Button size="sm" variant="outline" onClick={() => setMoneyOpen(true)}><CircleDollarSign className="mr-1 h-4 w-4" /> Send money</Button>

      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Direct message</DialogTitle></DialogHeader>{channel && userId && <DirectMessagePanel channel={channel} currentUserId={userId} otherDisplayName="Player" />}</DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Invite to activity</DialogTitle></DialogHeader><div className="grid gap-2 sm:grid-cols-2">{INVITE_KINDS.map((kind) => <Button key={kind} variant="outline" onClick={() => void sendInvite(kind)} disabled={createInvite.isPending}>{INVITE_KIND_LABELS[kind]}</Button>)}</div></DialogContent>
      </Dialog>

      <Dialog open={jobOpen} onOpenChange={setJobOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Offer job</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Open vacancy</Label><Select value={selectedVacancy} onValueChange={setSelectedVacancy}><SelectTrigger><SelectValue placeholder={vacancies.isLoading ? "Loading vacancies..." : "Choose a vacancy"} /></SelectTrigger><SelectContent>{(vacancies.data ?? []).map((v) => <SelectItem key={v.vacancy_id} value={v.vacancy_id}>{v.company_name} — {v.job_title} ({v.weekly_wage.toLocaleString()}/week)</SelectItem>)}</SelectContent></Select>{!vacancies.isLoading && (vacancies.data?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">You do not manage any open company vacancies.</p>}</div>
            <div className="space-y-2"><Label>Message (optional)</Label><Textarea value={jobMessage} onChange={(e) => setJobMessage(e.target.value)} maxLength={500} placeholder="Add a short note about the role" /></div>
            <Button className="w-full" onClick={() => offerJob.mutate()} disabled={!selectedVacancy || offerJob.isPending}>{offerJob.isPending ? "Sending..." : "Send job offer"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Send item</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Unequipped equipment</Label><Select value={selectedInventory} onValueChange={setSelectedInventory}><SelectTrigger><SelectValue placeholder={equipment.isLoading ? "Loading equipment..." : "Choose an item"} /></SelectTrigger><SelectContent>{(equipment.data ?? []).map((item) => <SelectItem key={item.inventory_id} value={item.inventory_id}>{item.name} — {item.category} ({item.condition}% condition)</SelectItem>)}</SelectContent></Select>{!equipment.isLoading && (equipment.data?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">You have no unequipped equipment available to send.</p>}</div>
            <div className="space-y-2"><Label>Note (optional)</Label><Textarea value={itemNote} onChange={(e) => setItemNote(e.target.value)} maxLength={300} /></div>
            <Button className="w-full" onClick={() => sendItem.mutate()} disabled={!selectedInventory || sendItem.isPending}>{sendItem.isPending ? "Sending..." : "Send item"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={moneyOpen} onOpenChange={setMoneyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Send money</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Amount</Label><Input type="number" min={1} max={1000000} step={1} value={moneyAmount} onChange={(e) => setMoneyAmount(e.target.value)} placeholder="0" /></div>
            <div className="space-y-2"><Label>Note (optional)</Label><Textarea value={moneyNote} onChange={(e) => setMoneyNote(e.target.value)} maxLength={300} /></div>
            <p className="text-xs text-muted-foreground">Transfers use the active character's personal cash and are immediate.</p>
            <Button className="w-full" onClick={() => sendMoney.mutate()} disabled={!moneyAmount || Number(moneyAmount) < 1 || sendMoney.isPending}>{sendMoney.isPending ? "Sending..." : "Send money"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
