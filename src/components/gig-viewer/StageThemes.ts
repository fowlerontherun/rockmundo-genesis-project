/**
 * Venue-themed stage visual configurations
 * Maps venue_type to distinct visual themes for the top-down gig viewer
 */

export interface StageThemeConfig {
  id: string;
  label: string;
  // Floor
  floorGradient: string;
  floorPattern?: string;
  floorPatternOpacity: number;
  // Back wall / backdrop
  backdropGradient: string;
  backdropPattern?: string;
  // Side walls / curtains
  sideWallColor: string;
  sideWallBorder: string;
  curtainStyle: 'fabric' | 'brick' | 'metal' | 'open' | 'none';
  // Stage edge
  stageEdgeGradient: string;
  stageEdgeHeight: string;
  // Ambient glow
  ambientGlowColor: string;
  ambientGlowOpacity: number;
  // Sizing
  stageDepthPercent: number; // how much of the stage area is "floor" vs backdrop
  // Equipment scaling
  equipmentScale: 'minimal' | 'standard' | 'large' | 'massive';
  // Lighting count
  spotlightCount: number;
  hasMovingHeads: boolean;
  hasLasers: boolean;
  hasLedStrips: boolean;
  // Decorative elements
  hasCurtains: boolean;
  hasMonitors: boolean;
  hasFogMachine: boolean;
  // Crowd features
  hasBarrier: boolean;
  hasPhotoPit: boolean;
  hasVipSection: boolean;
  hasSoundDesk: boolean;
  hasMerchBooth: boolean;
  hasBarArea: boolean;
  securityGuards: number;
}

