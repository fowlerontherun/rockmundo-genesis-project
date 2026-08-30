WITH seed(name, category, rarity, price_cash, duration_hours, is_legal, addiction_type, icon_name, description, lore, effects) AS (
  VALUES
  -- CONSUMABLES (instant)
  ('Backstage Bootleg Whiskey','consumable','common',180,NULL,false,'alcohol','Wine','Restores a little energy, costs you a little health.','Poured from an unmarked bottle behind a curtain of amps.','{"energy":25,"health":-8}'::jsonb),
  ('Roadie''s Energy Powder','consumable','common',220,NULL,false,'substances','Zap','A gritty scoop of whatever keeps crews upright at 4am.','Sold by the sachet from a tour case with no label.','{"energy":40,"health":-10}'::jsonb),
  ('Green Room Painkillers','consumable','common',150,NULL,false,'substances','Pill','Numbs the aches after a brutal run of shows.','Rattling around in a promoter''s desk drawer.','{"health":30,"energy":10}'::jsonb),
  ('Off-Menu Espresso Shot','consumable','common',90,NULL,true,NULL,'Coffee','A wildly illegal amount of caffeine in a tiny cup.','The barista never charges twice for the same face.','{"energy":30}'::jsonb),
  ('Doc''s Discreet Vitamin Drip','consumable','uncommon',900,NULL,false,NULL,'Syringe','A back-alley IV that puts you right back on your feet.','No paperwork, no questions, cash only.','{"health":70,"energy":45}'::jsonb),
  ('Hangover Miracle Vial','consumable','uncommon',480,NULL,false,NULL,'FlaskConical','Wipes out last night in about ninety seconds.','The recipe changes every city. The taste never does.','{"health":45,"energy":35}'::jsonb),
  ('Smuggled Absinthe','consumable','uncommon',640,NULL,false,'alcohol','Wine','Loosens the pen and wrecks the morning.','Bottled in a basement that no longer legally exists.','{"energy":25,"health":-15,"creativity_boost":25}'::jsonb),
  ('Confidence Tabs','consumable','uncommon',520,NULL,false,'substances','Sparkles','Stage fright evaporates. So does your judgement.','Popular with support acts opening for legends.','{"energy":20,"gig_quality_boost":15,"health":-10}'::jsonb),
  ('Vocal Cord Cure-All','consumable','uncommon',700,NULL,false,NULL,'Mic','Unlicensed throat tonic that saves ruined voices.','Every touring singer swears they''ve never used it.','{"health":25,"recording_quality_boost":20}'::jsonb),
  ('After-Party Party Pack','consumable','rare',1400,NULL,false,'partying','PartyPopper','Everything you need for a night nobody remembers.','Comes in a shoebox. Leaves in a police report.','{"energy":55,"fame":150,"health":-25}'::jsonb),
  ('Chemical Muse','consumable','rare',1800,NULL,false,'substances','Sparkles','Ideas arrive faster than you can write them down.','Allegedly responsible for four classic albums.','{"creativity_boost":60,"songwriting_quality_boost":30,"health":-20,"energy":20}'::jsonb),
  ('Blackout Cocktail','consumable','rare',1100,NULL,false,'alcohol','Wine','Legendary night, terrible consequences.','Named after what happens to the venue''s lighting rig.','{"energy":50,"fame":100,"health":-35}'::jsonb),
  ('Grey Market Gene Therapy','consumable','epic',9500,NULL,false,NULL,'HeartPulse','A full-body reset from a clinic with no sign on the door.','You sign a waiver written in a language you don''t read.','{"health":100,"energy":100}'::jsonb),
  ('Elixir of the Twenty-Sevens','consumable','legendary',42000,NULL,false,'substances','Skull','Immense power. Terrible price.','They say only twenty-six bottles were ever made.','{"health":80,"energy":100,"fame":1200,"xp":2500,"creativity_boost":90}'::jsonb),

  -- BOOSTERS (timed)
  ('Bent Promoter''s Handshake','booster','common',450,12,false,NULL,'Handshake','A quiet word gets you a better door split.','He counts the cash twice and the tickets never.','{"gig_earnings_boost":15}'::jsonb),
  ('Payola Envelope','booster','uncommon',2400,24,false,NULL,'Radio','Cash in the right hands moves you up the playlist.','Officially this has been illegal since the fifties.','{"fame_multiplier":1.3,"fame":300}'::jsonb),
  ('Bot Farm Subscription','booster','uncommon',1900,24,false,NULL,'Bot','Ten thousand very enthusiastic fake fans.','They all live in the same server rack.','{"fame_multiplier":1.4}'::jsonb),
  ('Ghost Ticket Scalper','booster','uncommon',1600,24,false,NULL,'Ticket','Somebody sells the same seat three times and cuts you in.','If asked, you have never met this man.','{"gig_earnings_boost":45}'::jsonb),
  ('Stolen Studio Time','booster','uncommon',2100,24,false,NULL,'Mic','Someone else''s booked session, now mysteriously yours.','The engineer has been paid to forget your face.','{"recording_quality_boost":35}'::jsonb),
  ('Counterfeit Press Pass','booster','uncommon',1200,24,false,NULL,'IdCard','Gets you into rooms you have no business being in.','The hologram is wrong but nobody ever checks.','{"fame":250,"fame_multiplier":1.2}'::jsonb),
  ('Hired Hype Crew','booster','uncommon',1750,12,false,NULL,'Users','Twenty paid strangers screaming your name from the front.','They also do weddings and political rallies.','{"gig_quality_boost":30,"fame":200}'::jsonb),
  ('Bribed Sound Engineer','booster','uncommon',1350,12,false,NULL,'SlidersHorizontal','Suddenly your mix is the best in the building.','The support act''s vocals stay mysteriously buried.','{"gig_quality_boost":35}'::jsonb),
  ('Underground Buzz Campaign','booster','rare',5200,48,false,NULL,'Megaphone','Whispers in every scene, all pointing at you.','Nobody can tell you who started it. That''s the point.','{"fame_multiplier":1.6,"fame":600}'::jsonb),
  ('Chart Manipulation Package','booster','rare',7800,48,false,NULL,'TrendingUp','Bulk buys, laundered streams, plausible deniability.','Priced per position climbed.','{"fame_multiplier":1.8,"fame":900,"gig_earnings_boost":40}'::jsonb),
  ('Blackmail Dossier','booster','rare',6400,48,false,NULL,'FolderLock','Leverage over someone who owes the industry favours.','A thin brown folder that ends careers.','{"gig_earnings_boost":90,"fame":400}'::jsonb),
  ('Unlicensed Nootropic Regimen','booster','rare',4300,48,false,'substances','Brain','Your brain runs hot for two days straight.','Banned in eleven countries and every sports league.','{"xp_multiplier":1.8,"creativity_boost":50}'::jsonb),
  ('Pirate Radio Rotation','booster','rare',3600,48,false,NULL,'RadioTower','A transmitter on a tower block plays you hourly.','The signal moves every time they get raided.','{"fame":700,"fame_multiplier":1.4}'::jsonb),
  ('Ghostwriter On Retainer','booster','rare',5800,72,false,NULL,'PenLine','Somebody brilliant writes and you sign.','Contractually she does not exist.','{"songwriting_quality_boost":70,"creativity_boost":40}'::jsonb),
  ('Tabloid Editor On Payroll','booster','epic',14500,72,false,NULL,'Newspaper','Every headline this week is yours and flattering.','The bad stories about you go in a locked drawer.','{"fame_multiplier":2.2,"fame":2000}'::jsonb),
  ('Laundered Tour Accounts','booster','epic',18000,72,false,NULL,'Banknote','The numbers come out beautifully in your favour.','Two sets of books, one very good accountant.','{"gig_earnings_boost":160}'::jsonb),
  ('Cartel Merch Pipeline','booster','epic',16200,72,false,NULL,'Package','Bootleg shirts everywhere, and you take a cut.','Printed in a warehouse that also handles other cargo.','{"gig_earnings_boost":130,"fame":1200}'::jsonb),
  ('Deal at the Crossroads','booster','legendary',88000,168,false,NULL,'Skull','A week of impossible talent, signed for in blood.','The paperwork is very old and very binding.','{"xp_multiplier":3,"fame_multiplier":3,"gig_quality_boost":100,"songwriting_quality_boost":100,"recording_quality_boost":100}'::jsonb),

  -- SKILL BOOKS (bootleg tuition)
  ('Bootleg Vocal Masterclass','skill_book','common',600,NULL,false,NULL,'BookOpen','A ripped copy of a very expensive singing course.','Watermark still visible in the bottom corner.','{"skill_slug":"basic_singing","skill_xp":400}'::jsonb),
  ('Stolen Songwriting Notebook','skill_book','uncommon',1400,NULL,false,NULL,'BookOpen','Somebody famous''s working lyrics, lifted from a hotel.','Half the pages are crossed out. Those are the good ones.','{"skill_slug":"basic_lyrics","skill_xp":900}'::jsonb),
  ('Pirated Mixing Course','skill_book','uncommon',1250,NULL,false,NULL,'BookOpen','Forty hours of studio technique, no licence key.','Ripped from a subscription platform in one long night.','{"skill_slug":"basic_mixing_mastering","skill_xp":850}'::jsonb),
  ('Smuggled Drum Method','skill_book','common',700,NULL,false,NULL,'BookOpen','A legendary practice regime, photocopied to death.','Page fourteen is missing and nobody knows why.','{"skill_slug":"drums","skill_xp":450}'::jsonb),
  ('Bass Bible (Unauthorised Edition)','skill_book','common',680,NULL,false,NULL,'BookOpen','Everything about groove, printed without permission.','The publisher has been chasing this for a decade.','{"skill_slug":"bass","skill_xp":450}'::jsonb),
  ('Grifter''s Guide to Negotiation','skill_book','uncommon',1600,NULL,false,NULL,'BookOpen','How to win a room you should have walked out of.','Written under a pseudonym by a struck-off lawyer.','{"skill_slug":"basic_negotiation","skill_xp":950}'::jsonb),
  ('Leaked Showmanship Playbook','skill_book','rare',3200,NULL,false,NULL,'BookOpen','A stadium act''s internal staging bible.','It leaked from a production company laptop.','{"skill_slug":"basic_showmanship","skill_xp":1800}'::jsonb),
  ('Contraband Production Manual','skill_book','rare',3400,NULL,false,NULL,'BookOpen','Studio secrets nobody was supposed to write down.','Circulated as a PDF with the pages out of order.','{"skill_slug":"basic_record_production","skill_xp":1900}'::jsonb),
  ('Black Market Beat Bundle','skill_book','uncommon',1500,NULL,false,NULL,'BookOpen','Cracked plugins and a very fast course in beatmaking.','The installer asks for permissions it should not need.','{"skill_slug":"basic_beatmaking","skill_xp":900}'::jsonb),
  ('Unlicensed DAW Bootcamp','skill_book','uncommon',1450,NULL,false,NULL,'BookOpen','A whole studio education from an unlicensed seat.','The trainer teaches from a laptop with a taped-over camera.','{"skill_slug":"basic_daw_use","skill_xp":880}'::jsonb),
  ('Backroom Rap Workshop','skill_book','uncommon',1550,NULL,false,NULL,'BookOpen','Cash-only bars and breath control sessions.','Held above a chicken shop, twice a week.','{"skill_slug":"basic_rapping","skill_xp":920}'::jsonb),
  ('Stagehand''s Forbidden Rigging Notes','skill_book','uncommon',1300,NULL,false,NULL,'BookOpen','How to rig fast, cheap, and against regulations.','Includes several methods now explicitly banned.','{"skill_slug":"basic_stage_tech","skill_xp":860}'::jsonb),
  ('Crowd Control Dark Arts','skill_book','rare',3100,NULL,false,NULL,'BookOpen','Manipulating a room of thousands, ethics optional.','Section three is titled simply "Fear".','{"skill_slug":"basic_crowd_interaction","skill_xp":1750}'::jsonb),
  ('Forbidden Composition Treatise','skill_book','epic',7400,NULL,false,NULL,'BookOpen','Harmony theory once suppressed by a music academy.','The original copies were reportedly burned.','{"skill_slug":"basic_composing","skill_xp":3200}'::jsonb),
  ('The Lost Masters'' Ledger','skill_book','legendary',26000,NULL,false,NULL,'BookOpen','Handwritten notes from a vanished virtuoso.','Sold once a decade, never by the same dealer.','{"skill_slug":"basic_lyrics","skill_xp":6000,"creativity_boost":40}'::jsonb),

  -- COLLECTIBLES
  ('Cracked Bootleg Cassette','collectible','common',260,NULL,false,NULL,'Disc','A warped tape of a gig that was never released.','Recorded on a dictaphone in someone''s jacket.','{"fame":60}'::jsonb),
  ('Stolen Setlist','collectible','common',340,NULL,false,NULL,'ScrollText','Torn off the stage floor before security noticed.','Beer-stained, gaffer tape still attached.','{"fame":80}'::jsonb),
  ('Counterfeit Gold Disc','collectible','uncommon',1800,NULL,false,NULL,'Award','Looks exactly like an award you never won.','Spray paint over a bin-diving find.','{"fame":300}'::jsonb),
  ('Smuggled Vintage Tube Amp','collectible','rare',9200,NULL,false,NULL,'Amplifier','Crossed three borders in the back of a van.','Serial number filed off with a nail file.','{"gig_quality_boost":25,"fame":400}'::jsonb),
  ('Dead Legend''s Guitar Pick','collectible','rare',6800,NULL,false,NULL,'Guitar','Allegedly used on the last night of the last tour.','Comes with a certificate signed by nobody verifiable.','{"fame":600,"gig_quality_boost":15}'::jsonb),
  ('Unreleased Master Tape','collectible','epic',22000,NULL,false,NULL,'Disc','A record label''s buried album, never to be issued.','Walked out of an archive inside a coat.','{"fame":1500,"recording_quality_boost":30}'::jsonb),
  ('Blood-Signed Contract Fragment','collectible','epic',24500,NULL,false,NULL,'FileWarning','A torn corner of somebody''s very bad deal.','Still slightly warm, which nobody can explain.','{"fame":1400,"xp":2000}'::jsonb),
  ('The Original Riff','collectible','legendary',96000,NULL,false,NULL,'Crown','A single sheet said to hold the first riff ever played.','Every owner has become famous. None have stayed happy.','{"fame":5000,"xp":8000,"creativity_boost":80}'::jsonb)
)
INSERT INTO public.underworld_products
  (name, category, rarity, price_cash, duration_hours, is_legal, addiction_type, icon_name, description, lore, effects, is_available)
SELECT s.name, s.category, s.rarity, s.price_cash, s.duration_hours, s.is_legal, s.addiction_type, s.icon_name, s.description, s.lore, s.effects, true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.underworld_products p WHERE p.name = s.name
);