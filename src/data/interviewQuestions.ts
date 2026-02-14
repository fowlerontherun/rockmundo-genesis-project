export interface InterviewQuestionOption {
  text: string;
  effects: {
    fame_mult: number;
    fan_mult: number;
    cash_mult: number;
    reputation: Record<string, number>;
  };
}

export interface InterviewQuestion {
  id: string;
  question_text: string;
  media_types: string[];
  category: string;
  option_a_text: string;
  option_a_effects: InterviewQuestionOption["effects"];
  option_b_text: string;
  option_b_effects: InterviewQuestionOption["effects"];
  option_c_text: string;
  option_c_effects: InterviewQuestionOption["effects"];
  option_d_text: string;
  option_d_effects: InterviewQuestionOption["effects"];
}

export interface InterviewAnswer {
  question_id: string;
  chosen_option: "a" | "b" | "c" | "d";
  timed_out: boolean;
}

export interface InterviewResult {
  answers: InterviewAnswer[];
  total_effects: {
    fame_mult: number;
    fan_mult: number;
    cash_mult: number;
    reputation: Record<string, number>;
  };
}

export type InterviewPhase = "intro" | "question" | "results";
