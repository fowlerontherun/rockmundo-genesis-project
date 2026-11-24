import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ArtistIdentity } from "../domain/festivalArtistProgramme";

export const festivalArtistIdentityKey = (identity: ArtistIdentity) => identity.type === "band"
  ? `band:${identity.bandId}` : identity.type === "solo" ? `solo:${identity.artistProfileId}` : `npc:${identity.npcArtistId}`;

export function useFestivalArtistNames(identities: ArtistIdentity[]) {
  const bandIds = [...new Set(identities.flatMap(identity => identity.type === "band" ? [identity.bandId] : []))].sort();
  const profileIds = [...new Set(identities.flatMap(identity => identity.type === "solo" ? [identity.artistProfileId] : []))].sort();
  return useQuery({
    queryKey: ["festival-artist-display-names", bandIds, profileIds],
    enabled: bandIds.length + profileIds.length > 0,
    queryFn: async () => {
      const names = new Map<string, string>();
      await Promise.all([
        bandIds.length ? supabase.from("bands").select("id,name").in("id", bandIds).then(({ data, error }) => {
          if (error) throw error;
          for (const band of data ?? []) names.set(`band:${band.id}`, band.name);
        }) : Promise.resolve(),
        profileIds.length ? supabase.from("profiles").select("id,display_name,username").in("id", profileIds).then(({ data, error }) => {
          if (error) throw error;
          for (const profile of data ?? []) names.set(`solo:${profile.id}`, profile.display_name || profile.username || "Solo artist");
        }) : Promise.resolve(),
      ]);
      return names;
    },
  });
}