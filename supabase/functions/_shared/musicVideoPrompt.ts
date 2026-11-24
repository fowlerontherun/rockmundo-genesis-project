/**
 * Creative direction for the current MiniMax video-01-live image-to-video model.
 * It accepts a single prompt and a first-frame image, not a shot list, soundtrack,
 * camera parameters, or a sequence of independent scenes.
 */

export const VIDEO_THEMES = [
  { value: "cinematic", label: "Cinematic", description: "A dramatic, film-like setting", concept: "A lead performer stands in a dramatic cinematic location" },
  { value: "neon_cyberpunk", label: "Neon Cyberpunk", description: "Futuristic city lights", concept: "A lead performer walks through a rain-slick neon city at night" },
  { value: "vintage_retro", label: "Vintage Retro", description: "Classic analogue film atmosphere", concept: "A lead performer appears on a vintage television-era performance set" },
  { value: "nature_ethereal", label: "Nature Ethereal", description: "Dreamlike natural surroundings", concept: "A lead performer moves through a misty, dreamlike landscape" },
  { value: "urban_gritty", label: "Urban Gritty", description: "Raw street-level realism", concept: "A lead performer moves through a textured city street" },
  { value: "abstract_artistic", label: "Abstract Artistic", description: "Surreal shapes and imagery", concept: "An expressive central figure moves amid sculptural abstract forms" },
  { value: "performance_stage", label: "Performance Stage", description: "Spotlights and live-stage energy", concept: "A lead performer plays on a dramatic concert stage" },
  { value: "animated_stylized", label: "Animated Stylized", description: "Colourful illustrated imagery", concept: "An animated lead performer moves through a stylized illustrated world" },
] as const;

export const VIDEO_ART_STYLES = [
  { value: "realistic", label: "Realistic", prompt: "photorealistic cinematography" },
  { value: "stylized", label: "Stylized", prompt: "deliberately stylized cinematic imagery" },
  { value: "anime", label: "Anime", prompt: "hand-drawn anime-inspired illustration" },
  { value: "watercolor", label: "Watercolor", prompt: "soft watercolor-painted imagery" },
  { value: "comic_book", label: "Comic Book", prompt: "graphic comic-book illustration with strong ink outlines" },
  { value: "noir", label: "Film Noir", prompt: "high-contrast classic film-noir imagery" },
  { value: "vaporwave", label: "Vaporwave", prompt: "retro vaporwave imagery" },
  { value: "minimalist", label: "Minimalist", prompt: "clean, sparse minimalist imagery" },
] as const;

export const VIDEO_MOODS = [
  { value: "auto", label: "AI decides", prompt: "emotion suited to the visual theme" },
  { value: "energetic", label: "Energetic", prompt: "energetic and expressive atmosphere" },
  { value: "melancholic", label: "Melancholic", prompt: "wistful and melancholic atmosphere" },
  { value: "romantic", label: "Romantic", prompt: "romantic and intimate atmosphere" },
  { value: "dark", label: "Dark & Moody", prompt: "dark and foreboding atmosphere" },
  { value: "uplifting", label: "Uplifting", prompt: "optimistic and uplifting atmosphere" },
  { value: "mysterious", label: "Mysterious", prompt: "mysterious and uncanny atmosphere" },
  { value: "aggressive", label: "Aggressive", prompt: "bold and confrontational atmosphere" },
  { value: "peaceful", label: "Peaceful", prompt: "calm and peaceful atmosphere" },
] as const;

export const VIDEO_CAMERA_MOVEMENTS = [
  { value: "auto", label: "AI decides", prompt: "smooth cinematic camera movement" },
  { value: "slow_push", label: "Slow Push-In", prompt: "slow dolly push-in toward the central subject" },
  { value: "tracking", label: "Follow the Performer", prompt: "tracking shot following the central subject" },
  { value: "orbit", label: "Orbit", prompt: "gentle orbiting camera around the central subject" },
  { value: "wide_pan", label: "Wide Pan", prompt: "wide lateral camera pan across the scene" },
  { value: "handheld", label: "Handheld", prompt: "subtle handheld camera movement" },
  { value: "locked", label: "Fixed Camera", prompt: "locked-off camera composition" },
] as const;

export const VIDEO_LIGHTING = [
  { value: "auto", label: "AI decides", prompt: "cinematic lighting" },
  { value: "golden", label: "Golden Hour", prompt: "warm golden-hour lighting" },
  { value: "neon", label: "Neon Glow", prompt: "coloured neon lighting and reflections" },
  { value: "dramatic", label: "Dramatic Contrast", prompt: "strong chiaroscuro lighting and deep shadows" },
  { value: "soft", label: "Soft & Diffused", prompt: "soft diffused lighting" },
  { value: "spotlights", label: "Stage Spotlights", prompt: "theatrical stage spotlights" },
] as const;

