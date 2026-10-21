/**
 * The same media outlet is always assigned the same presenter.
 * Client-side roster: no DB migration or random reassignment per interview.
 */
export type InterviewerMood = "curious" | "warm" | "impressed" | "challenging" | "amused" | "awkward";

export interface InterviewPresenter {
  id: string;
  name: string;
  role: string;
  mediaType: string;
  introduction: string;
  farewell: string;
  personality: "warm" | "direct" | "playful";
  appearance: {
    skin: string;
    hair: string;
    jacket: string;
    accent: string;
    hairstyle: "short" | "waves" | "long" | "swept";
    glasses?: boolean;
    beard?: boolean;
  };
}

const presenters: Record<string, InterviewPresenter[]> = {
  tv: [
    { id: "tv-morgan", name: "Morgan Vale", role: "Music TV host", mediaType: "tv", personality: "direct", introduction: "The cameras are rolling. Ready to make a headline?", farewell: "That's our show. Thanks for joining us.", appearance: { skin: "#b97655", hair: "#26202d", jacket: "#422b77", accent: "#e99f53", hairstyle: "short" } },
    { id: "tv-zara", name: "Zara Knight", role: "Late-night presenter", mediaType: "tv", personality: "playful", introduction: "Welcome to the studio! Give us something to talk about.", farewell: "What a conversation. See you after the break!", appearance: { skin: "#d29a76", hair: "#17151f", jacket: "#ac356b", accent: "#f7c451", hairstyle: "waves" } },
  ],
  radio: [
    { id: "radio-maya", name: "Maya Brooks", role: "Radio DJ", mediaType: "radio", personality: "warm", introduction: "You're on air. Make yourself comfortable!", farewell: "Thanks for hanging out with us on air.", appearance: { skin: "#8f513c", hair: "#1b1621", jacket: "#176a73", accent: "#f6bf5c", hairstyle: "waves" } },
    { id: "radio-elliot", name: "Elliot Reed", role: "Breakfast radio host", mediaType: "radio", personality: "playful", introduction: "Microphones on, coffee in hand. Here we go.", farewell: "That's a wrap! Back to the music.", appearance: { skin: "#edb58d", hair: "#663b2e", jacket: "#344a89", accent: "#e17b5f", hairstyle: "swept", glasses: true } },
  ],
  podcast: [
    { id: "podcast-asha", name: "Asha Verma", role: "Music podcast host", mediaType: "podcast", personality: "warm", introduction: "No rush; I want to hear the story behind the music.", farewell: "Great stories today. Thanks for being here.", appearance: { skin: "#af7350", hair: "#231b26", jacket: "#87486a", accent: "#c7a7ea", hairstyle: "long" } },
    { id: "podcast-theo", name: "Theo Finch", role: "Long-form interviewer", mediaType: "podcast", personality: "direct", introduction: "Let's get past the headlines and into the details.", farewell: "We'll leave it there. Really appreciate the conversation.", appearance: { skin: "#f1c5a1", hair: "#654d35", jacket: "#39645b", accent: "#8ad3bb", hairstyle: "short", beard: true } },
  ],
  magazine: [
    { id: "magazine-celeste", name: "Celeste Hart", role: "Features editor", mediaType: "magazine", personality: "direct", introduction: "Let's get the real story behind your latest chapter.", farewell: "That's everything I need for the feature. Thank you.", appearance: { skin: "#cf9074", hair: "#5b2a29", jacket: "#68449b", accent: "#f0b4b6", hairstyle: "long", glasses: true } },
    { id: "magazine-inez", name: "Inez Park", role: "Culture journalist", mediaType: "magazine", personality: "warm", introduction: "Tell me what the audience doesn't usually see.", farewell: "A fascinating conversation. I can't wait to write this up.", appearance: { skin: "#e6b394", hair: "#20222c", jacket: "#316a72", accent: "#e9be60", hairstyle: "swept" } },
  ],
  newspaper: [
    { id: "newspaper-martin", name: "Martin Cole", role: "Music correspondent", mediaType: "newspaper", personality: "direct", introduction: "Let's start with what matters to your fans.", farewell: "Thank you. We'll make sure we quote you accurately.", appearance: { skin: "#c58b6f", hair: "#605950", jacket: "#35445d", accent: "#d1bda0", hairstyle: "short", glasses: true, beard: true } },
    { id: "newspaper-leila", name: "Leila Moss", role: "Arts reporter", mediaType: "newspaper", personality: "warm", introduction: "I've got a few questions about the music and the people making it.", farewell: "That's the interview. Thanks for your time.", appearance: { skin: "#8a5946", hair: "#251b21", jacket: "#6a547b", accent: "#e9b981", hairstyle: "waves" } },
  ],
  internet: [
    { id: "internet-kai", name: "Kai Rivers", role: "Online music creator", mediaType: "internet", personality: "playful", introduction: "We're live online. The chat is ready for you!", farewell: "The chat loved that. Catch you on the next stream!", appearance: { skin: "#c48763", hair: "#1d3140", jacket: "#5456a7", accent: "#6ae6dc", hairstyle: "swept" } },
    { id: "internet-roxy", name: "Roxy Quinn", role: "Streaming interviewer", mediaType: "internet", personality: "playful", introduction: "The stream is live. Let's make this interesting!", farewell: "Thanks for dropping in. We'll see the viewers next time!", appearance: { skin: "#e2a986", hair: "#8c426f", jacket: "#2c667f", accent: "#ef7cae", hairstyle: "long" } },
  ],
  film: [
    { id: "film-nadia", name: "Nadia Sterling", role: "Documentary interviewer", mediaType: "film", personality: "warm", introduction: "Forget the camera. Tell me what really happened.", farewell: "Beautiful. That's a scene we can use.", appearance: { skin: "#aa755f", hair: "#1e2129", jacket: "#865d45", accent: "#d9c493", hairstyle: "waves" } },
    { id: "film-rowan", name: "Rowan Pike", role: "Music documentary director", mediaType: "film", personality: "direct", introduction: "Camera rolling. Let's get beyond the surface.", farewell: "Cut. That's the end of our conversation.", appearance: { skin: "#d5a081", hair: "#4e372c", jacket: "#3f647c", accent: "#eeab67", hairstyle: "short", beard: true } },
  ],
};

