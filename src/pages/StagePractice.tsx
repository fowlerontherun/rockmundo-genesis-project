import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { StagePracticeSelection } from '@/components/stage-practice/StagePracticeSelection';
import { StagePracticeGame } from '@/components/stage-practice/StagePracticeGame';
import { StagePracticeResults } from '@/components/stage-practice/StagePracticeResults';
import type { GameState } from '@/lib/minigames/stagePracticeTypes';

interface SessionConfig {
  songId: string;
  songTitle: string;
  instrumentSlug: string;
  skillLevel: number;
}

const StagePractice = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'selection' | 'playing' | 'results'>('selection');
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [finalState, setFinalState] = useState<GameState | null>(null);

  const handleStart = useCallback((songId: string, songTitle: string, instrumentSlug: string, skillLevel: number) => {
    setConfig({ songId, songTitle, instrumentSlug, skillLevel });
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
    navigate('/dashboard');
  }, [navigate]);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl">
      {phase === 'selection' && (
        <StagePracticeSelection onStart={handleStart} />
      )}

      {phase === 'playing' && config && (
        <StagePracticeGame
          songTitle={config.songTitle}
          instrumentSlug={config.instrumentSlug}
          skillLevel={config.skillLevel}
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
    </div>
  );
};

export default StagePractice;
