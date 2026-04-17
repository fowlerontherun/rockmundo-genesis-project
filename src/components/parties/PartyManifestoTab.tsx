import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Plus, Trash2 } from "lucide-react";
import { useMyParty } from "@/hooks/useParties";
import {
  usePartyManifesto,
  useAddPlank,
  useDeletePlank,
  MANIFESTO_TOPICS,
  MAX_PLANKS,
} from "@/hooks/usePartyManifesto";

interface Props {
  partyId: string;
}

export function PartyManifestoTab({ partyId }: Props) {
  const { data: planks } = usePartyManifesto(partyId);
  const { data: myParty } = useMyParty();
  const addPlank = useAddPlank();
  const deletePlank = useDeletePlank();

  const canEdit =
    myParty?.party_id === partyId && (myParty?.role === "founder" || myParty?.role === "officer");

  const [topic, setTopic] = useState<string>(MANIFESTO_TOPICS[0]);
  const [position, setPosition] = useState("");
  const [details, setDetails] = useState("");

  const planksList = planks ?? [];
  const atLimit = planksList.length >= MAX_PLANKS;

  const handleAdd = () => {
    if (!position.trim()) return;
    addPlank.mutate(
      {
        party_id: partyId,
        topic,
        position: position.trim(),
        details: details.trim() || undefined,
        position_order: planksList.length,
      },
      {
        onSuccess: () => {
          setPosition("");
          setDetails("");
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5" />
            Manifesto
            <Badge variant="outline" className="ml-auto text-xs">
              {planksList.length} / {MAX_PLANKS} planks
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            The party's official policy platform. Voters reference this when comparing endorsed
            candidates.
          </p>
        </CardHeader>
        <CardContent>
          {planksList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No planks published yet.
              {canEdit && " Add the party's first policy position below."}
            </p>
          ) : (
            <ul className="space-y-2">
              {planksList.map((plank) => (
                <li
                  key={plank.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-md border border-border"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {plank.topic}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold">{plank.position}</p>
                    {plank.details && (
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                        {plank.details}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 h-7 w-7"
                      disabled={deletePlank.isPending}
                      onClick={() => deletePlank.mutate({ id: plank.id, party_id: partyId })}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canEdit && !atLimit && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" /> Add Plank
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
              <div>
                <Label htmlFor="plank-topic">Topic</Label>
                <Select value={topic} onValueChange={setTopic}>
                  <SelectTrigger id="plank-topic">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MANIFESTO_TOPICS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="plank-position">Position (one line)</Label>
                <Input
                  id="plank-position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value.slice(0, 140))}
                  placeholder="e.g. Lower busking license fees by 50%"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="plank-details">Details (optional)</Label>
              <Textarea
                id="plank-details"
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 600))}
                rows={2}
                placeholder="Why this matters and how the party will deliver it…"
              />
            </div>
            <Button disabled={!position.trim() || addPlank.isPending} onClick={handleAdd}>
              {addPlank.isPending ? "Publishing…" : "Publish Plank"}
            </Button>
          </CardContent>
        </Card>
      )}

      {canEdit && atLimit && (
        <p className="text-xs text-muted-foreground text-center">
          Manifesto plank limit reached ({MAX_PLANKS}). Remove a plank to add a new one.
        </p>
      )}
    </div>
  );
}
