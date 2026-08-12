import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useFestivalLaunchPlan, useSaveFestivalPublicProfile } from "../application/useFestivalLaunch";

type ProfileDraft = {
  publicName: string;
  tagline: string;
  description: string;
  publicSlug: string;
  ageGuidance: string;
  transportSummary: string;
  campingSummary: string;
  accessibilitySummary: string;
  foodAndDrinkSummary: string;
  refundPolicySummary: string;
  termsSummary: string;
  contactSummary: string;
};

const emptyDraft: ProfileDraft = {
  publicName: "",
  tagline: "",
  description: "",
  publicSlug: "",
  ageGuidance: "",
  transportSummary: "",
  campingSummary: "",
  accessibilitySummary: "",
  foodAndDrinkSummary: "",
  refundPolicySummary: "",
  termsSummary: "",
  contactSummary: "",
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const asString = (value: unknown) => (typeof value === "string" ? value : "");

/** Public-facing festival profile. Required before a festival can be launched. */
export function FestivalPublicProfileEditor({ festivalCompanyId }: { festivalCompanyId: string }) {
  const plan = useFestivalLaunchPlan(festivalCompanyId);
  const save = useSaveFestivalPublicProfile();
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);

  const existing = useMemo(() => {
    const raw = plan.data as { publicProfile?: Record<string, unknown> | null } | undefined;
    const profile = raw?.publicProfile;
    return profile && typeof profile === "object" ? profile : null;
  }, [plan.data]);

  useEffect(() => {
    if (!existing) return;
    setDraft({
      publicName: asString(existing.publicName ?? existing.public_name),
      tagline: asString(existing.tagline),
      description: asString(existing.description),
      publicSlug: asString(existing.publicSlug ?? existing.public_slug),
      ageGuidance: asString(existing.ageGuidance ?? existing.age_guidance),
      transportSummary: asString(existing.transportSummary ?? existing.transport_summary),
      campingSummary: asString(existing.campingSummary ?? existing.camping_summary),
      accessibilitySummary: asString(existing.accessibilitySummary ?? existing.accessibility_summary),
      foodAndDrinkSummary: asString(existing.foodAndDrinkSummary ?? existing.food_and_drink_summary),
      refundPolicySummary: asString(existing.refundPolicySummary ?? existing.refund_policy_summary),
      termsSummary: asString(existing.termsSummary ?? existing.terms_summary),
      contactSummary: asString(existing.contactSummary ?? existing.contact_summary),
    });
  }, [existing]);

  const expectedVersion = Number(existing?.publicVersion ?? existing?.public_version ?? 0) || 0;
  const slug = draft.publicSlug ? slugify(draft.publicSlug) : slugify(draft.publicName);

  const set = (key: keyof ProfileDraft) => (event: { target: { value: string } }) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));

  const submit = () => {
    if (!draft.publicName.trim()) {
      toast.error("Give the festival a public name before publishing.");
      return;
    }
    if (!slug) {
      toast.error("The public name must contain letters or numbers to build a web address.");
      return;
    }
    save.mutate(
      {
        festivalCompanyId,
        expectedVersion,
        idempotencyKey: crypto.randomUUID(),
        profile: {
          publicName: draft.publicName.trim(),
          tagline: draft.tagline.trim() || null,
          description: draft.description.trim(),
          publicSlug: slug,
          heroImageReference: null,
          logoReference: null,
          ageGuidance: draft.ageGuidance.trim() || null,
          accessibilitySummary: draft.accessibilitySummary.trim() || null,
          transportSummary: draft.transportSummary.trim() || null,
          campingSummary: draft.campingSummary.trim() || null,
          foodAndDrinkSummary: draft.foodAndDrinkSummary.trim() || null,
          termsSummary: draft.termsSummary.trim() || null,
          refundPolicySummary: draft.refundPolicySummary.trim() || null,
          contactSummary: draft.contactSummary.trim() || null,
        },
      },
      {
        onSuccess: () => toast.success("Public festival profile saved."),
        onError: (error) =>
          toast.error(
            error instanceof Error && error.message === "festival_public_slug_taken"
              ? "That web address is already used by another festival."
              : "The public profile could not be saved.",
          ),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Public festival profile</CardTitle>
        <CardDescription>
          This is what players see on the public festival page. A saved profile is required before you can launch and sell tickets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="festival-public-name">Public name</Label>
            <Input id="festival-public-name" value={draft.publicName} onChange={set("publicName")} placeholder="Victorious Festival" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="festival-public-slug">Web address</Label>
            <Input id="festival-public-slug" value={draft.publicSlug} onChange={set("publicSlug")} placeholder={slug || "victorious-festival"} />
            <p className="text-xs text-muted-foreground">/world/festivals/{slug || "your-festival"}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="festival-tagline">Tagline</Label>
          <Input id="festival-tagline" value={draft.tagline} onChange={set("tagline")} placeholder="Three days on the seafront" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="festival-description">Description</Label>
          <Textarea id="festival-description" rows={4} value={draft.description} onChange={set("description")} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              ["ageGuidance", "Age guidance"],
              ["transportSummary", "Travel"],
              ["campingSummary", "Camping"],
              ["accessibilitySummary", "Accessibility"],
              ["foodAndDrinkSummary", "Food and drink"],
              ["refundPolicySummary", "Refund policy"],
              ["termsSummary", "Terms"],
              ["contactSummary", "Contact"],
            ] as [keyof ProfileDraft, string][]
          ).map(([key, label]) => (
            <div className="space-y-1.5" key={key}>
              <Label htmlFor={`festival-${key}`}>{label}</Label>
              <Input id={`festival-${key}`} value={draft[key]} onChange={set(key)} />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={save.isPending || plan.isLoading}>
            {existing ? "Update public profile" : "Publish public profile"}
          </Button>
          {existing ? <span className="text-xs text-muted-foreground">Version {expectedVersion}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
