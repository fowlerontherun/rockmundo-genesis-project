export const RECORDING_STAGE_ORDER = ["recording", "mixing", "mastering"] as const;

export const RECORDING_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type RecordingStage = (typeof RECORDING_STAGE_ORDER)[number];
export type RecordingStatus = (typeof RECORDING_STATUSES)[number];

export type RecordingWorkflowStageProgress = "pending" | "active" | "completed" | "blocked";
export type RecordingWorkflowTaskStatus = "pending" | "in_progress" | "completed" | "blocked";
export type RecordingWorkflowCollaboratorStatus = "upcoming" | "active" | "completed" | "blocked";

export interface RecordingWorkflowTaskDefinition {
  id: string;
  title: string;
  description: string;
}

export interface RecordingWorkflowCollaboratorDefinition {
  id: string;
  role: string;
  summary: string;
  responsibilities: string[];
}

export interface RecordingStageDefinition {
  key: RecordingStage;
  label: string;
  description: string;
  focus: string;
  tasks: RecordingWorkflowTaskDefinition[];
  collaborators: RecordingWorkflowCollaboratorDefinition[];
  nextStage?: RecordingStage | null;
}

export interface RecordingWorkflowTaskState extends RecordingWorkflowTaskDefinition {
  status: RecordingWorkflowTaskStatus;
}

export interface RecordingWorkflowCollaboratorState extends RecordingWorkflowCollaboratorDefinition {
  status: RecordingWorkflowCollaboratorStatus;
}

export interface RecordingWorkflowStageState extends RecordingStageDefinition {
  progress: RecordingWorkflowStageProgress;
  tasks: RecordingWorkflowTaskState[];
  collaborators: RecordingWorkflowCollaboratorState[];
}

const baseDefinitions: Record<RecordingStage, RecordingStageDefinition> = {
  recording: {
    key: "recording",
    label: "Tracking",
    description: "Capture the raw performances and critical takes for the record.",
    focus: "Session setup, sound capture, and performance direction.",
    tasks: [
      {
        id: "session-prep",
        title: "Prep & Signal Check",
        description: "Finalize arrangements, build the session template, and line check every input.",
      },
      {
        id: "instrument-tracking",
        title: "Instrument Tracking",
        description: "Track rhythm section, overdubs, and comp the best performances.",
      },
      {
        id: "vocal-production",
        title: "Vocal Production",
        description: "Capture lead and background vocals, edit takes, and align doubles.",
      },
      {
        id: "take-management",
        title: "Take Management",
        description: "Organize takes, log notes for mixing, and export session archives.",
      },
    ],
    collaborators: [
      {
        id: "producer",
        role: "Producer",
        summary: "Guides the artistic vision and keeps the sessions on schedule.",
        responsibilities: [
          "Define sonic direction and reference tracks",
          "Approve takes and performance edits",
          "Coordinate daily studio schedule",
        ],
      },
      {
        id: "engineer",
        role: "Recording Engineer",
        summary: "Owns the technical capture of every instrument and vocal.",
        responsibilities: [
          "Design mic setups and manage the console",
          "Ensure clean signal flow and handle live problem solving",
          "Document session routing and recall notes",
        ],
      },
      {
        id: "session-musicians",
        role: "Session Musicians",
        summary: "Deliver live performances and overdubs as directed.",
        responsibilities: [
          "Interpret arrangements and charts accurately",
          "Provide alternate takes when requested",
          "Collaborate on creative embellishments",
        ],
      },
    ],
    nextStage: "mixing",
  },
  mixing: {
    key: "mixing",
    label: "Mixing",
    description: "Balance, enhance, and create the final stereo presentation of the song.",
    focus: "Sonic balance, dynamics processing, and creative effects.",
    tasks: [
      {
        id: "session-organization",
        title: "Session Organization",
        description: "Clean up tracks, route buses, and set gain staging for mixdown.",
      },
      {
        id: "balance-processing",
        title: "Balancing & Processing",
        description: "Apply EQ, compression, and automation to carve the sound stage.",
      },
      {
        id: "creative-effects",
        title: "Creative Effects",
        description: "Design reverbs, delays, and special effects that enhance the story.",
      },
      {
        id: "mix-approvals",
        title: "Mix Approvals",
        description: "Print mix revisions, gather feedback, and deliver the final mix print.",
      },
    ],
    collaborators: [
      {
        id: "mix-engineer",
        role: "Mix Engineer",
        summary: "Shapes the sonic balance and ensures translation on every system.",
        responsibilities: [
          "Craft tonal balance and automation moves",
          "Blend creative effects with clarity and intention",
          "Version and archive each mix iteration",
        ],
      },
      {
        id: "assistant",
        role: "Mix Assistant",
        summary: "Preps sessions, manages stems, and implements revision notes.",
        responsibilities: [
          "Organize track groups and color coding",
          "Bounce stems and alternate versions",
          "Track client feedback and ensure delivery",
        ],
      },
      {
        id: "band-rep",
        role: "Artist Representative",
        summary: "Collects band feedback and signs off on creative choices.",
        responsibilities: [
          "Gather notes from the band and stakeholders",
          "Prioritize revisions for the mix engineer",
          "Confirm approval for mastering handoff",
        ],
      },
    ],
    nextStage: "mastering",
  },
  mastering: {
    key: "mastering",
    label: "Mastering",
    description: "Finalize loudness, sequencing, and deliverables for distribution.",
    focus: "Final polish, translation, and asset delivery.",
    tasks: [
      {
        id: "reference-evaluation",
        title: "Reference Evaluation",
        description: "Review approved mixes against references and delivery specs.",
      },
      {
        id: "final-processing",
        title: "Final Processing",
        description: "Apply limiting, stereo imaging, and quality control checks.",
      },
      {
        id: "sequencing",
        title: "Sequencing & Metadata",
        description: "Finalize track order, spacing, and embed ISRC / UPC metadata.",
      },
      {
        id: "master-delivery",
        title: "Delivery & Archival",
        description: "Export master formats, QC deliverables, and archive the project.",
      },
    ],
    collaborators: [
      {
        id: "mastering-engineer",
        role: "Mastering Engineer",
        summary: "Ensures commercial loudness and cross-platform translation.",
        responsibilities: [
          "Audition mixes and confirm technical compliance",
          "Optimize tonal balance and loudness",
          "Prepare release-ready assets (WAV, DDP, MP3)",
        ],
      },
      {
        id: "label-liaison",
        role: "Label / Manager Liaison",
        summary: "Coordinates release requirements and quality checks.",
        responsibilities: [
          "Confirm metadata accuracy and credits",
          "Request alternate masters when needed",
          "Upload final packages to distribution partners",
        ],
      },
      {
        id: "archivist",
        role: "Archivist",
        summary: "Maintains long-term backups and documentation of the project.",
        responsibilities: [
          "Label and store project archives",
          "Document session settings and recalls",
          "Manage catalog delivery confirmations",
        ],
      },
    ],
    nextStage: null,
  },
};

