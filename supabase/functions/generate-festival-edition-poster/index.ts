import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentication required" }, 401);

    const { festivalCompanyId, festivalEditionId } = await req.json();
    if (!festivalCompanyId || !festivalEditionId) {
      return json({ error: "Festival company and edition are required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "Poster generation is not configured" }, 503);

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: ownerWorkspace, error: ownerError } = await caller.rpc(
      "get_festival_owner_lineup_workspace",
      {
        p_festival_company_id: festivalCompanyId,
        p_festival_edition_id: festivalEditionId,
      },
    );
    if (ownerError || !ownerWorkspace?.canonicalEditionId) {
      return json({ error: "Festival management access denied" }, 403);
    }

    const canonicalEditionId = ownerWorkspace.canonicalEditionId as string;
    const { data: edition, error: editionError } = await service
      .from("festival_editions")
      .select("id,title,start_at,end_at,city_id,festival_id")
      .eq("id", canonicalEditionId)
      .single();
    if (editionError || !edition) return json({ error: "Festival edition not found" }, 404);

    const [{ data: stages = [] }, { data: slots = [] }, { data: city }] = await Promise.all([
      service.from("festival_stages").select("id,stage_name,public_name,genre_focus").eq("edition_id", canonicalEditionId).order("stage_number"),
      service.from("festival_stage_slots").select("id,stage_id,day_number,slot_number,slot_type,start_time,end_time,band_id,is_npc_dj,npc_dj_name,npc_dj_genre,band:bands(name)").eq("edition_id", canonicalEditionId).order("day_number").order("start_time"),
      edition.city_id ? service.from("cities").select("name,country").eq("id", edition.city_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    const performers = (slots ?? []).map((slot: any) => ({
      name: slot.is_npc_dj ? slot.npc_dj_name || "Festival act" : slot.band?.name || null,
      stageId: slot.stage_id,
      dayNumber: slot.day_number,
      slotType: slot.slot_type,
      startsAt: slot.start_time,
      genre: slot.is_npc_dj ? slot.npc_dj_genre : null,
    })).filter((slot: any) => slot.name);

    const headliners = performers.filter((item: any) => item.slotType === "headliner").map((item: any) => item.name);
    const others = performers.filter((item: any) => item.slotType !== "headliner").map((item: any) => item.name);
    const stageNames = (stages ?? []).map((stage: any) => stage.public_name || stage.stage_name).filter(Boolean);
    const startDate = new Date(edition.start_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const endDate = new Date(edition.end_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const location = city ? `${city.name}${city.country ? `, ${city.country}` : ""}` : "Location TBA";

    const prompt = `Create a professional portrait music festival lineup poster for "${edition.title}".\nLocation: ${location}\nDates: ${startDate} - ${endDate}\nStages: ${stageNames.join(", ") || "Main Stage"}\nHeadliners (largest type): ${headliners.join(", ") || "To be announced"}\nOther confirmed performers: ${others.join(", ") || "More acts to be announced"}\n\nUse a premium contemporary rock festival visual identity: dramatic but readable, bold hierarchy, strong typography, no fake sponsor logos, no invented performers. Festival name at top, dates/location clearly visible, headliners dominant, remaining acts grouped below. Portrait 3:4 composition, high resolution.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      console.error("festival poster generation failed", aiResponse.status, detail);
      return json({ error: aiResponse.status === 429 ? "Poster generation is busy. Try again shortly." : "Poster generation failed" }, aiResponse.status === 429 ? 429 : 502);
    }

    const aiData = await aiResponse.json();
    const imageDataUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageDataUrl) return json({ error: "No poster image was returned" }, 502);

    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const binaryData = Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0));
    const fileName = `editions/${canonicalEditionId}.png`;
    const { error: uploadError } = await service.storage
      .from("festival-posters")
      .upload(fileName, binaryData, { contentType: "image/png", upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = service.storage.from("festival-posters").getPublicUrl(fileName);
    const { data: latestVersion } = await service
      .from("festival_edition_poster_versions")
      .select("version_number")
      .eq("edition_id", canonicalEditionId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const versionNumber = Number(latestVersion?.version_number ?? 0) + 1;

    await service
      .from("festival_edition_poster_versions")
      .update({ status: "archived" })
      .eq("edition_id", canonicalEditionId)
      .eq("status", "published");

    const sourceSnapshot = {
      festivalCompanyId,
      festivalEditionId,
      canonicalEditionId,
      title: edition.title,
      location,
      startAt: edition.start_at,
      endAt: edition.end_at,
      stages: stageNames,
      performers,
    };
    const { error: versionError } = await service.from("festival_edition_poster_versions").insert({
      edition_id: canonicalEditionId,
      version_number: versionNumber,
      source_snapshot: sourceSnapshot,
      poster_url: publicUrlData.publicUrl,
      status: "published",
    });
    if (versionError) throw versionError;

    return json({
      posterUrl: publicUrlData.publicUrl,
      posterVersion: versionNumber,
      canonicalEditionId,
    });
  } catch (error) {
    console.error("generate-festival-edition-poster", error);
    return json({ error: error instanceof Error ? error.message : "Poster generation failed" }, 500);
  }
});
