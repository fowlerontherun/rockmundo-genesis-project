export type NarrativeFlagMap = Record<string, boolean>;

export interface NarrativeChoice {
  id: string;
  label: string;
  targetNodeId: string;
  description?: string;
  resultSummary?: string;
  requiredFlags?: NarrativeFlagMap;
  setFlags?: NarrativeFlagMap;
  clearFlags?: string[];
}

export interface NarrativeNode {
  id: string;
  title: string;
  description: string;
  body: string[];
  atmosphere?: string;
  spotlight?: string;
  choices: NarrativeChoice[];
  endingType?: "success" | "failure" | "neutral";
}

export interface NarrativeStory {
  id: string;
  title: string;
  summary: string;
  themeTags: string[];
  startingNodeId: string;
  nodes: Record<string, NarrativeNode>;
}

export interface NarrativeState {
  storyId: string;
  currentNodeId: string;
  visitedNodeIds: string[];
  flags: NarrativeFlagMap;
}

export interface NarrativeStateRecord extends NarrativeState {
  id: string;
  profileId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}
