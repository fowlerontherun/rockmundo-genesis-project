import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function MayorNewsEditor({ cityId }: { cityId: string }) {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    const title = headline.trim(), text = body.trim();
    if (!profileId || title.length < 5 || title.length > 120 || text.length < 20 || text.length > 2000) {
      toast.error("Enter a 5–120 character headline and a 20–2000 character update.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("mayor_news_columns")
        .insert({ city_id: cityId, mayor_profile_id: profileId, headline: title, body: text });
      if (error) throw error;
      setHeadline("");
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["mayor-news", cityId] });
      toast.success("Your city update has been published in Today's News.");
    } catch (error) {
      toast.error((error as Error).message || "Could not publish the update.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={publish} className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">Mayor's Column — Optional City Update</h3>
      <p className="text-sm text-muted-foreground">Write an update for players currently in your city. Your latest published column appears in Today's News.</p>
      <label className="block text-sm font-medium" htmlFor="mayor-news-headline">Headline</label>
      <Input id="mayor-news-headline" maxLength={120} value={headline} onChange={e => setHeadline(e.target.value)} placeholder="What's happening in your city?" required />
      <label className="block text-sm font-medium" htmlFor="mayor-news-body">City update</label>
      <Textarea id="mayor-news-body" maxLength={2000} rows={6} value={body} onChange={e => setBody(e.target.value)} placeholder="Share improvements, upcoming initiatives and community news…" required />
      <Button type="submit" disabled={saving || !profileId}>{saving ? "Publishing…" : "Publish city update"}</Button>
    </form>
  );
}
