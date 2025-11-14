import {
  type NarrativeChoice,
  type NarrativeState,
  type NarrativeStateRecord,
  type NarrativeStory,
} from "./types";

const isRecord = (value: unknown): value is Record<string, boolean> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const createInitialNarrativeState = (story: NarrativeStory): NarrativeState => ({
  storyId: story.id,
  currentNodeId: story.startingNodeId,
  visitedNodeIds: [story.startingNodeId],
  flags: {},
});

export const isChoiceAvailable = (
  choice: NarrativeChoice,
  state: NarrativeState,
): boolean => {
  if (!choice.requiredFlags) {
    return true;
  }

  return Object.entries(choice.requiredFlags).every(([flag, expected]) => {
    const current = state.flags[flag];

    if (expected === true) {
      return current === true;
    }

    if (expected === false) {
      return current !== true;
    }

    return current === expected;
  });
};

export const applyChoiceToState = (
  state: NarrativeState,
  choice: NarrativeChoice,
): NarrativeState => {
  const updatedFlags = { ...state.flags };

  if (choice.setFlags) {
    for (const [flag, value] of Object.entries(choice.setFlags)) {
      updatedFlags[flag] = value;
    }
  }

  if (choice.clearFlags) {
    for (const flag of choice.clearFlags) {
      delete updatedFlags[flag];
    }
  }

  const nextNodeId = choice.targetNodeId;
  const visitedNodeIds = state.visitedNodeIds.includes(nextNodeId)
    ? state.visitedNodeIds
    : [...state.visitedNodeIds, nextNodeId];

  return {
    storyId: state.storyId,
    currentNodeId: nextNodeId,
    visitedNodeIds,
    flags: updatedFlags,
  };
};

export const mergeStateRecord = (
  record: NarrativeStateRecord,
  state: NarrativeState,
): NarrativeStateRecord => ({
  ...record,
  storyId: state.storyId,
  currentNodeId: state.currentNodeId,
  visitedNodeIds: state.visitedNodeIds,
  flags: state.flags,
});

export const parseFlags = (value: unknown): Record<string, boolean> => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, boolean>>((acc, [key, flagValue]) => {
    if (typeof flagValue === "boolean") {
      acc[key] = flagValue;
    }
    return acc;
  }, {});
};
