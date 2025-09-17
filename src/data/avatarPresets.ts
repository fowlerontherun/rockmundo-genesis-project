export type Vector3Tuple = [number, number, number];

export type AvatarStyleDefinition = {
  id: string;
  label: string;
  description: string;
  gradient: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    emissive: string;
  };
  material: {
    metalness: number;
    roughness: number;
  };
  geometry: {
    body: {
      type: "capsule" | "cylinder" | "gem";
      scale: Vector3Tuple;
    };
    head: {
      radius: number;
      offsetY: number;
    };
    accessory?: {
      type: "visor" | "crown" | "orb";
      scale: Vector3Tuple;
      offset: Vector3Tuple;
      rotation?: Vector3Tuple;
    };
  };
  floorColor: string;
};

export type AvatarPoseDefinition = {
  id: string;
  label: string;
  description: string;
  rotation: Vector3Tuple;
  swayAmplitude: number;
  bobAmplitude: number;
  bobOffset: number;
  headTilt: Vector3Tuple;
};

export type AvatarCameraDefinition = {
  id: string;
  label: string;
  description: string;
  position: Vector3Tuple;
  target: Vector3Tuple;
  fov: number;
};

export type AvatarSelection = {
  styleId: string;
  poseId: string;
  cameraId: string;
};

export const avatarStyles: AvatarStyleDefinition[] = [
  {
    id: "micah",
    label: "Neon Rebel",
    description: "Bold colors and sharp angles for artists who electrify every stage.",
    gradient: "from-purple-500/80 via-pink-500/70 to-orange-500/60",
    palette: {
      primary: "#f43f5e",
      secondary: "#4c1d95",
      accent: "#22d3ee",
      emissive: "#fde047",
    },
    material: {
      metalness: 0.45,
      roughness: 0.35,
    },
    geometry: {
      body: {
        type: "capsule",
        scale: [1, 1.6, 1],
      },
      head: {
        radius: 0.52,
        offsetY: 1.25,
      },
      accessory: {
        type: "visor",
        scale: [1.08, 0.45, 1.08],
        offset: [0, 1.15, 0.12],
        rotation: [0.1, 0, 0],
      },
    },
    floorColor: "#c026d3",
  },
  {
    id: "adventurer",
    label: "Retro Virtuoso",
    description: "Vintage flair with modern swagger for timeless performers.",
    gradient: "from-blue-500/80 via-cyan-500/70 to-teal-500/60",
    palette: {
      primary: "#38bdf8",
      secondary: "#0f172a",
      accent: "#f97316",
      emissive: "#facc15",
    },
    material: {
      metalness: 0.25,
      roughness: 0.55,
    },
    geometry: {
      body: {
        type: "cylinder",
        scale: [1.05, 1.5, 1.05],
      },
      head: {
        radius: 0.48,
        offsetY: 1.2,
      },
      accessory: {
        type: "crown",
        scale: [1.2, 0.15, 1.2],
        offset: [0, 1.5, 0],
        rotation: [0, 0, 0],
      },
    },
    floorColor: "#0ea5e9",
  },
  {
    id: "lorelei",
    label: "Synthwave Dreamer",
    description: "A cosmic glow inspired by neon cities and midnight studio sessions.",
    gradient: "from-amber-400/80 via-rose-400/70 to-fuchsia-500/60",
    palette: {
      primary: "#f472b6",
      secondary: "#1e1b4b",
      accent: "#a855f7",
      emissive: "#f9a8d4",
    },
    material: {
      metalness: 0.3,
      roughness: 0.4,
    },
    geometry: {
      body: {
        type: "gem",
        scale: [1.1, 1.4, 1.1],
      },
      head: {
        radius: 0.46,
        offsetY: 1.22,
      },
      accessory: {
        type: "orb",
        scale: [0.3, 0.3, 0.3],
        offset: [0.75, 1.1, 0],
        rotation: [0, 0, 0],
      },
    },
    floorColor: "#db2777",
  },
];

export const avatarPoses: AvatarPoseDefinition[] = [
  {
    id: "stage-ready",
    label: "Stage Ready",
    description: "Confident stance with a subtle forward lean.",
    rotation: [0.05, 0.35, 0],
    swayAmplitude: 0.12,
    bobAmplitude: 0.04,
    bobOffset: 0.08,
    headTilt: [0, -0.2, 0],
  },
  {
    id: "power-chord",
    label: "Power Chord",
    description: "Dynamic twist like you're about to drop a riff.",
    rotation: [-0.03, -0.5, 0.12],
    swayAmplitude: 0.16,
    bobAmplitude: 0.06,
    bobOffset: 0.12,
    headTilt: [0.08, 0.18, 0],
  },
  {
    id: "midnight-groove",
    label: "Midnight Groove",
    description: "Relaxed sway made for late-night sessions.",
    rotation: [0.12, 0.15, -0.08],
    swayAmplitude: 0.08,
    bobAmplitude: 0.05,
    bobOffset: 0.05,
    headTilt: [-0.12, -0.05, 0.08],
  },
];

export const avatarCameras: AvatarCameraDefinition[] = [
  {
    id: "center-stage",
    label: "Center Stage",
    description: "Balanced framing that highlights your whole look.",
    position: [0, 1.4, 3.3],
    target: [0, 1.1, 0],
    fov: 35,
  },
  {
    id: "spotlight",
    label: "Spotlight",
    description: "Closer portrait with a dramatic tilt.",
    position: [-0.6, 1.55, 2.6],
    target: [0, 1.15, 0],
    fov: 32,
  },
  {
    id: "crowd-perspective",
    label: "Crowd Perspective",
    description: "Low angle like a fan in the front row.",
    position: [0.3, 0.95, 2.9],
    target: [0, 1.05, 0],
    fov: 40,
  },
];

export const defaultAvatarSelection: AvatarSelection = {
  styleId: avatarStyles[0]?.id ?? "micah",
  poseId: avatarPoses[0]?.id ?? "stage-ready",
  cameraId: avatarCameras[0]?.id ?? "center-stage",
};
