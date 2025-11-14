export type ReputationSentiment = "positive" | "neutral" | "negative";

export type MediaPrTaskStatus = "planning" | "production" | "live" | "completed";
export type MediaPrTaskPriority = "low" | "medium" | "high";

export interface MediaPrTask {
  id: string;
  title: string;
  summary: string;
  status: MediaPrTaskStatus;
  dueDate: string;
  owner: string;
  channel: string;
  priority: MediaPrTaskPriority;
  completion: number;
  reputationImpact: number;
  reachEstimate: number;
  tags: string[];
}

export interface MediaReputationTrendPoint {
  date: string;
  score: number;
  earnedMedia: number;
  sentiment: number;
  notes?: string;
}

export interface MediaReputationEventMetric {
  label: string;
  value: string;
  tone?: ReputationSentiment;
}

export interface MediaReputationEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  channel: string;
  owner: string;
  sentiment: ReputationSentiment;
  delta: number;
  tags: string[];
  metrics: MediaReputationEventMetric[];
  followUp?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mediaPrTasks: MediaPrTask[] = [
  {
    id: "task-1",
    title: "Prime Time Documentary Feature",
    summary: "Coordinate the national documentary premiere with a live acoustic segment and behind-the-scenes teaser drops.",
    status: "production",
    dueDate: "2025-02-10",
    owner: "Morgan Lee",
    channel: "Television",
    priority: "high",
    completion: 68,
    reputationImpact: 6,
    reachEstimate: 3.4,
    tags: ["Longform", "Exclusive", "Storytelling"],
  },
  {
    id: "task-2",
    title: "Podcast Residency Launch",
    summary: "Secure rotating guest lineup and produce pilot episode for six-week residency highlighting album writing process.",
    status: "planning",
    dueDate: "2025-01-27",
    owner: "Priya Chen",
    channel: "Podcast",
    priority: "medium",
    completion: 32,
    reputationImpact: 3,
    reachEstimate: 1.2,
    tags: ["Thought leadership", "Creator partnerships"],
  },
  {
    id: "task-3",
    title: "Regional Press Junket",
    summary: "Activate three-city press run with local influencers and live lounge performances for radio syndication clips.",
    status: "live",
    dueDate: "2025-01-19",
    owner: "Alex Vega",
    channel: "Press",
    priority: "high",
    completion: 82,
    reputationImpact: 5,
    reachEstimate: 2.6,
    tags: ["Tour", "Radio", "Influencers"],
  },
  {
    id: "task-4",
    title: "Crisis Response: Schedule Adjustment",
    summary: "Draft unified messaging and coordinate cross-channel updates for rescheduled arena show following weather delay.",
    status: "production",
    dueDate: "2025-01-12",
    owner: "Jamie Ortiz",
    channel: "Social",
    priority: "high",
    completion: 54,
    reputationImpact: -2,
    reachEstimate: 1.8,
    tags: ["Crisis", "Fan assurance"],
  },
  {
    id: "task-5",
    title: "Behind-the-Scenes Micro-Series",
    summary: "Produce three short-form reels highlighting studio collaborators with coordinated duet posts from featured artists.",
    status: "planning",
    dueDate: "2025-02-02",
    owner: "Morgan Lee",
    channel: "Social",
    priority: "medium",
    completion: 24,
    reputationImpact: 2,
    reachEstimate: 0.9,
    tags: ["Short-form", "Collaboration"],
  },
  {
    id: "task-6",
    title: "Brand Partner Spotlight",
    summary: "Collaborate with eco-fashion sponsor on sustainable tour capsule and secure exclusive coverage with lifestyle outlets.",
    status: "live",
    dueDate: "2025-02-15",
    owner: "Priya Chen",
    channel: "Press",
    priority: "low",
    completion: 46,
    reputationImpact: 4,
    reachEstimate: 1.6,
    tags: ["Partnership", "Sustainability"],
  },
  {
    id: "task-7",
    title: "Fan Advocacy Roundtable",
    summary: "Host moderated town-hall stream with community leaders to highlight charitable impact and invite fan questions.",
    status: "planning",
    dueDate: "2025-01-31",
    owner: "Alex Vega",
    channel: "Streaming",
    priority: "medium",
    completion: 18,
    reputationImpact: 3,
    reachEstimate: 1.1,
    tags: ["Community", "Livestream", "Charity"],
  },
];

