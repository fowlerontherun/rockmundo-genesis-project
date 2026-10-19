-- #4232: Bootstrap empty modeling-gig catalogue from existing agencies.
-- No unverified brand IDs or fictitious models are created.
WITH starter(title,gig_type,agency_tier,min_looks,min_fame,pay_min,pay_max,fame_gain,hours,description) AS (
 VALUES
 ('Local Fashion Lookbook','photo_shoot','local',40,0,80,250,8,2,'An entry-level studio lookbook shoot'),
 ('Portrait Portfolio Session','photo_shoot','local',40,0,120,300,10,2,'Build your professional portfolio with a local photographer'),
 ('Regional Runway Casting','runway','national',50,200,400,1200,35,3,'Walk a regional fashion runway'),
 ('Independent Brand Commercial','commercial','national',50,300,300,1000,25,3,'Appear in a short commercial production'),
 ('Magazine Cover Editorial','cover_shoot','international',60,1500,1000,3000,90,4,'Featured editorial cover photography'),
 ('International Brand Campaign','brand_ambassador','international',65,5000,1800,5000,150,4,'Become the face of a fashion campaign'),
 ('Music Video Fashion Cameo','music_video_cameo','international',50,800,450,1500,50,3,'Model a featured look in a music video')
)
INSERT INTO public.modeling_gigs
 (title,gig_type,agency_id,min_looks_required,min_fame_required,
  compensation_min,compensation_max,fame_boost,duration_hours,description,is_available)
SELECT s.title,s.gig_type,
 (SELECT a.id FROM public.modeling_agencies a WHERE a.tier=s.agency_tier ORDER BY a.name LIMIT 1),
 s.min_looks,s.min_fame,s.pay_min,s.pay_max,s.fame_gain,s.hours,s.description,true
FROM starter s
WHERE NOT EXISTS (
 SELECT 1 FROM public.modeling_gigs g
 WHERE g.title=s.title AND g.gig_type=s.gig_type
);
