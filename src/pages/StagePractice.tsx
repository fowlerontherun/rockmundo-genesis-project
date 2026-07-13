import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';
import { FMPageScaffold } from '@/components/fm/FMPageScaffold';
import { StagePracticeSelection } from '@/components/stage-practice/StagePracticeSelection';
import { StagePracticeGame } from '@/components/stage-practice/StagePracticeGame';
import { StagePracticeResults } from '@/components/stage-practice/StagePracticeResults';
import type { GameState } from '@/lib/minigames/stagePracticeTypes';

interface SessionConfig {
  songId: string;
  songTitle: string;
  instrumentSlug: string;
  skillLevel: number;
  audioUrl?: string | null;
}

const StagePractice = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'selection' | 'playing' | 'results'>('selection');
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [finalState, setFinalState] = useState<GameState | null>(null);

  const handleStart = useCallback((songId: string, songTitle: string, instrumentSlug: string, skillLevel: number, audioUrl?: string | null) => {
    setConfig({ songId, songTitle, instrumentSlug, skillLevel, audioUrl });
    setFinalState(null);
    setPhase('playing');
  }, []);

  const handleGameOver = useCallback((state: GameState) => {
    setFinalState(state);
    setPhase('results');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setFinalState(null);
    setPhase('selection');
  }, []);

  const handleExit = useCallback(() => {
    navigate('/home');
  }, [navigate]);

  return (
    <FMPageScaffold
      title="Stage Practice"
      subtitle="Rhythm minigame — earn daily XP across instruments."
      icon={Gamepad2}
      backTo="/hub/music"
      backLabel="Back to Music Hub"
    >
      {phase === 'selection' && (
        <StagePracticeSelection onStart={handleStart} />
      )}

      {phase === 'playing' && config && (
        <StagePracticeGame
          songTitle={config.songTitle}
          instrumentSlug={config.instrumentSlug}
          skillLevel={config.skillLevel}
          audioUrl={config.audioUrl}
          onGameOver={handleGameOver}
        />
      )}

      {phase === 'results' && config && finalState && (
        <StagePracticeResults
          gameState={finalState}
          songTitle={config.songTitle}
          instrumentSlug={config.instrumentSlug}
          skillLevel={config.skillLevel}
          songId={config.songId}
          onPlayAgain={handlePlayAgain}
          onExit={handleExit}
        />
      )}
    </FMPageScaffold>
  );
};

export default StagePractice;