export const VIDEO_PALETTES = [
  { value: "auto", label: "AI decides", prompt: "cohesive colour grading" },
  { value: "warm", label: "Warm", prompt: "warm amber and orange colour palette" },
  { value: "cool", label: "Cool", prompt: "cool blue and teal colour palette" },
  { value: "monochrome", label: "Black & White", prompt: "monochrome black-and-white colour palette" },
  { value: "vibrant", label: "Vibrant", prompt: "vivid saturated colour palette" },
  { value: "muted", label: "Muted", prompt: "desaturated muted colour palette" },
] as const;

export const VIDEO_MOTION = [
  { value: "auto", label: "AI decides", prompt: "natural subject movement" },
  { value: "subtle", label: "Subtle", prompt: "subtle slow subject movement" },
  { value: "dynamic", label: "Dynamic", prompt: "dynamic confident subject movement" },
  { value: "intense", label: "High Energy", prompt: "rapid expressive subject movement" },
] as const;

export interface MusicVideoCreativeBrief {
  ai_generated: true;
  visual_theme: string;
  art_style: string;
  mood: string;
  shot_concept: string;
  camera_movement: string;
  lighting: string;
  colour_palette: string;
  subject_motion: string;
}

function option<T extends readonly { value: string }[]>(items: T, value: unknown, fallback: T[number]["value"]): T[number] {
  return items.find((item) => item.value === value) ?? items.find((item) => item.value === fallback)!;
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim().slice(0, maxLength).trim()
    : "";
}

export function normalizeMusicVideoBrief(raw: unknown): MusicVideoCreativeBrief {
  const data = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown> : {};
  const visualTheme = option(VIDEO_THEMES, data.visual_theme, "cinematic");
  // Existing in-flight reservations used a scene_descriptions array. Only the
  // first scene can act as the current model's single-shot concept.
  const oldScene = Array.isArray(data.scene_descriptions)
    ? data.scene_descriptions.find((scene) => typeof scene === "string" && scene.trim()) : undefined;
  return {
    ai_generated: true,
    visual_theme: visualTheme.value,
    art_style: option(VIDEO_ART_STYLES, data.art_style, "realistic").value,
    mood: option(VIDEO_MOODS, data.mood, "auto").value,
    shot_concept: cleanText(data.shot_concept || oldScene, 240) || visualTheme.concept,
    camera_movement: option(VIDEO_CAMERA_MOVEMENTS, data.camera_movement, "auto").value,
    lighting: option(VIDEO_LIGHTING, data.lighting, "auto").value,
    colour_palette: option(VIDEO_PALETTES, data.colour_palette, "auto").value,
    subject_motion: option(VIDEO_MOTION, data.subject_motion, "auto").value,
  };
}

export function buildMusicVideoPrompts(input: {
  songTitle: string;
  songGenre?: string | null;
  brief: unknown;
}): { imagePrompt: string; videoPrompt: string; brief: MusicVideoCreativeBrief } {
  const brief = normalizeMusicVideoBrief(input.brief);
  const theme = option(VIDEO_THEMES, brief.visual_theme, "cinematic");
  const art = option(VIDEO_ART_STYLES, brief.art_style, "realistic");
  const mood = option(VIDEO_MOODS, brief.mood, "auto");
  const lighting = option(VIDEO_LIGHTING, brief.lighting, "auto");
  const palette = option(VIDEO_PALETTES, brief.colour_palette, "auto");
  const camera = option(VIDEO_CAMERA_MOVEMENTS, brief.camera_movement, "auto");
  const motion = option(VIDEO_MOTION, brief.subject_motion, "auto");
  const title = cleanText(input.songTitle, 160) || "Untitled song";
  const genre = cleanText(input.songGenre, 60);
  const context = `Music video for "${title}"${genre ? `, ${genre} genre` : ""}. ${theme.description}.`;
  const look = `${art.prompt}. ${mood.prompt}. ${lighting.prompt}. ${palette.prompt}.`;
  const imagePrompt = `${context} Single 16:9 establishing frame: ${brief.shot_concept}. ${look} Clear central subject, coherent setting, no text, logos or watermarks.`;
  const videoPrompt = `${context} Single continuous short music-video shot: ${brief.shot_concept}. ${look} ${camera.prompt}. ${motion.prompt}. Keep the main subject and visual style consistent throughout the shot. No cuts, text, logos or watermarks.`;
  return { imagePrompt, videoPrompt, brief };
}
