import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PrizeTier {
  matches: number;
  bonus: boolean;
  cash: number;
  xp: number;
  fame: number;
}

const PRIZE_TIERS: PrizeTier[] = [
  { matches: 7, bonus: true, cash: 1000000, xp: 10000, fame: 5000 },
  { matches: 7, bonus: false, cash: 250000, xp: 5000, fame: 0 },
  { matches: 6, bonus: true, cash: 50000, xp: 2000, fame: 0 },
  { matches: 6, bonus: false, cash: 10000, xp: 1000, fame: 0 },
  { matches: 5, bonus: true, cash: 5000, xp: 500, fame: 0 },
  { matches: 5, bonus: false, cash: 1000, xp: 200, fame: 0 },
  { matches: 4, bonus: false, cash: 500, xp: 100, fame: 0 },
  { matches: 3, bonus: false, cash: 500, xp: 0, fame: 0 }, // refund
];

function getPrize(matchCount: number, bonusMatched: boolean): { cash: number; xp: number; fame: number } {
  for (const tier of PRIZE_TIERS) {
    if (tier.matches === matchCount && (tier.bonus === false || bonusMatched)) {
      return { cash: tier.cash, xp: tier.xp, fame: tier.fame };
    }
  }
  return { cash: 0, xp: 0, fame: 0 };
}

function generateUniqueNumbers(count: number, max: number): number[] {
  const nums: number[] = [];
  while (nums.length < count) {
    const r = Math.floor(Math.random() * max) + 1;
    if (!nums.includes(r)) nums.push(r);
  }
  return nums.sort((a, b) => a - b);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find current pending draw
    const { data: pendingDraws, error: drawError } = await supabase
      .from("lottery_draws")
      .select("*")
      .eq("status", "pending")
      .order("week_start", { ascending: false })
      .limit(1);

    if (drawError) throw drawError;
    if (!pendingDraws || pendingDraws.length === 0) {
      return new Response(JSON.stringify({ message: "No pending draws" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const draw = pendingDraws[0];

    // Generate winning numbers
    const winningNumbers = generateUniqueNumbers(7, 49);
    const bonusNumber = Math.floor(Math.random() * 10) + 1;

    // Update draw with winning numbers
    const { error: updateDrawError } = await supabase
      .from("lottery_draws")
      .update({
        winning_numbers: winningNumbers,
        bonus_number: bonusNumber,
        draw_date: new Date().toISOString(),
        status: "drawn",
      })
      .eq("id", draw.id);

    if (updateDrawError) throw updateDrawError;

    // Get all tickets for this draw
    const { data: tickets, error: ticketsError } = await supabase
      .from("lottery_tickets")
      .select("*")
      .eq("draw_id", draw.id);

    if (ticketsError) throw ticketsError;

    let totalPrizesPaid = 0;

    // Process each ticket
    for (const ticket of tickets || []) {
      const selectedNumbers: number[] = ticket.selected_numbers || [];
      const matchCount = selectedNumbers.filter((n: number) => winningNumbers.includes(n)).length;
      const bonusMatched = ticket.bonus_number === bonusNumber;

      const prize = getPrize(matchCount, bonusMatched);

      // Update ticket
      await supabase
        .from("lottery_tickets")
        .update({
          matches: matchCount,
          bonus_matched: bonusMatched,
          prize_cash: prize.cash,
          prize_xp: prize.xp,
          prize_fame: prize.fame,
        })
        .eq("id", ticket.id);

      // Credit profile with prizes
      if (prize.cash > 0 || prize.xp > 0 || prize.fame > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("cash, xp, fame")
          .eq("id", ticket.profile_id)
          .single();

        if (profile) {
          await supabase
            .from("profiles")
            .update({
              cash: (profile.cash || 0) + prize.cash,
              xp: (profile.xp || 0) + prize.xp,
              fame: (profile.fame || 0) + prize.fame,
            })
            .eq("id", ticket.profile_id);

          // Mark as auto-claimed since prizes are awarded directly
          await supabase
            .from("lottery_tickets")
            .update({ claimed: true })
            .eq("id", ticket.id);
        }

        totalPrizesPaid += prize.cash;
      }
    }

    // Mark draw as paid out
    await supabase
      .from("lottery_draws")
      .update({ status: "paid_out" })
      .eq("id", draw.id);

    return new Response(
      JSON.stringify({
        success: true,
        draw_id: draw.id,
        winning_numbers: winningNumbers,
        bonus_number: bonusNumber,
        tickets_processed: (tickets || []).length,
        total_prizes_paid: totalPrizesPaid,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Lottery draw error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
