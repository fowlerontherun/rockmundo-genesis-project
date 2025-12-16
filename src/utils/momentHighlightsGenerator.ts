import { supabase } from "@/integrations/supabase/client";

export interface GigMoment {
  id: string;
  type: 'highlight' | 'lowlight' | 'special';
  category: 'crowd' | 'performance' | 'technical' | 'merchandise' | 'milestone';
  title: string;
  description: string;
  songPosition?: number;
  songTitle?: string;
  impactScore: number; // -10 to +10
  icon: string;
}

interface SongPerformance {
  song_id: string;
  song_title: string;
  position: number;
  performance_score: number;
  crowd_response: string;
}

interface MomentGeneratorInput {
  gigId: string;
  bandId: string;
  overallRating: number;
  actualAttendance: number;
  venueCapacity: number;
  netProfit: number;
  performanceGrade: string;
  fameGained: number;
  songPerformances: SongPerformance[];
  merchItemsSold: number;
  isFirstGig?: boolean;
  isSoldOut?: boolean;
}

export function generateMomentHighlights(input: MomentGeneratorInput): GigMoment[] {
  const moments: GigMoment[] = [];
  const {
    overallRating,
    actualAttendance,
    venueCapacity,
    netProfit,
    performanceGrade,
    fameGained,
    songPerformances,
    merchItemsSold,
    isFirstGig,
    isSoldOut,
  } = input;

  const attendancePercentage = (actualAttendance / venueCapacity) * 100;

  // Find best and worst songs
  const sortedSongs = [...songPerformances].sort((a, b) => b.performance_score - a.performance_score);
  const bestSong = sortedSongs[0];
  const worstSong = sortedSongs[sortedSongs.length - 1];

  // Perfect songs (score >= 23)
  const perfectSongs = songPerformances.filter(s => s.performance_score >= 23);
  
  // Crowd favorites (ecstatic response)
  const crowdFavorites = songPerformances.filter(s => s.crowd_response === 'ecstatic');

  // Generate crowd moments
  if (isSoldOut || attendancePercentage >= 95) {
    moments.push({
      id: `crowd-soldout-${Date.now()}`,
      type: 'highlight',
      category: 'crowd',
      title: 'SOLD OUT!',
      description: `The venue was packed to capacity! ${actualAttendance} fans filled every available space.`,
      impactScore: 10,
      icon: '🎉',
    });
  } else if (attendancePercentage >= 80) {
    moments.push({
      id: `crowd-great-${Date.now()}`,
      type: 'highlight',
      category: 'crowd',
      title: 'Huge Turnout',
      description: `An impressive ${attendancePercentage.toFixed(0)}% of the venue filled with eager fans.`,
      impactScore: 7,
      icon: '👥',
    });
  } else if (attendancePercentage < 30) {
    moments.push({
      id: `crowd-low-${Date.now()}`,
      type: 'lowlight',
      category: 'crowd',
      title: 'Sparse Crowd',
      description: `Only ${actualAttendance} fans showed up, leaving much of the venue empty.`,
      impactScore: -5,
      icon: '😔',
    });
  }

  // Generate performance moments
  if (bestSong && bestSong.performance_score >= 22) {
    moments.push({
      id: `perf-best-${Date.now()}`,
      type: 'highlight',
      category: 'performance',
      title: 'Show Stopper',
      description: `"${bestSong.song_title}" brought the house down with a ${bestSong.performance_score.toFixed(1)}/25 performance!`,
      songPosition: bestSong.position,
      songTitle: bestSong.song_title,
      impactScore: 8,
      icon: '🔥',
    });
  }

  if (worstSong && worstSong.performance_score < 12) {
    moments.push({
      id: `perf-worst-${Date.now()}`,
      type: 'lowlight',
      category: 'performance',
      title: 'Rough Patch',
      description: `"${worstSong.song_title}" didn't connect with the crowd, scoring only ${worstSong.performance_score.toFixed(1)}/25.`,
      songPosition: worstSong.position,
      songTitle: worstSong.song_title,
      impactScore: -4,
      icon: '😬',
    });
  }

  // Perfect performance moments
  if (perfectSongs.length >= 3) {
    moments.push({
      id: `perf-perfect-streak-${Date.now()}`,
      type: 'highlight',
      category: 'performance',
      title: 'Flawless Streak',
      description: `${perfectSongs.length} songs achieved near-perfect scores! The band was on fire!`,
      impactScore: 9,
      icon: '⭐',
    });
  }

  // Crowd response moments
  if (crowdFavorites.length > 0) {
    moments.push({
      id: `crowd-ecstatic-${Date.now()}`,
      type: 'highlight',
      category: 'crowd',
      title: 'Crowd Goes Wild',
      description: crowdFavorites.length === 1
        ? `"${crowdFavorites[0].song_title}" sent the crowd into an absolute frenzy!`
        : `${crowdFavorites.length} songs had the audience going absolutely wild!`,
      impactScore: 8,
      icon: '🤘',
    });
  }

  // Merchandise moments
  if (merchItemsSold >= 50) {
    moments.push({
      id: `merch-great-${Date.now()}`,
      type: 'highlight',
      category: 'merchandise',
      title: 'Merch Madness',
      description: `${merchItemsSold} items sold! Fans couldn't get enough of the merchandise.`,
      impactScore: 7,
      icon: '👕',
    });
  } else if (merchItemsSold >= 20) {
    moments.push({
      id: `merch-good-${Date.now()}`,
      type: 'highlight',
      category: 'merchandise',
      title: 'Solid Merch Sales',
      description: `${merchItemsSold} items sold at the merch booth.`,
      impactScore: 4,
      icon: '🛍️',
    });
  }

  // Financial moments
  if (netProfit >= 1000) {
    moments.push({
      id: `finance-profit-${Date.now()}`,
      type: 'highlight',
      category: 'milestone',
      title: 'Big Payday',
      description: `The band walked away with $${netProfit.toLocaleString()} in profit!`,
      impactScore: 8,
      icon: '💰',
    });
  } else if (netProfit < 0) {
    moments.push({
      id: `finance-loss-${Date.now()}`,
      type: 'lowlight',
      category: 'milestone',
      title: 'Financial Loss',
      description: `The gig cost more than it earned, resulting in a $${Math.abs(netProfit).toLocaleString()} loss.`,
      impactScore: -6,
      icon: '📉',
    });
  }

  // Fame moments
  if (fameGained >= 100) {
    moments.push({
      id: `fame-boost-${Date.now()}`,
      type: 'highlight',
      category: 'milestone',
      title: 'Rising Stars',
      description: `Word is spreading! The band gained ${fameGained} fame points from this performance.`,
      impactScore: 7,
      icon: '📈',
    });
  }

  // Grade-based moments
  if (performanceGrade === 'S') {
    moments.push({
      id: `grade-s-${Date.now()}`,
      type: 'special',
      category: 'performance',
      title: 'LEGENDARY PERFORMANCE',
      description: 'An S-grade performance! This gig will be remembered for years to come!',
      impactScore: 10,
      icon: '🏆',
    });
  } else if (performanceGrade === 'A') {
    moments.push({
      id: `grade-a-${Date.now()}`,
      type: 'highlight',
      category: 'performance',
      title: 'Outstanding Show',
      description: 'An A-grade performance that left fans wanting more!',
      impactScore: 8,
      icon: '🌟',
    });
  } else if (performanceGrade === 'D' || performanceGrade === 'F') {
    moments.push({
      id: `grade-low-${Date.now()}`,
      type: 'lowlight',
      category: 'performance',
      title: 'Room for Improvement',
      description: `A ${performanceGrade}-grade performance. The band needs more practice.`,
      impactScore: -5,
      icon: '📝',
    });
  }

  // First gig milestone
  if (isFirstGig) {
    moments.push({
      id: `milestone-first-${Date.now()}`,
      type: 'special',
      category: 'milestone',
      title: 'First Gig Complete!',
      description: 'The band played their very first live show! Every journey starts somewhere.',
      impactScore: 5,
      icon: '🎸',
    });
  }

  // Encore-worthy performance
  if (overallRating >= 20) {
    moments.push({
      id: `encore-worthy-${Date.now()}`,
      type: 'highlight',
      category: 'crowd',
      title: 'Encore! Encore!',
      description: 'The crowd refused to leave, demanding an encore performance!',
      impactScore: 7,
      icon: '👏',
    });
  }

  // Sort by impact score (highest first for highlights, lowest first for lowlights)
  return moments.sort((a, b) => {
    if (a.type === 'special') return -1;
    if (b.type === 'special') return 1;
    return Math.abs(b.impactScore) - Math.abs(a.impactScore);
  });
}

export async function saveMomentHighlights(gigId: string, moments: GigMoment[]): Promise<void> {
  // Save highlights to database for future reference
  const highlightsData = moments.map(moment => ({
    gig_id: gigId,
    moment_type: moment.type,
    category: moment.category,
    title: moment.title,
    description: moment.description,
    song_position: moment.songPosition || null,
    song_title: moment.songTitle || null,
    impact_score: moment.impactScore,
    icon: moment.icon,
  }));

  // For now, we store in gig_outcomes metadata - can create dedicated table later
  const { error } = await supabase
    .from('gig_outcomes')
    .update({
      highlight_moments: highlightsData,
    })
    .eq('gig_id', gigId);

  if (error) {
    console.error('Error saving moment highlights:', error);
  }
}
