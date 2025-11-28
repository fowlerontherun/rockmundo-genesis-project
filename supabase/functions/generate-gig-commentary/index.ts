import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventType, context } = await req.json();

    let commentary = "";

    switch (eventType) {
      case "song_start":
        commentary = generateSongStartCommentary(context);
        break;
      case "solo_moment":
        commentary = generateSoloCommentary(context);
        break;
      case "crowd_surge":
        commentary = generateCrowdSurgeCommentary(context);
        break;
      case "technical_moment":
        commentary = generateTechnicalCommentary(context);
        break;
      case "encore_buildup":
        commentary = generateEncoreCommentary(context);
        break;
      case "song_end":
        commentary = generateSongEndCommentary(context);
        break;
      case "between_songs":
        commentary = generateBetweenSongsCommentary(context);
        break;
      default:
        commentary = "The show continues...";
    }

    return new Response(
      JSON.stringify({ commentary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating commentary:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function generateSongStartCommentary(context: any): string {
  const { songTitle, position, totalSongs } = context;
  const templates = [
    `The band launches into "${songTitle}" - song ${position} of ${totalSongs}`,
    `"${songTitle}" begins with powerful opening chords`,
    `The crowd roars as the band starts "${songTitle}"`,
    `Energy builds as "${songTitle}" kicks off`,
    `"${songTitle}" - the band is locked in and ready`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

function generateSoloCommentary(context: any): string {
  const { instrument, performanceScore } = context;
  
  if (performanceScore >= 22) {
    const templates = [
      `🎸 Absolutely blistering ${instrument} solo! The crowd is losing their minds!`,
      `🔥 That ${instrument} solo just brought the house down!`,
      `⚡ Incredible ${instrument} work - this is what people came to see!`,
      `🎯 Masterclass ${instrument} solo - pure technical perfection!`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  } else if (performanceScore >= 18) {
    const templates = [
      `The ${instrument} player steps forward for a solid solo`,
      `Nice ${instrument} work here - the crowd appreciates the skill`,
      `Strong ${instrument} showcase drawing cheers from the audience`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  } else {
    const templates = [
      `A ${instrument} solo attempts to elevate the energy`,
      `The ${instrument} player takes their moment in the spotlight`,
      `Brief ${instrument} feature as the song progresses`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }
}

function generateCrowdSurgeCommentary(context: any): string {
  const { crowdResponse, energyLevel } = context;
  
  if (crowdResponse === "ecstatic") {
    return "🔥 THE CROWD IS GOING ABSOLUTELY WILD! This is ELECTRIC!";
  } else if (crowdResponse === "enthusiastic") {
    return "The energy in the room just jumped up several notches!";
  } else if (crowdResponse === "engaged") {
    return "The audience is locked in - heads nodding, feet moving";
  } else if (crowdResponse === "mixed") {
    return "Mixed reactions from the crowd - some are into it, others less so";
  } else {
    return "The energy has dipped... the band needs to win them back";
  }
}

function generateTechnicalCommentary(context: any): string {
  const { performanceScore, issue } = context;
  
  if (issue) {
    const issues = [
      "⚠️ Technical hiccup - but the band powers through professionally",
      "Brief sound issue, quickly resolved by the crew",
      "Equipment adjustment mid-performance - happens to the best",
    ];
    return issues[Math.floor(Math.random() * issues.length)];
  }
  
  if (performanceScore >= 22) {
    return "✨ Everything is clicking - sound, lights, performance, all in perfect harmony";
  } else if (performanceScore <= 12) {
    return "The production team is working hard to smooth out some rough edges";
  }
  
  return "The technical crew keeps everything running smoothly";
}

function generateEncoreCommentary(context: any): string {
  const { overallRating, crowdSize } = context;
  
  if (overallRating >= 20) {
    return "🎉 ENCORE! ENCORE! The crowd is chanting, demanding more!";
  } else if (overallRating >= 16) {
    return "Strong applause - some fans calling for an encore!";
  } else {
    return "Appreciative applause as the set comes to a close";
  }
}

function generateSongEndCommentary(context: any): string {
  const { crowdResponse, performanceScore } = context;
  
  const responses = {
    ecstatic: [
      "🔥 MASSIVE ROAR from the crowd! That was INCREDIBLE!",
      "The venue ERUPTS with applause and cheers!",
      "Standing ovation material right there!",
    ],
    enthusiastic: [
      "Loud cheers and applause fill the venue!",
      "The crowd absolutely loved that one!",
      "Enthusiastic response from the audience!",
    ],
    engaged: [
      "Solid applause from the engaged crowd",
      "The audience shows their appreciation",
      "Good response as the song concludes",
    ],
    mixed: [
      "Scattered applause - mixed reactions",
      "Polite clapping from most of the crowd",
      "Some enjoyed it more than others",
    ],
    disappointed: [
      "Muted response from the disappointed crowd",
      "That one didn't quite land as hoped",
      "Sparse applause... tough one",
    ],
  };
  
  const templates = responses[crowdResponse as keyof typeof responses] || responses.mixed;
  return templates[Math.floor(Math.random() * templates.length)];
}

function generateBetweenSongsCommentary(context: any): string {
  const { nextSongTitle, bandEnergy } = context;
  
  const templates = [
    `The band takes a moment... "${nextSongTitle}" is up next`,
    `Quick water break before launching into "${nextSongTitle}"`,
    `The frontman addresses the crowd while setting up for "${nextSongTitle}"`,
    `Instruments tuned, energy high - "${nextSongTitle}" incoming`,
    `A brief pause before the next song: "${nextSongTitle}"`,
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}