const reputationTrend: MediaReputationTrendPoint[] = [
  { date: "2024-11-18", score: 61, earnedMedia: 1.2, sentiment: 0.34, notes: "Fan Q&A week" },
  { date: "2024-11-25", score: 63, earnedMedia: 1.3, sentiment: 0.4, notes: "Documentary teaser" },
  { date: "2024-12-02", score: 66, earnedMedia: 1.5, sentiment: 0.45, notes: "Charity livestream" },
  { date: "2024-12-09", score: 65, earnedMedia: 1.4, sentiment: 0.38, notes: "Venue delay" },
  { date: "2024-12-16", score: 67, earnedMedia: 1.7, sentiment: 0.42, notes: "Holiday press" },
  { date: "2024-12-23", score: 70, earnedMedia: 2.1, sentiment: 0.49, notes: "Award nomination" },
  { date: "2024-12-30", score: 72, earnedMedia: 2.5, sentiment: 0.52, notes: "Year-end recap" },
  { date: "2025-01-06", score: 74, earnedMedia: 2.8, sentiment: 0.56, notes: "Arena announcement" },
];

const reputationEvents: MediaReputationEvent[] = [
  {
    id: "event-1",
    date: "2024-12-29",
    title: "Late-Night Residency Kickoff",
    description:
      "Secured a four-week late-night residency slot featuring weekly performances and candid couch interviews with the host.",
    channel: "Television",
    owner: "Morgan Lee",
    sentiment: "positive",
    delta: 4,
    tags: ["Momentum", "Live audience"],
    metrics: [
      { label: "Live viewers", value: "3.2M", tone: "positive" },
      { label: "Clipped shares", value: "420K", tone: "positive" },
      { label: "Earned reach", value: "+18%", tone: "positive" },
    ],
    followUp: "Package highlight reel for streaming teaser",
  },
  {
    id: "event-2",
    date: "2024-12-20",
    title: "Weather Delay Clarification",
    description:
      "Issued synchronized statements across social, email, and venue partners outlining the plan for the rescheduled arena show.",
    channel: "Social",
    owner: "Jamie Ortiz",
    sentiment: "neutral",
    delta: -1,
    tags: ["Crisis response"],
    metrics: [
      { label: "Fan support tickets", value: "1.1K", tone: "neutral" },
      { label: "Sentiment shift", value: "-4%", tone: "negative" },
    ],
    followUp: "Publish reschedule FAQ and VIP upgrade offer",
  },
  {
    id: "event-3",
    date: "2024-12-11",
    title: "Charity Livestream Recap",
    description:
      "Hosted a 90-minute livestream with beneficiary spotlights, raising funds for youth music programs and driving community buzz.",
    channel: "Streaming",
    owner: "Alex Vega",
    sentiment: "positive",
    delta: 5,
    tags: ["Charity", "Community"],
    metrics: [
      { label: "Donations raised", value: "$185K", tone: "positive" },
      { label: "Average watch time", value: "28m", tone: "positive" },
      { label: "Fan sign-ups", value: "+3.4K", tone: "positive" },
    ],
    followUp: "Repurpose testimonials for earned press pitches",
  },
  {
    id: "event-4",
    date: "2024-12-01",
    title: "Documentary Preview Screening",
    description:
      "Hosted a curated press screening with select critics and superfans, unlocking early reviews and high-sentiment social buzz.",
    channel: "Press",
    owner: "Priya Chen",
    sentiment: "positive",
    delta: 3,
    tags: ["Storytelling", "Press"],
    metrics: [
      { label: "Press score", value: "8.7/10", tone: "positive" },
      { label: "Preview attendees", value: "120", tone: "neutral" },
      { label: "Review pickups", value: "34", tone: "positive" },
    ],
    followUp: "Offer exclusive clips to top-tier outlets",
  },
  {
    id: "event-5",
    date: "2024-11-20",
    title: "Podcast Story Arc Announcement",
    description:
      "Confirmed serialized podcast mini-arc with industry tastemakers exploring the album narrative and touring strategy.",
    channel: "Podcast",
    owner: "Priya Chen",
    sentiment: "positive",
    delta: 2,
    tags: ["Partnership", "Narrative"],
    metrics: [
      { label: "Subscribers uplift", value: "+14%", tone: "positive" },
      { label: "Industry mentions", value: "68", tone: "positive" },
    ],
    followUp: "Coordinate cross-promo with release calendar",
  },
];

const cloneTask = (task: MediaPrTask): MediaPrTask => ({ ...task, tags: [...task.tags] });

const cloneEvent = (event: MediaReputationEvent): MediaReputationEvent => ({
  ...event,
  tags: [...event.tags],
  metrics: event.metrics.map((metric) => ({ ...metric })),
});

export const fetchMediaPrTasks = async (): Promise<MediaPrTask[]> => {
  await delay(120);
  return mediaPrTasks.map(cloneTask);
};

export const fetchMediaReputationTrend = async (): Promise<MediaReputationTrendPoint[]> => {
  await delay(120);
  return reputationTrend.map((point) => ({ ...point }));
};

export const fetchMediaReputationEvents = async (): Promise<MediaReputationEvent[]> => {
  await delay(150);
  return reputationEvents.map(cloneEvent);
};
