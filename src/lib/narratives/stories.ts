import type { NarrativeStory } from "./types";

export const narrativeStories: Record<string, NarrativeStory> = {
  "emergent-headliner": {
    id: "emergent-headliner",
    title: "Emergent Headliner",
    summary:
      "Navigate the pivotal night where your band jumps from underground buzz to main-stage notoriety. Balance nerves, relationships, and opportunity to define your legend.",
    themeTags: ["career", "relationships", "live-show"],
    startingNodeId: "backstage-call",
    nodes: {
      "backstage-call": {
        id: "backstage-call",
        title: "Backstage Call",
        description:
          "The promoter calls an hour before showtime: the headliner is delayed. The crowd is restless, the crew anxious.",
        body: [
          "You've been grinding clubs for months, but tonight's festival slot could launch everything. A promoter you barely know offers a one-song teaser to keep the crowd engaged while they stall.",
          "Your drummer is already warming up, your vocalist is pacing, and the crew is whispering about taking the full set if the delay stretches."
        ],
        atmosphere: "The hallway smells of fog fluid and adrenaline.",
        spotlight: "A stage manager named Rhea watches to see if you can carry the main stage.",
        choices: [
          {
            id: "accept-teaser",
            label: "Take the teaser song",
            description: "Play one song to calm the crowd and prove you can own the moment.",
            targetNodeId: "crowd-teaser",
            setFlags: { teaser_played: true },
            resultSummary: "You accept the pressure and sprint toward the stage.",
          },
          {
            id: "hold-back",
            label: "Decline politely",
            description: "Protect your full set and risk annoying the promoter.",
            targetNodeId: "negotiation",
            setFlags: { promoter_annoyed: true },
            resultSummary: "You draw a boundary and the promoter frowns."
          },
          {
            id: "push-for-full",
            label: "Negotiate for the full slot",
            description: "Make the case that the crowd deserves a real show if the headliner can't make it.",
            targetNodeId: "negotiation",
            setFlags: { pushed_for_full: true },
            resultSummary: "You counter with ambition shimmering in every word."
          }
        ],
      },
      "crowd-teaser": {
        id: "crowd-teaser",
        title: "Crowd Teaser",
        description:
          "The lights dim and you launch into your single. The crowd roars, phones rise, and chatter across social blows up instantly.",
        body: [
          "Halfway through the chorus, you spot a well-known streamer going live from the pit. The promoter signals a longer delay backstage.",
          "Your guitarist improvises a solo that wasn't rehearsed, earning a gasp from the crew." 
        ],
        atmosphere: "Stage monitors hum with raw energy.",
        spotlight: "Rhea raises two fingers: can you stretch to a mini-set?",
        choices: [
          {
            id: "stretch-mini",
            label: "Stretch to a mini-set",
            description: "Ride the wave and keep the crowd.",
            targetNodeId: "mini-set",
            setFlags: { earned_stream_buzz: true },
            resultSummary: "You expand the moment into a mini-set and the chat explodes."
          },
          {
            id: "exit-gracefully",
            label: "End with a graceful exit",
            description: "Leave them hungry and respect the headliner.",
            targetNodeId: "negotiation",
            clearFlags: ["promoter_annoyed"],
            setFlags: { respected_headliner: true },
            resultSummary: "You bow out with grace, leaving the crowd chanting your name."
          }
        ],
      },
      negotiation: {
        id: "negotiation",
        title: "Negotiation Backstage",
        description:
          "Back in the hallway, conflicting agendas collide. The promoter checks their watch while the headliner's manager is unreachable.",
        body: [
          "Your band debates whether to seize the full slot. Your vocalist worries about backlash, your drummer is already texting everyone about the opportunity.",
          "Rhea asks for a clear decision before the audience turns hostile." 
        ],
        choices: [
          {
            id: "stay-ready",
            label: "Stay warmed up and ready",
            description: "Prepare for either outcome without burning bridges.",
            targetNodeId: "stage-invite",
            clearFlags: ["promoter_annoyed"],
            setFlags: { levelheaded: true },
            resultSummary: "You project calm confidence while keeping options open."
          },
          {
            id: "issue-ultimatum",
            label: "Issue an ultimatum",
            description: "Force the promoter's hand while tensions climb.",
            targetNodeId: "stage-invite",
            setFlags: { promoter_annoyed: true, band_divided: true },
            resultSummary: "You deliver a sharp demand that leaves the crew whispering."
          }
        ],
      },
      "mini-set": {
        id: "mini-set",
        title: "Mini-Set Takeover",
        description:
          "You command the stage for twenty electric minutes. Social feeds crown you the surprise headliner.",
        body: [
          "The crowd chants your name, and your drummer breaks into tears mid-song. By the finale, the festival director is at the side-stage taking notes.",
          "As you exit, the headliner's tour manager arrives, impressed instead of angry." 
        ],
        atmosphere: "The air crackles with victory.",
        spotlight: "Festival director hands you a card for next year's main slot.",
        endingType: "success",
        choices: [],
      },
      "stage-invite": {
        id: "stage-invite",
        title: "Stage Invite",
        description:
          "Ten minutes later, the promoter rushes over. The headliner is grounded. It's your show now.",
        body: [
          "The crew scrambles to reset the stage. The promoter quietly warns that if the crowd dips, it could backfire.",
          "Rhea pulls you aside: 'Take the stage, but keep the headliner's fans on your side.'"
        ],
        choices: [
          {
            id: "dedicate-song",
            label: "Dedicate a song to the headliner",
            description: "Win goodwill and disarm tension.",
            targetNodeId: "mini-set",
            requiredFlags: { promoter_annoyed: false },
            setFlags: { diplomacy_mastered: true },
            resultSummary: "You open with respect and the crowd roars louder."
          },
          {
            id: "own-the-night",
            label: "Own the night entirely",
            description: "Lean fully into the opportunity without compromise.",
            targetNodeId: "mini-set",
            requiredFlags: { promoter_annoyed: true },
            setFlags: { renegade_reputation: true },
            resultSummary: "You double down on attitude and the legend spreads like wildfire."
          },
          {
            id: "steady-set",
            label: "Deliver a steady, flawless set",
            description: "Focus on execution to silence any doubts.",
            targetNodeId: "mini-set",
            requiredFlags: { promoter_annoyed: false },
            setFlags: { levelheaded: true },
            resultSummary: "You deliver precision and earn the crew's trust forever."
          }
        ],
      },
    },
  },
};

export const getNarrativeStory = (storyId: string | undefined | null): NarrativeStory | undefined => {
  if (!storyId) {
    return undefined;
  }
  return narrativeStories[storyId];
};
