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
      // New performance item event types
      case "performance_item_start":
        commentary = generatePerformanceItemCommentary(context);
        break;
      case "crowd_interaction":
        commentary = generateCrowdInteractionCommentary(context);
        break;
      case "stage_action":
        commentary = generateStageActionCommentary(context);
        break;
      case "special_effect":
        commentary = generateSpecialEffectCommentary(context);
        break;
      case "improvisation":
        commentary = generateImprovisationCommentary(context);
        break;
      case "storytelling":
        commentary = generateStorytellingCommentary(context);
        break;
      case "band_entrance":
        commentary = generateBandEntranceCommentary(context);
        break;
      case "band_exit":
        commentary = generateBandExitCommentary(context);
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

function getRandomTemplate(templates: string[]): string {
  return templates[Math.floor(Math.random() * templates.length)];
}

function generateSongStartCommentary(context: any): string {
  const { songTitle, position, totalSongs } = context;
  const templates = [
    `The band launches into "${songTitle}" - song ${position} of ${totalSongs}`,
    `"${songTitle}" begins with powerful opening chords`,
    `The crowd roars as the band starts "${songTitle}"`,
    `Energy builds as "${songTitle}" kicks off`,
    `"${songTitle}" - the band is locked in and ready`,
  ];
  return getRandomTemplate(templates);
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
    return getRandomTemplate(templates);
  } else if (performanceScore >= 18) {
    const templates = [
      `The ${instrument} player steps forward for a solid solo`,
      `Nice ${instrument} work here - the crowd appreciates the skill`,
      `Strong ${instrument} showcase drawing cheers from the audience`,
    ];
    return getRandomTemplate(templates);
  } else {
    const templates = [
      `A ${instrument} solo attempts to elevate the energy`,
      `The ${instrument} player takes their moment in the spotlight`,
      `Brief ${instrument} feature as the song progresses`,
    ];
    return getRandomTemplate(templates);
  }
}

function generateCrowdSurgeCommentary(context: any): string {
  const { crowdResponse } = context;
  
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
    return getRandomTemplate(issues);
  }
  
  if (performanceScore >= 22) {
    return "✨ Everything is clicking - sound, lights, performance, all in perfect harmony";
  } else if (performanceScore <= 12) {
    return "The production team is working hard to smooth out some rough edges";
  }
  
  return "The technical crew keeps everything running smoothly";
}

function generateEncoreCommentary(context: any): string {
  const { overallRating } = context;
  
  if (overallRating >= 20) {
    return "🎉 ENCORE! ENCORE! The crowd is chanting, demanding more!";
  } else if (overallRating >= 16) {
    return "Strong applause - some fans calling for an encore!";
  } else {
    return "Appreciative applause as the set comes to a close";
  }
}

