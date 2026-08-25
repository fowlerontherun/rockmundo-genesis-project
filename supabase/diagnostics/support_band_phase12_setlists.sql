-- Support Band Marketplace Phase 12: read-only support setlist diagnostics.
SELECT
  to_regclass('public.support_band_setlists') AS support_setlists_table,
  to_regclass('public.support_band_setlist_items') AS support_setlist_items_table,
  to_regprocedure('public.save_support_band_setlist(uuid,text,uuid[])') AS save_support_setlist_rpc,
  to_regprocedure('public.get_support_band_setlist(uuid)') AS get_support_setlist_rpc;

-- Confirm no support setlist is attached to the wrong support band/gig.
SELECT
  ss.id AS setlist_id,
  ss.support_slot_id,
  ss.gig_id AS setlist_gig_id,
  gs.gig_id AS slot_gig_id,
  ss.support_band_id AS setlist_band_id,
  gs.support_band_id AS slot_band_id
FROM public.support_band_setlists ss
JOIN public.gig_support_slots gs ON gs.id=ss.support_slot_id
WHERE ss.gig_id<>gs.gig_id OR ss.support_band_id<>gs.support_band_id;

-- Confirm saved duration matches selected song duration and remains within the 30 minute limit.
SELECT
  ss.id,
  ss.support_slot_id,
  ss.total_duration_seconds AS saved_duration,
  COALESCE(sum(COALESCE(s.duration_seconds,0)),0)::integer AS calculated_duration,
  count(i.id) AS song_count
FROM public.support_band_setlists ss
LEFT JOIN public.support_band_setlist_items i ON i.setlist_id=ss.id
LEFT JOIN public.songs s ON s.id=i.song_id
GROUP BY ss.id,ss.support_slot_id,ss.total_duration_seconds
HAVING ss.total_duration_seconds<>COALESCE(sum(COALESCE(s.duration_seconds,0)),0)::integer
   OR ss.total_duration_seconds>1800
   OR count(i.id)>6;

-- Operational totals.
SELECT
  count(*) AS saved_support_setlists,
  COALESCE(avg(total_duration_seconds),0)::numeric(10,1) AS avg_duration_seconds,
  COALESCE(max(total_duration_seconds),0) AS longest_duration_seconds
FROM public.support_band_setlists;
