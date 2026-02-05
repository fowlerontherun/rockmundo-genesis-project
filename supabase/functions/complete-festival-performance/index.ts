 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 interface PerformanceInput {
   participationId: string;
   bandId: string;
   performanceScore: number;
   crowdEnergyPeak: number;
   crowdEnergyAvg: number;
   eventResponses: number[];
   songsPerformed: number;
 }
 
 const REVIEW_PUBLICATIONS = [
   { name: "Rock Review Weekly", type: "critic", weight: 1.2 },
   { name: "Festival Gazette", type: "critic", weight: 1.0 },
   { name: "Music Underground", type: "blog", weight: 0.8 },
   { name: "LiveMusicFans.com", type: "fan", weight: 0.6 },
   { name: "BandWatch", type: "industry", weight: 1.1 },
   { name: "Pitchfork Festival Report", type: "critic", weight: 1.5 },
   { name: "NME Live", type: "critic", weight: 1.4 },
   { name: "Rolling Stone Festivals", type: "critic", weight: 1.5 },
 ];
 
 const HEADLINES = {
   excellent: [
     "{band} Delivers a Performance for the Ages",
     "Absolutely Electric: {band} Steals the Show",
     "{band} Sets the Festival Ablaze",
     "A Star-Making Moment for {band}",
     "The Crowd Went Wild for {band}",
   ],
   good: [
     "{band} Delivers Solid Festival Set",
     "Crowd-Pleasing Performance from {band}",
     "{band} Proves Their Worth",
     "Energetic Show from {band}",
     "{band} Wins Over Festival Crowd",
   ],
   average: [
     "{band}: Decent But Unmemorable",
     "{band} Plays It Safe",
     "Mixed Results for {band}",
     "{band} Has Room to Grow",
     "A Standard Set from {band}",
   ],
   poor: [
     "{band} Disappoints Festival Crowd",
     "Rough Night for {band}",
     "Technical Issues Plague {band} Set",
     "{band} Falls Short of Expectations",
     "{band} Needs to Regroup",
   ],
 };
 
 function getHeadlineCategory(score: number): keyof typeof HEADLINES {
   if (score >= 85) return "excellent";
   if (score >= 70) return "good";
   if (score >= 50) return "average";
   return "poor";
 }
 
 function generateReviewText(score: number, bandName: string, crowdEnergy: number): string {
   const category = getHeadlineCategory(score);
   const energyDesc = crowdEnergy > 80 ? "electric" : crowdEnergy > 60 ? "energetic" : crowdEnergy > 40 ? "steady" : "lukewarm";
   
   const templates: Record<string, string> = {
     excellent: `${bandName} took the stage and immediately commanded the crowd's attention. With ${energyDesc} energy from start to finish, they delivered one of the standout performances of the festival.`,
     good: `${bandName} put on a solid show that kept the crowd engaged throughout. The ${energyDesc} atmosphere helped carry the set, and overall the performance was impressive.`,
     average: `${bandName}'s set was competent but lacked the spark needed to truly stand out. The ${energyDesc} crowd response reflected the middling energy on stage.`,
     poor: `Unfortunately, ${bandName} struggled to connect with the audience. The ${energyDesc} crowd response said it all - this wasn't their night.`,
   };
   
   return templates[category];
 }
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabase = createClient(
       Deno.env.get("SUPABASE_URL") ?? "",
       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
     );
 
     const input: PerformanceInput = await req.json();
     const { participationId, bandId, performanceScore, crowdEnergyPeak, crowdEnergyAvg, eventResponses, songsPerformed } = input;
 
     // Fetch participation and festival details
     const { data: participation, error: partError } = await supabase
       .from("festival_participants")
       .select(`id, event_id, user_id, slot_type, payout_amount`)
       .eq("id", participationId)
       .single();
 
     if (partError || !participation) {
       throw new Error(`Participation not found: ${partError?.message}`);
     }
 
     // Fetch band details
     const { data: band } = await supabase
       .from("bands")
       .select("id, name, genre, fame, band_balance")
       .eq("id", bandId)
       .single();
 
     if (!band) {
       throw new Error("Band not found");
     }
 
     // Calculate rewards
     const basePayment = participation.payout_amount || 5000;
     const baseFame = 500;
     const scoreMultiplier = 0.5 + (performanceScore / 100);
     const energyMultiplier = 0.8 + (crowdEnergyAvg / 200);
 
     const paymentEarned = Math.round(basePayment * scoreMultiplier * energyMultiplier);
     const fameEarned = Math.round(baseFame * scoreMultiplier * energyMultiplier);
     const merchRevenue = Math.round(1000 * (performanceScore / 50) * (crowdEnergyAvg / 50));
     const newFansGained = Math.round(100 * scoreMultiplier * energyMultiplier);
 
     // Generate review
     const category = getHeadlineCategory(performanceScore);
     const headlines = HEADLINES[category];
     const headline = headlines[Math.floor(Math.random() * headlines.length)].replace("{band}", band.name);
     
     const criticVariance = Math.floor((Math.random() - 0.5) * 20);
     const fanVariance = Math.floor((Math.random() - 0.5) * 15);
     const criticScore = Math.min(100, Math.max(0, performanceScore + criticVariance));
     const fanScore = Math.min(100, Math.max(0, performanceScore + fanVariance + 5));
 
     // Highlights
     const highlights: string[] = [];
     if (crowdEnergyPeak >= 90) highlights.push("Incredible crowd energy peak!");
     if (performanceScore >= 85) highlights.push("Near-perfect execution");
     if (eventResponses.some(r => r >= 90)) highlights.push("Handled challenges brilliantly");
 
     // Save performance history
     const { data: historyRecord } = await supabase
       .from("festival_performance_history")
       .insert({
         participation_id: participationId,
         band_id: bandId,
         festival_id: participation.event_id,
         user_id: participation.user_id,
         performance_score: performanceScore,
         crowd_energy_peak: crowdEnergyPeak,
         crowd_energy_avg: crowdEnergyAvg,
         songs_performed: songsPerformed,
         payment_earned: paymentEarned,
         fame_earned: fameEarned,
         merch_revenue: merchRevenue,
         new_fans_gained: newFansGained,
         critic_score: criticScore,
         fan_score: fanScore,
         review_headline: headline,
         review_summary: generateReviewText(performanceScore, band.name, crowdEnergyAvg),
         highlight_moments: highlights,
         slot_type: participation.slot_type,
         performance_date: new Date().toISOString(),
       })
       .select()
       .single();
 
     // Generate reviews from publications
     const numReviews = performanceScore >= 80 ? 3 : performanceScore >= 60 ? 2 : 1;
     const selectedPubs = REVIEW_PUBLICATIONS.sort(() => Math.random() - 0.5).slice(0, numReviews);
 
     for (const pub of selectedPubs) {
       const reviewScore = Math.min(100, Math.max(0, performanceScore + (Math.random() - 0.5) * 15 * pub.weight));
       const sentiment = reviewScore >= 75 ? "positive" : reviewScore >= 50 ? "mixed" : reviewScore >= 30 ? "neutral" : "negative";
 
       await supabase.from("festival_reviews").insert({
         performance_id: historyRecord?.id,
         band_id: bandId,
         reviewer_type: pub.type,
         publication_name: pub.name,
         score: Math.round(reviewScore),
         headline: headlines[Math.floor(Math.random() * headlines.length)].replace("{band}", band.name),
         review_text: generateReviewText(reviewScore, band.name, crowdEnergyAvg),
         sentiment,
         fame_impact: Math.round((reviewScore - 50) * pub.weight * 2),
         is_featured: pub.weight >= 1.4,
       });
     }
 
     // Save merch sales
     await supabase.from("festival_merch_sales").insert({
       performance_id: historyRecord?.id,
       band_id: bandId,
       festival_id: participation.event_id,
       tshirts_sold: Math.round((performanceScore / 10) * (crowdEnergyAvg / 20)),
       posters_sold: Math.round((performanceScore / 15) * (crowdEnergyAvg / 25)),
       albums_sold: Math.round((performanceScore / 20) * (crowdEnergyAvg / 30)),
       gross_revenue: merchRevenue,
       festival_cut: Math.round(merchRevenue * 0.2),
       net_revenue: Math.round(merchRevenue * 0.8),
       performance_boost: scoreMultiplier,
     });
 
     // Update participant status
     await supabase
       .from("festival_participants")
       .update({ status: "performed" })
       .eq("id", participationId);
 
     // Update band fame and balance
     await supabase
       .from("bands")
       .update({
         fame: (band.fame || 0) + fameEarned,
         band_balance: (band.band_balance || 0) + paymentEarned + Math.round(merchRevenue * 0.8),
       })
       .eq("id", bandId);
 
     // Create inbox notification
     await supabase.from("inbox_messages").insert({
       user_id: participation.user_id,
       subject: `Festival Performance Complete!`,
       content: `Your performance scored ${performanceScore}/100!\n\nEarnings: $${paymentEarned.toLocaleString()}\nFame: +${fameEarned}\nMerch: $${Math.round(merchRevenue * 0.8).toLocaleString()}\nNew Fans: +${newFansGained}`,
       message_type: "festival_result",
       priority: performanceScore >= 80 ? "high" : "normal",
     });
 
     return new Response(
       JSON.stringify({
         success: true,
         performanceScore,
         paymentEarned,
         fameEarned,
         merchRevenue: Math.round(merchRevenue * 0.8),
         newFansGained,
         criticScore,
         fanScore,
         reviewHeadline: headline,
         highlights,
       }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error) {
     console.error("Festival performance error:", error);
     return new Response(
       JSON.stringify({ error: error.message }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });