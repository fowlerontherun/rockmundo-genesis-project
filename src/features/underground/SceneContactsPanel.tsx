import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, HeartHandshake, LockKeyhole, MapPin, MessageCircle, Sparkles, UserRoundPlus, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { discoverSceneContacts, getSceneContacts, interactSceneContact } from "./service";
import type { SceneContact, SceneInteraction } from "./types";

interface Props {
  profileId: string;
  age?: number | null;
}

const interactionLabels: Record<SceneInteraction, string> = {
  talk: "Talk",
  flirt: "Flirt",
  private_time: "Private time",
  date: "Ask on a date",
  define_relationship: "Go exclusive",
  cool_off: "Cool things down",
};

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-muted-foreground"><span>{label}</span><span>{value}</span></div>
      <Progress value={value} className="mt-1 h-1.5" />
    </div>
  );
}

function ContactCard({
  contact,
  busy,
  onInteract,
}: {
  contact: SceneContact;
  busy: boolean;
  onInteract: (contact: SceneContact, interaction: SceneInteraction) => void;
}) {
  const cooldown = contact.cooldown_until ? new Date(contact.cooldown_until).getTime() > Date.now() : false;
  const ended = contact.relationship_status === "ended";
  const canPrivate = contact.chemistry >= 45 && contact.trust >= 15;
  const canDate = contact.chemistry >= 45 && contact.trust >= 20;
  const canExclusive = ["flirting", "casual", "dating"].includes(contact.relationship_status) && contact.chemistry >= 60 && contact.attachment >= 35;
  const archetype = contact.archetype;

  return (
    <div className="space-y-3 rounded-lg border bg-background/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{contact.npc_name}</span>
            <Badge variant="outline">Age {contact.npc_age}</Badge>
            <Badge variant="secondary" className="capitalize">{archetype?.name ?? contact.archetype_slug.replaceAll("_", " ")}</Badge>
            <Badge variant={contact.relationship_status === "exclusive" ? "default" : "outline"} className="capitalize">
              {contact.relationship_status.replaceAll("_", " ")}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{archetype?.description}</p>
          {contact.city?.name && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin className="h-3 w-3" /> Met in {contact.city.name}</div>
          )}
        </div>
        <div className="text-right text-[10px] text-muted-foreground">
          <div>{contact.encounter_count} encounters</div>
          {cooldown && <div>Available again {new Date(contact.cooldown_until!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Meter label="Chemistry" value={contact.chemistry} />
        <Meter label="Trust" value={contact.trust} />
        <Meter label="Attachment" value={contact.attachment} />
        <Meter label="Tension" value={contact.tension} />
        <Meter label="Gossip" value={contact.gossip_exposure} />
      </div>

      {!ended && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={busy || cooldown} onClick={() => onInteract(contact, "talk")}>
            <MessageCircle className="mr-1 h-3 w-3" /> Talk
          </Button>
          <Button size="sm" variant="secondary" disabled={busy || cooldown} onClick={() => onInteract(contact, "flirt")}>
            <Sparkles className="mr-1 h-3 w-3" /> Flirt
          </Button>
          <Button size="sm" variant="outline" disabled={busy || cooldown || !canPrivate} onClick={() => onInteract(contact, "private_time")} title={!canPrivate ? "Requires 45 chemistry and 15 trust" : "A consensual adult encounter, represented non-graphically"}>
            <Heart className="mr-1 h-3 w-3" /> Private time
          </Button>
          <Button size="sm" variant="outline" disabled={busy || cooldown || !canDate} onClick={() => onInteract(contact, "date")} title={!canDate ? "Requires 45 chemistry and 20 trust" : undefined}>
            <HeartHandshake className="mr-1 h-3 w-3" /> Date
          </Button>
          <Button size="sm" disabled={busy || cooldown || !canExclusive} onClick={() => onInteract(contact, "define_relationship")} title={!canExclusive ? "Requires an existing romantic connection, 60 chemistry and 35 attachment" : undefined}>
            <Zap className="mr-1 h-3 w-3" /> Go exclusive
          </Button>
          <Button size="sm" variant="ghost" disabled={busy || cooldown} onClick={() => onInteract(contact, "cool_off")}>
            Cool off
          </Button>
        </div>
      )}
    </div>
  );
}

export function SceneContactsPanel({ profileId, age }: Props) {
  const queryClient = useQueryClient();
  const ageBlocked = Math.floor(age ?? 0) < 18;
  const contacts = useQuery({
    queryKey: ["scene-contacts", profileId],
    queryFn: () => getSceneContacts(profileId),
    enabled: !ageBlocked,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["scene-contacts", profileId] });
    queryClient.invalidateQueries({ queryKey: ["npc-relationships"] });
    queryClient.invalidateQueries({ queryKey: ["romantic-relationships"] });
    queryClient.invalidateQueries({ queryKey: ["romance"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["game-data"] });
    queryClient.invalidateQueries({ queryKey: ["underground-state", profileId] });
  };

  const discover = useMutation({
    mutationFn: () => discoverSceneContacts(profileId),
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.reason === "contact_limit") toast.info("Your active nightlife circle is full. Cool off or end an old connection before meeting more people.");
        else if (result.reason === "age_restricted") toast.error("Adult nightlife contacts are restricted to characters aged 18+.");
        else toast.error("No new scene contacts appeared tonight.");
        return;
      }
      toast.success(`You made ${result.created ?? 0} new scene connection${result.created === 1 ? "" : "s"}.`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Unable to find new scene contacts."),
  });

  const interaction = useMutation({
    mutationFn: ({ contactId, choice }: { contactId: string; choice: SceneInteraction }) => interactSceneContact(profileId, contactId, choice),
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.reason === "cooldown") toast.info(`Give them some space. Try again after ${result.cooldownUntil ? new Date(result.cooldownUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "later"}.`);
        else if (result.reason === "not_close_enough") toast.info("You need more chemistry and trust before taking that step.");
        else if (result.reason === "not_ready") toast.info("The connection is not ready for exclusivity yet.");
        else if (result.reason === "relationship_ended") toast.info("That connection has ended.");
        else toast.error("That interaction is not available right now.");
        return;
      }
      if (result.gossipLeaked) toast.warning(`${result.message ?? "The encounter went well."} Word has started getting around the scene.`);
      else if (result.outcome === "declined") toast.info(result.message ?? "They are not interested. You respect the boundary.");
      else toast.success(result.message ?? "The connection changed.");
      if (result.existingRelationshipAffected) toast.warning("Your existing committed relationship has picked up extra tension and suspicion.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Unable to resolve that interaction."),
  });

  return (
    <Card className="border-pink-500/20 bg-gradient-to-br from-card to-pink-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Groupies, Scene Regulars & Relationships</CardTitle>
        <CardDescription>
          Meet recurring adult NPCs around the nightlife scene. Chemistry can become flirting, casual encounters or relationships; fame, discretion, jealousy and gossip can make the same connection complicated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ageBlocked ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <LockKeyhole className="h-4 w-4" /> This adult relationship section unlocks when the character reaches age 18.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
              <div>
                <div className="text-sm font-medium">Work the room</div>
                <p className="text-xs text-muted-foreground">Meet up to three new people at a time, with a maximum of eight active scene contacts. New contacts are always adults and remember the city where you met.</p>
              </div>
              <Button size="sm" disabled={discover.isPending} onClick={() => discover.mutate()}>
                <UserRoundPlus className="mr-1 h-4 w-4" /> Meet people
              </Button>
            </div>

            <div className="rounded-lg border border-pink-500/15 bg-pink-500/5 p-3 text-xs text-muted-foreground">
              Romantic and private interactions depend on mutual interest. Private encounters are represented non-graphically. Existing committed relationships can be affected by outside romances, while low-discretion contacts can generate gossip.
            </div>

            {contacts.isLoading ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Checking who you know in the scene…</div>
            ) : (contacts.data ?? []).length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">You do not know anyone in the after-hours scene yet. Meet some people to start building connections.</div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {(contacts.data ?? []).map((contact) => (
                  <ContactCard key={contact.id} contact={contact} busy={interaction.isPending} onInteract={(entry, choice) => interaction.mutate({ contactId: entry.id, choice })} />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