function generateSongEndCommentary(context: any): string {
  const { crowdResponse } = context;
  
  const responses: Record<string, string[]> = {
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
  
  const templates = responses[crowdResponse] || responses.mixed;
  return getRandomTemplate(templates);
}

function generateBetweenSongsCommentary(context: any): string {
  const { nextSongTitle } = context;
  
  const templates = [
    `The band takes a moment... "${nextSongTitle}" is up next`,
    `Quick water break before launching into "${nextSongTitle}"`,
    `The frontman addresses the crowd while setting up for "${nextSongTitle}"`,
    `Instruments tuned, energy high - "${nextSongTitle}" incoming`,
    `A brief pause before the next song: "${nextSongTitle}"`,
  ];
  
  return getRandomTemplate(templates);
}

// NEW: Performance Item Commentary Functions

function generatePerformanceItemCommentary(context: any): string {
  const { itemName, itemCategory, crowdAppeal } = context;
  
  const categoryTemplates: Record<string, string[]> = {
    crowd_interaction: [
      `The band engages with the crowd: "${itemName}"!`,
      `"${itemName}" - the audience is eating this up!`,
      `Personal touch moment: ${itemName}`,
    ],
    stage_action: [
      `🎭 ${itemName} - what a moment!`,
      `The stage comes alive with ${itemName}!`,
      `${itemName} has the crowd mesmerized!`,
    ],
    special_effect: [
      `💥 ${itemName} - SPECTACULAR!`,
      `The production team delivers: ${itemName}!`,
      `WOW! ${itemName} lights up the venue!`,
    ],
    improvisation: [
      `🎵 Improvisation time: ${itemName}`,
      `The band goes off-script with ${itemName}`,
      `Spontaneous moment: ${itemName}!`,
    ],
    storytelling: [
      `📖 The frontman shares: ${itemName}`,
      `A moment of connection: ${itemName}`,
      `${itemName} - the crowd hangs on every word`,
    ],
  };
  
  const templates = categoryTemplates[itemCategory] || categoryTemplates.stage_action;
  return getRandomTemplate(templates);
}

function generateCrowdInteractionCommentary(context: any): string {
  const { itemName, crowdResponse } = context;
  
  if (crowdResponse === "ecstatic" || crowdResponse === "enthusiastic") {
    const templates = [
      `🙌 "${itemName}" - THE CROWD IS LOVING THIS!`,
      `Everyone's participating in "${itemName}"!`,
      `"${itemName}" brings the whole venue together!`,
      `Incredible connection with "${itemName}"!`,
    ];
    return getRandomTemplate(templates);
  } else {
    const templates = [
      `The band tries "${itemName}" with the crowd`,
      `"${itemName}" - some fans are really into it`,
      `Crowd interaction moment: ${itemName}`,
    ];
    return getRandomTemplate(templates);
  }
}

function generateStageActionCommentary(context: any): string {
  const { itemName, performanceScore } = context;
  
  if (performanceScore >= 18) {
    const templates = [
      `🔥 ${itemName} - NAILED IT!`,
      `The crowd goes wild for ${itemName}!`,
      `${itemName} - that was PERFECT!`,
      `Incredible execution of ${itemName}!`,
    ];
    return getRandomTemplate(templates);
  } else {
    const templates = [
      `${itemName} adds to the show`,
      `The band performs ${itemName}`,
      `Nice touch with ${itemName}`,
    ];
    return getRandomTemplate(templates);
  }
}

function generateSpecialEffectCommentary(context: any): string {
  const { itemName, intensity } = context;
  
  if (intensity >= 8) {
    const templates = [
      `💥💥💥 ${itemName} - ABSOLUTELY SPECTACULAR!!!`,
      `🔥 ${itemName} EXPLODES across the stage!`,
      `INSANE! ${itemName} has everyone screaming!`,
      `The whole venue gasps at ${itemName}!`,
    ];
    return getRandomTemplate(templates);
  } else {
    const templates = [
      `✨ ${itemName} adds atmosphere`,
      `Nice effect: ${itemName}`,
      `${itemName} enhances the visual experience`,
    ];
    return getRandomTemplate(templates);
  }
}

function generateImprovisationCommentary(context: any): string {
  const { itemName, performanceScore } = context;
  
  if (performanceScore >= 20) {
    const templates = [
      `🎸 INCREDIBLE improv during "${itemName}"!`,
      `The band is on FIRE with this improvisation!`,
      `"${itemName}" - pure musical magic happening!`,
      `This improvised moment will be talked about for years!`,
    ];
    return getRandomTemplate(templates);
  } else if (performanceScore >= 15) {
    const templates = [
      `Nice improvisation: "${itemName}"`,
      `The band shows off their chops with "${itemName}"`,
      `Spontaneous and skilled: "${itemName}"`,
    ];
    return getRandomTemplate(templates);
  } else {
    const templates = [
      `The band experiments with "${itemName}"`,
      `An improvised moment: "${itemName}"`,
      `"${itemName}" - a brave attempt at something different`,
    ];
    return getRandomTemplate(templates);
  }
}

function generateStorytellingCommentary(context: any): string {
  const { itemName, crowdResponse } = context;
  
  if (crowdResponse === "ecstatic" || crowdResponse === "enthusiastic") {
    const templates = [
      `📖 "${itemName}" - the crowd is captivated!`,
      `You could hear a pin drop during "${itemName}"`,
      `"${itemName}" resonates deeply with the audience`,
      `Tears in the crowd as "${itemName}" unfolds`,
    ];
    return getRandomTemplate(templates);
  } else {
    const templates = [
      `The frontman shares: "${itemName}"`,
      `A personal moment: "${itemName}"`,
      `"${itemName}" connects with parts of the crowd`,
    ];
    return getRandomTemplate(templates);
  }
}

function generateBandEntranceCommentary(context: any): string {
  const { bandName, venueSize, fame } = context;
  
  if (fame >= 80 || venueSize === "large") {
    const templates = [
      `🌟 THE MOMENT EVERYONE'S BEEN WAITING FOR! ${bandName} takes the stage!`,
      `🔥 The arena ERUPTS as ${bandName} walks out!`,
      `Deafening screams as ${bandName} emerges from backstage!`,
      `The anticipation breaks - ${bandName} IS HERE!`,
    ];
    return getRandomTemplate(templates);
  } else if (fame >= 40) {
    const templates = [
      `Cheers fill the venue as ${bandName} takes the stage!`,
      `${bandName} walks out to enthusiastic applause!`,
      `The crowd welcomes ${bandName} warmly!`,
    ];
    return getRandomTemplate(templates);
  } else {
    const templates = [
      `${bandName} takes the stage to welcoming applause`,
      `The crowd greets ${bandName} as they walk on`,
      `${bandName} arrives on stage, ready to perform`,
    ];
    return getRandomTemplate(templates);
  }
}

function generateBandExitCommentary(context: any): string {
  const { overallRating, encoreExpected } = context;
  
  if (encoreExpected && overallRating >= 18) {
    const templates = [
      `The band walks off... but the crowd DEMANDS more!`,
      `🎉 ENCORE! ENCORE! The chants are deafening!`,
      `They're gone... but surely not for long?`,
      `The roar continues - nobody is leaving!`,
    ];
    return getRandomTemplate(templates);
  } else if (overallRating >= 15) {
    const templates = [
      `The band takes their final bow to thunderous applause!`,
      `What a show! The crowd shows their appreciation!`,
      `An unforgettable performance comes to an end!`,
    ];
    return getRandomTemplate(templates);
  } else {
    const templates = [
      `The band wraps up their set`,
      `Polite applause as the performance ends`,
      `The show comes to a close`,
    ];
    return getRandomTemplate(templates);
  }
}
