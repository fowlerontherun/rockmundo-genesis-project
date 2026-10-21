import { describe, expect, it } from "vitest";
import type { InterviewQuestion } from "@/data/interviewQuestions";
import { selectInterviewQuestions } from "./interviewSelection";

const effects = { fame_mult: 1, fan_mult: 1, cash_mult: 1, reputation: {} };
const question = (id: string, category = "music"): InterviewQuestion => ({
  id,
  question_text: "Tell us about " + id + "?",
  category,
  media_types: ["all"],
  option_a_text: "Thoughtful response " + id,
  option_a_effects: effects,
  option_b_text: "Practical response " + id,
  option_b_effects: effects,
  option_c_text: "Bold response " + id,
  option_c_effects: effects,
  option_d_text: "Playful response " + id,
  option_d_effects: effects,
});

describe("selectInterviewQuestions", () => {
  it("prioritises unasked questions over recently used ones", () => {
    const pool = [question("old1"), question("old2"), question("fresh1"), question("fresh2")];
    const picked = selectInterviewQuestions(pool, 2, new Set(["old1", "old2"]), () => 0.5);
    expect(picked.map((item) => item.id).sort()).toEqual(["fresh1", "fresh2"]);
  });

  it("falls back to older questions when no fresh ones remain", () => {
    const picked = selectInterviewQuestions([question("old"), question("fresh")], 2, new Set(["old"]), () => 0.5);
    expect(picked.map((item) => item.id)).toEqual(["fresh", "old"]);
  });

  it("maximises category variety in a short media appearance", () => {
    const pool = [question("a", "music"), question("b", "music"), question("c", "touring"), question("d", "fans")];
    const picked = selectInterviewQuestions(pool, 3, new Set(), () => 0.5);
    expect(new Set(picked.map((item) => item.category)).size).toBe(3);
  });

  it("filters duplicate prompts and bad answer sets without mutating the pool", () => {
    const valid = question("ok");
    const duplicate = { ...question("duplicate"), question_text: valid.question_text };
    const broken = { ...question("broken"), option_d_text: "Thoughtful response broken" };
    const pool = [valid, duplicate, broken];
    expect(selectInterviewQuestions(pool, 1, new Set(), () => 0.5)).toEqual([valid]);
    expect(pool).toEqual([valid, duplicate, broken]);
  });

  it("refuses to launch an interview with too few valid questions", () => {
    expect(() => selectInterviewQuestions([question("one")], 5)).toThrow(/Not enough valid interview questions/);
  });

  it("preserves each option's authored text and effects", () => {
    const source = question("topic");
    const picked = selectInterviewQuestions([source], 1);
    expect(picked[0].option_c_text).toBe(source.option_c_text);
    expect(picked[0].option_c_effects).toBe(source.option_c_effects);
  });
});