export const stablePresenterHash = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const getInterviewPresenter = (mediaType: string, outletName: string): InterviewPresenter => {
  const kind = mediaType.toLowerCase().trim();
  const pool = presenters[kind] || presenters.podcast;
  // Outlet alone is the identity anchor. Different shows at the same outlet
  // keep the same host across reloads, players and repeated invitations.
  const outlet = outletName.trim().toLowerCase().replace(/\s+/g, " ") || "unknown outlet";
  return pool[stablePresenterHash(`${kind}:${outlet}`) % pool.length];
};

export const getInterviewerResponse = (
  presenter: InterviewPresenter,
  questionId: string,
  option: "a" | "b" | "c" | "d",
  timedOut: boolean,
): { text: string; mood: InterviewerMood } => {
  if (timedOut) return { text: "The clock caught you there. We should keep going.", mood: "awkward" };
  const responses: Record<typeof option, [InterviewerMood, string[]]> = {
    a: ["warm", ["I can hear the conviction in that.", "That's an answer from the heart.", "I appreciate the sincerity.", "That clearly means something to you."]],
    b: ["curious", ["You've thought that through.", "A considered answer. Interesting.", "That sounds like a carefully made choice.", "There's a lot of thought behind that."]],
    c: ["challenging", ["You're not afraid to take a stand!", "That's certainly a bold position.", "I can see that causing a debate.", "You're giving me a headline there!"]],
    d: ["amused", ["Well, that's one way of seeing it.", "You've surprised me there.", "That is an answer I wasn't expecting.", "I suspect our audience will have thoughts on that."]],
  };
  const [mood, lines] = responses[option];
  const offset = presenter.personality === "playful" ? 1 : presenter.personality === "direct" ? 2 : 0;
  const index = (stablePresenterHash(questionId + option + presenter.id) + offset) % lines.length;
  return { text: lines[index], mood };
};