export const recordingStatusTransitions: Record<RecordingStatus, RecordingStatus[]> = {
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const recordingStageTransitions: Record<RecordingStage, RecordingStage | null> = {
  recording: "mixing",
  mixing: "mastering",
  mastering: null,
};

export const recordingStatusLabels: Record<RecordingStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function ensureRecordingStage(stage?: string | null): RecordingStage {
  const fallback: RecordingStage = "recording";
  if (!stage) return fallback;
  return (RECORDING_STAGE_ORDER as readonly string[]).includes(stage)
    ? (stage as RecordingStage)
    : fallback;
}

export function ensureRecordingStatus(status?: string | null): RecordingStatus {
  const fallback: RecordingStatus = "scheduled";
  if (!status) return fallback;
  return (RECORDING_STATUSES as readonly string[]).includes(status)
    ? (status as RecordingStatus)
    : fallback;
}

export function getRecordingStageDefinition(stage: RecordingStage): RecordingStageDefinition {
  return baseDefinitions[stage];
}

export function getRecordingWorkflowStages(): RecordingStageDefinition[] {
  return RECORDING_STAGE_ORDER.map(stage => baseDefinitions[stage]);
}

export function getRecordingStatusTransitions(status: RecordingStatus): RecordingStatus[] {
  return recordingStatusTransitions[status];
}

function resolveStageProgress(
  stage: RecordingStage,
  currentStage: RecordingStage,
  status: RecordingStatus
): RecordingWorkflowStageProgress {
  if (status === "cancelled") {
    return "blocked";
  }

  if (status === "completed") {
    return "completed";
  }

  const stageIndex = RECORDING_STAGE_ORDER.indexOf(stage);
  const currentIndex = RECORDING_STAGE_ORDER.indexOf(currentStage);

  if (stageIndex < currentIndex) {
    return "completed";
  }

  if (stageIndex === currentIndex) {
    return status === "in_progress" ? "active" : "pending";
  }

  return "pending";
}

function mapTaskStatus(
  progress: RecordingWorkflowStageProgress,
  taskIndex: number
): RecordingWorkflowTaskStatus {
  switch (progress) {
    case "completed":
      return "completed";
    case "active":
      return taskIndex === 0 ? "in_progress" : "pending";
    case "blocked":
      return "blocked";
    default:
      return "pending";
  }
}

function mapCollaboratorStatus(
  progress: RecordingWorkflowStageProgress
): RecordingWorkflowCollaboratorStatus {
  switch (progress) {
    case "completed":
      return "completed";
    case "active":
      return "active";
    case "blocked":
      return "blocked";
    default:
      return "upcoming";
  }
}

export function getRecordingWorkflowState(
  rawStage?: string | null,
  rawStatus?: string | null
): RecordingWorkflowStageState[] {
  const currentStage = ensureRecordingStage(rawStage);
  const status = ensureRecordingStatus(rawStatus);

  return getRecordingWorkflowStages().map(stageDefinition => {
    const progress = resolveStageProgress(stageDefinition.key, currentStage, status);
    const tasks = stageDefinition.tasks.map((task, index) => ({
      ...task,
      status: status === "completed" ? "completed" : mapTaskStatus(progress, index),
    }));

    const collaborators = stageDefinition.collaborators.map(collaborator => ({
      ...collaborator,
      status: status === "completed" ? "completed" : mapCollaboratorStatus(progress),
    }));

    return {
      ...stageDefinition,
      progress,
      tasks,
      collaborators,
    };
  });
}

export function isValidStatusTransition(
  current: RecordingStatus,
  next: RecordingStatus
): boolean {
  return recordingStatusTransitions[current].includes(next);
}

export function getNextStage(stage: RecordingStage): RecordingStage | null {
  return recordingStageTransitions[stage];
}

export function hasRemainingStages(stage?: string | null): boolean {
  const currentStage = ensureRecordingStage(stage);
  return recordingStageTransitions[currentStage] !== null;
}
