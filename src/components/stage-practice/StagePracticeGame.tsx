import { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  type GameNote,
  type GameState,
  type HitAccuracy,
  type DifficultyProfile,
  INITIAL_GAME_STATE,
  LANE_COUNT,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HIT_ZONE_Y,
  NOTE_RADIUS,
  getDifficultyFromSkill,
} from '@/lib/minigames/stagePracticeTypes';

interface StagePracticeGameProps {
  songTitle: string;
  instrumentSlug: string;
  skillLevel: number;
  onGameOver: (state: GameState) => void;
}

// Lane colors (HSL-based to match design system)
const LANE_COLORS = [
  { h: 0, s: 80, l: 60 },    // red
  { h: 200, s: 80, l: 60 },  // blue
  { h: 120, s: 60, l: 50 },  // green
  { h: 45, s: 90, l: 55 },   // amber
];

const laneHsl = (lane: number) => `hsl(${LANE_COLORS[lane].h}, ${LANE_COLORS[lane].s}%, ${LANE_COLORS[lane].l}%)`;
const laneHsla = (lane: number, a: number) => `hsla(${LANE_COLORS[lane].h}, ${LANE_COLORS[lane].s}%, ${LANE_COLORS[lane].l}%, ${a})`;

let nextNoteId = 0;

