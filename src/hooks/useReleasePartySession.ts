import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ReleasePartyQuestion {
  id: string;
  question_text: string;
  category: string;
  party_context: string[];
  option_a_text: string;
  option_a_effects: Record<string, any>;
  option_b_text: string;
  option_b_effects: Record<string, any>;
  option_c_text: string;
  option_c_effects: Record<string, any>;
  option_d_text: string;
  option_d_effects: Record<string, any>;
}

interface PartyAnswer {
  question_id: string;
  chosen_option: "a" | "b" | "c" | "d";
  timed_out: boolean;
}

interface PartyEffects {
  hype_mult: number;
  fan_mult: number;
  cash_mult: number;
  reputation: Record<string, number>;
}

export type PartyPhase = "intro" | "question" | "results";

export const useReleasePartySession = (
  releaseId: string | null,
  releaseTitle: string,
  userId: string,
  bandId: string | null
) => {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<PartyPhase>("intro");
  const [questions, setQuestions] = useState<ReleasePartyQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<PartyAnswer[]>([]);
  const [timeLeft, setTimeLeft] = useState(10);
  const [totalEffects, setTotalEffects] = useState<PartyEffects | null>(null);
  const [hypeAwarded, setHypeAwarded] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startParty = useCallback(async () => {
    if (!releaseId) return;
    setLoading(true);

    const { data } = await (supabase.from("release_party_questions" as any) as any)
      .select("*");

    if (data && data.length >= 5) {
      const shuffled = [...data].sort(() => Math.random() - 0.5);
      setQuestions(shuffled.slice(0, 5) as ReleasePartyQuestion[]);
      setCurrentIndex(0);
      setAnswers([]);
      setTimeLeft(10);
      setPhase("question");
    } else {
      toast.error("Not enough party questions available");
    }
    setLoading(false);
  }, [releaseId]);

  // Timer countdown
  useEffect(() => {
    if (phase !== "question") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.1) {
          handleAnswer("d", true);
          return 10;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, currentIndex]);

  const handleAnswer = useCallback(
    (option: "a" | "b" | "c" | "d", timedOut = false) => {
      if (timerRef.current) clearInterval(timerRef.current);

      const q = questions[currentIndex];
      if (!q) return;

      const newAnswer: PartyAnswer = {
        question_id: q.id,
        chosen_option: option,
        timed_out: timedOut,
      };

      const newAnswers = [...answers, newAnswer];
      setAnswers(newAnswers);

      if (currentIndex < 4) {
        setCurrentIndex((i) => i + 1);
        setTimeLeft(10);
      } else {
        const effects = calculateTotalEffects(questions, newAnswers);
        setTotalEffects(effects);
        // Base hype = 100, modified by average hype_mult
        const awarded = Math.round(100 * effects.hype_mult);
        setHypeAwarded(awarded);
        setPhase("results");
      }
    },
    [questions, currentIndex, answers]
  );

  const calculateTotalEffects = (
    qs: ReleasePartyQuestion[],
    ans: PartyAnswer[]
  ): PartyEffects => {
    let hypeMult = 0;
    let fanMult = 0;
    let cashMult = 0;
    const repTotal: Record<string, number> = {};

    ans.forEach((a, i) => {
      const q = qs[i];
      const key = `option_${a.chosen_option}_effects` as keyof ReleasePartyQuestion;
      const effects = q[key] as Record<string, any>;

      hypeMult += effects.hype_mult || 1;
      fanMult += effects.fan_mult || 1;
      cashMult += effects.cash_mult || 1;

      if (effects.reputation) {
        Object.entries(effects.reputation).forEach(([k, v]) => {
          repTotal[k] = (repTotal[k] || 0) + (v as number);
        });
      }
    });

    return {
      hype_mult: hypeMult / 5,
      fan_mult: fanMult / 5,
      cash_mult: cashMult / 5,
      reputation: repTotal,
    };
  };

  const finishParty = useCallback(async () => {
    if (!releaseId || !totalEffects || !userId) return;
    setLoading(true);

    try {
      // Save party results
      await (supabase.from("release_party_results" as any) as any).insert({
        release_id: releaseId,
        user_id: userId,
        band_id: bandId,
        questions: answers,
        total_effects: totalEffects,
        hype_awarded: hypeAwarded,
      });

      // Update release hype_score
      const { data: release } = await supabase
        .from("releases")
        .select("hype_score")
        .eq("id", releaseId)
        .single();

      const currentHype = (release as any)?.hype_score || 0;
      const newHype = Math.min(1000, currentHype + hypeAwarded);

      await supabase
        .from("releases")
        .update({ hype_score: newHype, release_party_done: true } as any)
        .eq("id", releaseId);

      queryClient.invalidateQueries({ queryKey: ["releases"] });
      toast.success(`Release party added ${hypeAwarded} hype!`);
    } catch (err) {
      console.error("Error finishing party:", err);
      toast.error("Failed to save party results");
    }

    setLoading(false);
  }, [releaseId, totalEffects, userId, bandId, answers, hypeAwarded, queryClient]);

  const reset = useCallback(() => {
    setPhase("intro");
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
    setTimeLeft(10);
    setTotalEffects(null);
    setHypeAwarded(0);
  }, []);

  return {
    phase,
    questions,
    currentIndex,
    currentQuestion: questions[currentIndex] || null,
    answers,
    timeLeft,
    totalEffects,
    hypeAwarded,
    loading,
    startParty,
    handleAnswer,
    finishParty,
    reset,
  };
};