export const STAGE_THEMES: Record<string, StageThemeConfig> = {
  bar: {
    id: 'bar',
    label: 'Bar / Pub',
    floorGradient: 'linear-gradient(180deg, hsl(30, 30%, 18%) 0%, hsl(25, 35%, 12%) 100%)',
    floorPattern: 'repeating-linear-gradient(90deg, transparent, transparent 22px, rgba(255,200,100,0.04) 22px, rgba(255,200,100,0.04) 24px)',
    floorPatternOpacity: 0.4,
    backdropGradient: 'linear-gradient(180deg, hsl(15, 40%, 15%) 0%, hsl(10, 35%, 10%) 100%)',
    backdropPattern: 'repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(180,100,60,0.06) 8px, rgba(180,100,60,0.06) 10px), repeating-linear-gradient(90deg, transparent, transparent 16px, rgba(180,100,60,0.04) 16px, rgba(180,100,60,0.04) 18px)',
    sideWallColor: 'hsl(15, 30%, 12%)',
    sideWallBorder: '1px solid hsl(15, 20%, 18%)',
    curtainStyle: 'brick',
    stageEdgeGradient: 'linear-gradient(90deg, hsl(35, 40%, 25%), hsl(30, 45%, 35%), hsl(35, 40%, 25%))',
    stageEdgeHeight: '3px',
    ambientGlowColor: 'hsl(35, 80%, 50%)',
    ambientGlowOpacity: 0.12,
    stageDepthPercent: 75,
    equipmentScale: 'minimal',
    spotlightCount: 2,
    hasMovingHeads: false,
    hasLasers: false,
    hasLedStrips: false,
    hasCurtains: false,
    hasMonitors: false,
    hasFogMachine: false,
    hasBarrier: false,
    hasPhotoPit: false,
    hasVipSection: false,
    hasSoundDesk: false,
    hasMerchBooth: false,
    hasBarArea: true,
    securityGuards: 0,
  },

  indie_venue: {
    id: 'indie_venue',
    label: 'Indie Venue',
    floorGradient: 'linear-gradient(180deg, hsl(0, 0%, 15%) 0%, hsl(0, 0%, 10%) 100%)',
    floorPattern: 'repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.03) 20px, rgba(255,255,255,0.03) 22px)',
    floorPatternOpacity: 0.3,
    backdropGradient: 'linear-gradient(180deg, hsl(270, 15%, 12%) 0%, hsl(260, 20%, 8%) 100%)',
    sideWallColor: 'hsl(260, 10%, 10%)',
    sideWallBorder: '1px solid hsl(260, 15%, 15%)',
    curtainStyle: 'fabric',
    stageEdgeGradient: 'linear-gradient(90deg, hsl(0, 0%, 20%), hsl(0, 0%, 30%), hsl(0, 0%, 20%))',
    stageEdgeHeight: '4px',
    ambientGlowColor: 'hsl(270, 60%, 50%)',
    ambientGlowOpacity: 0.1,
    stageDepthPercent: 72,
    equipmentScale: 'standard',
    spotlightCount: 3,
    hasMovingHeads: false,
    hasLasers: false,
    hasLedStrips: true,
    hasCurtains: true,
    hasMonitors: true,
    hasFogMachine: false,
    hasBarrier: false,
    hasPhotoPit: false,
    hasVipSection: false,
    hasSoundDesk: true,
    hasMerchBooth: true,
    hasBarArea: true,
    securityGuards: 0,
  },

  rock_club: {
    id: 'rock_club',
    label: 'Rock Club',
    floorGradient: 'linear-gradient(180deg, hsl(0, 5%, 14%) 0%, hsl(0, 5%, 8%) 100%)',
    floorPattern: 'repeating-linear-gradient(90deg, transparent, transparent 16px, rgba(255,50,50,0.03) 16px, rgba(255,50,50,0.03) 18px)',
    floorPatternOpacity: 0.35,
    backdropGradient: 'linear-gradient(180deg, hsl(0, 20%, 10%) 0%, hsl(0, 15%, 6%) 100%)',
    backdropPattern: 'repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(200,50,50,0.05) 6px, rgba(200,50,50,0.05) 8px)',
    sideWallColor: 'hsl(0, 10%, 8%)',
    sideWallBorder: '1px solid hsl(0, 15%, 14%)',
    curtainStyle: 'metal',
    stageEdgeGradient: 'linear-gradient(90deg, hsl(0, 40%, 25%), hsl(0, 50%, 35%), hsl(0, 40%, 25%))',
    stageEdgeHeight: '4px',
    ambientGlowColor: 'hsl(0, 70%, 45%)',
    ambientGlowOpacity: 0.15,
    stageDepthPercent: 70,
    equipmentScale: 'standard',
    spotlightCount: 4,
    hasMovingHeads: false,
    hasLasers: false,
    hasLedStrips: true,
    hasCurtains: true,
    hasMonitors: true,
    hasFogMachine: true,
    hasBarrier: true,
    hasPhotoPit: false,
    hasVipSection: false,
    hasSoundDesk: true,
    hasMerchBooth: true,
    hasBarArea: true,
    securityGuards: 1,
  },

  concert_hall: {
    id: 'concert_hall',
    label: 'Concert Hall',
    floorGradient: 'linear-gradient(180deg, hsl(25, 35%, 22%) 0%, hsl(20, 30%, 15%) 100%)',
    floorPattern: 'repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(255,220,160,0.05) 24px, rgba(255,220,160,0.05) 26px)',
    floorPatternOpacity: 0.3,
    backdropGradient: 'linear-gradient(180deg, hsl(0, 50%, 18%) 0%, hsl(0, 40%, 10%) 100%)',
    sideWallColor: 'hsl(0, 40%, 14%)',
    sideWallBorder: '2px solid hsl(40, 50%, 25%)',
    curtainStyle: 'fabric',
    stageEdgeGradient: 'linear-gradient(90deg, hsl(40, 60%, 30%), hsl(45, 70%, 45%), hsl(40, 60%, 30%))',
    stageEdgeHeight: '5px',
    ambientGlowColor: 'hsl(40, 70%, 50%)',
    ambientGlowOpacity: 0.12,
    stageDepthPercent: 68,
    equipmentScale: 'large',
    spotlightCount: 6,
    hasMovingHeads: true,
    hasLasers: false,
    hasLedStrips: true,
    hasCurtains: true,
    hasMonitors: true,
    hasFogMachine: true,
    hasBarrier: true,
    hasPhotoPit: true,
    hasVipSection: true,
    hasSoundDesk: true,
    hasMerchBooth: true,
    hasBarArea: true,
    securityGuards: 2,
  },

  arena: {
    id: 'arena',
    label: 'Arena',
    floorGradient: 'linear-gradient(180deg, hsl(220, 10%, 10%) 0%, hsl(220, 15%, 5%) 100%)',
    floorPattern: 'repeating-linear-gradient(90deg, transparent, transparent 14px, rgba(100,150,255,0.03) 14px, rgba(100,150,255,0.03) 16px), repeating-linear-gradient(0deg, transparent, transparent 14px, rgba(100,150,255,0.02) 14px, rgba(100,150,255,0.02) 16px)',
    floorPatternOpacity: 0.25,
    backdropGradient: 'linear-gradient(180deg, hsl(240, 20%, 8%) 0%, hsl(240, 25%, 3%) 50%, hsl(220, 30%, 6%) 100%)',
    backdropPattern: 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(50,100,255,0.08) 4px, rgba(50,100,255,0.08) 5px), repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(50,100,255,0.06) 4px, rgba(50,100,255,0.06) 5px)',
    sideWallColor: 'hsl(230, 15%, 6%)',
    sideWallBorder: '2px solid hsl(220, 30%, 15%)',
    curtainStyle: 'metal',
    stageEdgeGradient: 'linear-gradient(90deg, hsl(220, 60%, 30%), hsl(200, 80%, 50%), hsl(220, 60%, 30%))',
    stageEdgeHeight: '6px',
    ambientGlowColor: 'hsl(220, 80%, 50%)',
    ambientGlowOpacity: 0.18,
    stageDepthPercent: 65,
    equipmentScale: 'massive',
    spotlightCount: 8,
    hasMovingHeads: true,
    hasLasers: true,
    hasLedStrips: true,
    hasCurtains: true,
    hasMonitors: true,
    hasFogMachine: true,
    hasBarrier: true,
    hasPhotoPit: true,
    hasVipSection: true,
    hasSoundDesk: true,
    hasMerchBooth: true,
    hasBarArea: true,
    securityGuards: 4,
  },

  stadium: {
    id: 'stadium',
    label: 'Stadium',
    floorGradient: 'linear-gradient(180deg, hsl(0, 0%, 8%) 0%, hsl(0, 0%, 3%) 100%)',
    floorPattern: 'repeating-linear-gradient(90deg, transparent, transparent 12px, rgba(255,255,255,0.02) 12px, rgba(255,255,255,0.02) 14px), repeating-linear-gradient(0deg, transparent, transparent 12px, rgba(255,255,255,0.015) 12px, rgba(255,255,255,0.015) 14px)',
    floorPatternOpacity: 0.2,
    backdropGradient: 'linear-gradient(180deg, hsl(0, 0%, 5%) 0%, hsl(270, 30%, 4%) 50%, hsl(0, 0%, 2%) 100%)',
    backdropPattern: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(200,100,255,0.1) 3px, rgba(200,100,255,0.1) 4px), repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(200,100,255,0.08) 3px, rgba(200,100,255,0.08) 4px)',
    sideWallColor: 'hsl(0, 0%, 4%)',
    sideWallBorder: '3px solid hsl(270, 40%, 20%)',
    curtainStyle: 'metal',
    stageEdgeGradient: 'linear-gradient(90deg, hsl(270, 60%, 30%), hsl(300, 80%, 50%), hsl(330, 70%, 45%), hsl(270, 60%, 30%))',
    stageEdgeHeight: '8px',
    ambientGlowColor: 'hsl(280, 80%, 50%)',
    ambientGlowOpacity: 0.2,
    stageDepthPercent: 60,
    equipmentScale: 'massive',
    spotlightCount: 12,
    hasMovingHeads: true,
    hasLasers: true,
    hasLedStrips: true,
    hasCurtains: true,
    hasMonitors: true,
    hasFogMachine: true,
    hasBarrier: true,
    hasPhotoPit: true,
    hasVipSection: true,
    hasSoundDesk: true,
    hasMerchBooth: true,
    hasBarArea: true,
    securityGuards: 6,
  },

  festival_ground: {
    id: 'festival_ground',
    label: 'Festival Ground',
    floorGradient: 'linear-gradient(180deg, hsl(30, 20%, 15%) 0%, hsl(25, 25%, 10%) 100%)',
    floorPattern: 'repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.02) 20px, rgba(255,255,255,0.02) 22px)',
    floorPatternOpacity: 0.2,
    backdropGradient: 'linear-gradient(180deg, hsl(220, 40%, 20%) 0%, hsl(240, 30%, 12%) 40%, hsl(260, 20%, 8%) 100%)',
    sideWallColor: 'transparent',
    sideWallBorder: 'none',
    curtainStyle: 'open',
    stageEdgeGradient: 'linear-gradient(90deg, hsl(120, 20%, 20%), hsl(100, 30%, 30%), hsl(120, 20%, 20%))',
    stageEdgeHeight: '6px',
    ambientGlowColor: 'hsl(200, 60%, 50%)',
    ambientGlowOpacity: 0.15,
    stageDepthPercent: 62,
    equipmentScale: 'large',
    spotlightCount: 6,
    hasMovingHeads: true,
    hasLasers: true,
    hasLedStrips: true,
    hasCurtains: false,
    hasMonitors: true,
    hasFogMachine: true,
    hasBarrier: true,
    hasPhotoPit: true,
    hasVipSection: true,
    hasSoundDesk: true,
    hasMerchBooth: true,
    hasBarArea: true,
    securityGuards: 3,
  },

  outdoor: {
    id: 'outdoor',
    label: 'Outdoor Stage',
    floorGradient: 'linear-gradient(180deg, hsl(30, 15%, 18%) 0%, hsl(25, 20%, 12%) 100%)',
    floorPattern: 'repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(255,255,255,0.03) 24px, rgba(255,255,255,0.03) 26px)',
    floorPatternOpacity: 0.25,
    backdropGradient: 'linear-gradient(180deg, hsl(230, 30%, 15%) 0%, hsl(220, 25%, 10%) 50%, hsl(210, 20%, 8%) 100%)',
    sideWallColor: 'transparent',
    sideWallBorder: 'none',
    curtainStyle: 'open',
    stageEdgeGradient: 'linear-gradient(90deg, hsl(0, 0%, 25%), hsl(0, 0%, 35%), hsl(0, 0%, 25%))',
    stageEdgeHeight: '5px',
    ambientGlowColor: 'hsl(210, 50%, 50%)',
    ambientGlowOpacity: 0.1,
    stageDepthPercent: 65,
    equipmentScale: 'standard',
    spotlightCount: 4,
    hasMovingHeads: false,
    hasLasers: false,
    hasLedStrips: true,
    hasCurtains: false,
    hasMonitors: true,
    hasFogMachine: false,
    hasBarrier: true,
    hasPhotoPit: false,
    hasVipSection: false,
    hasSoundDesk: true,
    hasMerchBooth: true,
    hasBarArea: false,
    securityGuards: 1,
  },
};

const DEFAULT_THEME = STAGE_THEMES.indie_venue;

export function getStageTheme(venueType?: string | null): StageThemeConfig {
  if (!venueType) return DEFAULT_THEME;
  return STAGE_THEMES[venueType] || DEFAULT_THEME;
}