export function StagePracticeGame({
  songTitle,
  instrumentSlug,
  skillLevel,
  onGameOver,
}: StagePracticeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const notesRef = useRef<GameNote[]>([]);
  const stateRef = useRef<GameState>({ ...INITIAL_GAME_STATE, phase: 'playing' });
  const difficultyRef = useRef<DifficultyProfile>(getDifficultyFromSkill(skillLevel));
  const lastSpawnRef = useRef(0);
  const lastFrameRef = useRef(0);
  const animRef = useRef<number>(0);
  const playerLaneRef = useRef(Math.floor(LANE_COUNT / 2));
  const feedbackRef = useRef<{ text: string; color: string; time: number } | null>(null);

  const [gameState, setGameState] = useState<GameState>({ ...INITIAL_GAME_STATE, phase: 'playing' });
  const [playerLane, setPlayerLane] = useState(Math.floor(LANE_COUNT / 2));

  const laneWidth = CANVAS_WIDTH / LANE_COUNT;

  // ─── Note spawning ─────────────────────────────────────────────
  const spawnNote = useCallback(() => {
    const diff = difficultyRef.current;
    const level = stateRef.current.level;
    const speed = diff.baseSpeed + level * diff.speedIncrement;
    const lane = Math.floor(Math.random() * LANE_COUNT);

    let type: GameNote['type'] = 'normal';
    const roll = Math.random();
    if (roll < diff.bonusNoteChance) type = 'bonus';
    else if (roll < diff.bonusNoteChance + diff.holdNoteChance) type = 'hold';

    const note: GameNote = {
      id: `n${nextNoteId++}`,
      type,
      lane,
      spawnTime: stateRef.current.elapsedMs,
      fallSpeed: speed,
      y: -NOTE_RADIUS,
      hitWindow: diff.hitWindowMs,
      xpMultiplier: type === 'bonus' ? 2 : 1,
      active: true,
      holdDuration: type === 'hold' ? 400 + Math.random() * 300 : undefined,
    };
    notesRef.current.push(note);
  }, []);

  // ─── Hit detection ─────────────────────────────────────────────
  const tryHitNote = useCallback(() => {
    const currentLane = playerLaneRef.current;
    const notes = notesRef.current;
    const hitZone = HIT_ZONE_Y;

    // Find closest active note in player's lane near the hit zone
    let bestNote: GameNote | null = null;
    let bestDist = Infinity;

    for (const note of notes) {
      if (!note.active || note.lane !== currentLane) continue;
      const dist = Math.abs(note.y - hitZone);
      if (dist < bestDist) {
        bestDist = dist;
        bestNote = note;
      }
    }

    if (!bestNote) return;

    const timingPx = bestDist;
    const perfectThreshold = 15;
    const goodThreshold = 35;

    let accuracy: HitAccuracy;
    let points: number;

    if (timingPx <= perfectThreshold) {
      accuracy = 'perfect';
      points = 100 * bestNote.xpMultiplier;
    } else if (timingPx <= goodThreshold) {
      accuracy = 'good';
      points = 50 * bestNote.xpMultiplier;
    } else {
      return; // Too far
    }

    bestNote.active = false;

    const s = stateRef.current;
    s.score += points;
    s.combo += 1;
    s.notesHit += 1;
    if (accuracy === 'perfect') s.perfectHits += 1;
    else s.goodHits += 1;
    if (s.combo > s.longestCombo) s.longestCombo = s.combo;

    // Combo bonus
    if (s.combo > 0 && s.combo % 10 === 0) {
      s.score += s.combo * 5;
    }

    updateAccuracy(s);

    feedbackRef.current = {
      text: accuracy === 'perfect' ? 'PERFECT!' : 'GOOD',
      color: accuracy === 'perfect' ? 'hsl(45, 100%, 55%)' : 'hsl(120, 60%, 55%)',
      time: s.elapsedMs,
    };

    setGameState({ ...s });
  }, []);

  // ─── Update accuracy ──────────────────────────────────────────
  const updateAccuracy = (s: GameState) => {
    const total = s.notesHit + s.notesMissed;
    s.accuracy = total > 0 ? Math.round((s.notesHit / total) * 100) : 100;
  };

  // ─── Handle miss ──────────────────────────────────────────────
  const handleMiss = useCallback(() => {
    const s = stateRef.current;
    s.notesMissed += 1;
    s.combo = 0;
    s.lives -= 1;
    updateAccuracy(s);

    feedbackRef.current = {
      text: 'MISS',
      color: 'hsl(0, 80%, 55%)',
      time: s.elapsedMs,
    };

    if (s.lives <= 0) {
      s.phase = 'gameover';
      setGameState({ ...s });
      cancelAnimationFrame(animRef.current);
      onGameOver({ ...s });
      return;
    }
    setGameState({ ...s });
  }, [onGameOver]);

  // ─── Level progression ────────────────────────────────────────
  const checkLevelUp = useCallback(() => {
    const s = stateRef.current;
    const threshold = s.level * 8; // need 8 hits per level
    if (s.notesHit >= threshold) {
      s.level += 1;
      setGameState({ ...s });
    }
  }, []);

  // ─── Game loop ────────────────────────────────────────────────
  const gameLoop = useCallback((timestamp: number) => {
    if (stateRef.current.phase !== 'playing') return;

    const dt = lastFrameRef.current === 0 ? 16 : timestamp - lastFrameRef.current;
    lastFrameRef.current = timestamp;
    const s = stateRef.current;
    s.elapsedMs += dt;
    const diff = difficultyRef.current;

    // Spawn notes
    const spawnInt = Math.max(300, diff.spawnInterval - s.level * diff.spawnIntervalDecrement);
    if (s.elapsedMs - lastSpawnRef.current >= spawnInt) {
      spawnNote();
      lastSpawnRef.current = s.elapsedMs;
    }

    // Update notes
    const notes = notesRef.current;
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      if (!note.active) continue;
      note.y += (note.fallSpeed * dt) / 1000;

      // Missed – passed hit zone
      if (note.y > HIT_ZONE_Y + 40) {
        note.active = false;
        handleMiss();
      }
    }

    // Clean up inactive notes
    notesRef.current = notes.filter(n => n.active || n.y < CANVAS_HEIGHT + 50);

    checkLevelUp();
    drawFrame();

    animRef.current = requestAnimationFrame(gameLoop);
  }, [spawnNote, handleMiss, checkLevelUp]);

  // ─── Drawing ──────────────────────────────────────────────────
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = CANVAS_WIDTH;
    const h = CANVAS_HEIGHT;

    // Background
    ctx.fillStyle = 'hsl(220, 25%, 8%)';
    ctx.fillRect(0, 0, w, h);

    // Lane dividers
    ctx.strokeStyle = 'hsla(220, 20%, 25%, 0.4)';
    ctx.lineWidth = 1;
    for (let i = 1; i < LANE_COUNT; i++) {
      const x = i * laneWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Hit zone line
    ctx.strokeStyle = 'hsla(220, 60%, 50%, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, HIT_ZONE_Y);
    ctx.lineTo(w, HIT_ZONE_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hit zone glow at player lane
    const pLane = playerLaneRef.current;
    const plx = pLane * laneWidth + laneWidth / 2;
    const grad = ctx.createRadialGradient(plx, HIT_ZONE_Y, 5, plx, HIT_ZONE_Y, 40);
    grad.addColorStop(0, 'hsla(200, 80%, 60%, 0.3)');
    grad.addColorStop(1, 'hsla(200, 80%, 60%, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(pLane * laneWidth, HIT_ZONE_Y - 40, laneWidth, 80);

    // Draw notes
    for (const note of notesRef.current) {
      if (!note.active) continue;
      const cx = note.lane * laneWidth + laneWidth / 2;
      const cy = note.y;

      // Glow
      const ng = ctx.createRadialGradient(cx, cy, 2, cx, cy, NOTE_RADIUS + 8);
      ng.addColorStop(0, note.type === 'bonus' ? 'hsla(45, 100%, 60%, 0.5)' : laneHsla(note.lane, 0.5));
      ng.addColorStop(1, 'transparent');
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.arc(cx, cy, NOTE_RADIUS + 8, 0, Math.PI * 2);
      ctx.fill();

      // Note circle
      ctx.fillStyle = note.type === 'bonus' ? 'hsl(45, 100%, 55%)' : laneHsl(note.lane);
      ctx.beginPath();
      ctx.arc(cx, cy, NOTE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Hold note indicator
      if (note.type === 'hold') {
        ctx.strokeStyle = 'hsla(0, 0%, 100%, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, NOTE_RADIUS - 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Bonus star
      if (note.type === 'bonus') {
        ctx.fillStyle = 'hsl(220, 20%, 10%)';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', cx, cy);
      }
    }

    // Player instrument sprite (simple rectangle at bottom)
    const spriteW = laneWidth * 0.7;
    const spriteH = 16;
    const spriteX = pLane * laneWidth + (laneWidth - spriteW) / 2;
    const spriteY = HIT_ZONE_Y - spriteH / 2;

    ctx.fillStyle = 'hsl(200, 80%, 55%)';
    ctx.shadowColor = 'hsl(200, 80%, 55%)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(spriteX, spriteY, spriteW, spriteH, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Feedback text
    const fb = feedbackRef.current;
    if (fb && stateRef.current.elapsedMs - fb.time < 500) {
      const alpha = 1 - (stateRef.current.elapsedMs - fb.time) / 500;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fb.color;
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fb.text, w / 2, HIT_ZONE_Y - 50);
      ctx.globalAlpha = 1;
    }
  }, [laneWidth]);

  // ─── Input handlers ───────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.phase !== 'playing') return;

      if (e.key === 'ArrowLeft' || e.key === 'a') {
        playerLaneRef.current = Math.max(0, playerLaneRef.current - 1);
        setPlayerLane(playerLaneRef.current);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        playerLaneRef.current = Math.min(LANE_COUNT - 1, playerLaneRef.current + 1);
        setPlayerLane(playerLaneRef.current);
      } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        tryHitNote();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tryHitNote]);

  // ─── Touch controls ───────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (stateRef.current.phase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX: number;
    if ('touches' in e) {
      clientX = e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0;
    } else {
      clientX = e.clientX;
    }
    const x = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const clickedLane = Math.floor(x / laneWidth);
    playerLaneRef.current = Math.min(LANE_COUNT - 1, Math.max(0, clickedLane));
    setPlayerLane(playerLaneRef.current);
    tryHitNote();
  }, [laneWidth, tryHitNote]);

  // ─── Start game loop ──────────────────────────────────────────
  useEffect(() => {
    lastFrameRef.current = 0;
    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameLoop]);

  // ─── Pause/Resume ─────────────────────────────────────────────
  const togglePause = () => {
    const s = stateRef.current;
    if (s.phase === 'playing') {
      s.phase = 'paused';
      cancelAnimationFrame(animRef.current);
      setGameState({ ...s });
    } else if (s.phase === 'paused') {
      s.phase = 'playing';
      lastFrameRef.current = 0;
      animRef.current = requestAnimationFrame(gameLoop);
      setGameState({ ...s });
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* HUD */}
      <div className="w-full max-w-[400px] flex items-center justify-between px-2">
        <div className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground">Lvl</span>
          <span className="font-bold text-primary">{gameState.level}</span>
        </div>
        <div className="text-center">
          <span className="text-xl font-bold">{gameState.score.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: gameState.maxLives }).map((_, i) => (
            <Heart
              key={i}
              className={`h-5 w-5 ${i < gameState.lives ? 'text-red-500 fill-red-500' : 'text-muted-foreground/30'}`}
            />
          ))}
        </div>
      </div>

      {/* Combo & Accuracy bar */}
      <div className="w-full max-w-[400px] flex items-center justify-between px-2 text-xs text-muted-foreground">
        <span>Combo: <span className="text-foreground font-semibold">{gameState.combo}</span></span>
        <span className="text-muted-foreground">{songTitle}</span>
        <span>Accuracy: <span className="text-foreground font-semibold">{gameState.accuracy}%</span></span>
      </div>

      {/* Canvas */}
      <div className="relative rounded-lg overflow-hidden border border-border shadow-lg">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="cursor-pointer"
          style={{ width: '100%', maxWidth: 400, aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
          onClick={handleCanvasClick}
          onTouchStart={handleCanvasClick}
        />

        {/* Pause overlay */}
        {gameState.phase === 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-center space-y-3">
              <p className="text-2xl font-bold">Paused</p>
              <Button onClick={togglePause}>
                <Play className="h-4 w-4 mr-2" /> Resume
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Controls hint */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={togglePause}>
          <Pause className="h-4 w-4 mr-1" />
          {gameState.phase === 'paused' ? 'Resume' : 'Pause'}
        </Button>
        <span className="text-xs text-muted-foreground">← → to move • Space/Click to hit</span>
      </div>
    </div>
  );
}
