import { describe, it, expect } from "vitest";
import {
  classifyTopicStatus,
  calculatePriorityScore,
} from "./priority-engine";
import { AnswerResult } from "./types";

describe("Priority Engine", () => {
  describe("classifyTopicStatus", () => {
    it("1. classifies a topic with all correct answers as 'strong'", () => {
      const results: AnswerResult[] = [
        {
          question_id: "q1",
          topic: "Algebra",
          question: "What is x?",
          selected_index: 0,
          correct_index: 0,
          correct: true,
          explanation: "",
          selected_option_text: "A",
          correct_option_text: "A",
        },
        {
          question_id: "q2",
          topic: "Algebra",
          question: "What is y?",
          selected_index: 1,
          correct_index: 1,
          correct: true,
          explanation: "",
          selected_option_text: "B",
          correct_option_text: "B",
        },
      ];

      expect(classifyTopicStatus(results)).toBe("strong");
    });

    it("2. classifies a topic with all incorrect answers as 'weak'", () => {
      const results: AnswerResult[] = [
        {
          question_id: "q1",
          topic: "Algebra",
          question: "What is x?",
          selected_index: 1,
          correct_index: 0,
          correct: false,
          explanation: "",
          selected_option_text: "B",
          correct_option_text: "A",
        },
        {
          question_id: "q2",
          topic: "Algebra",
          question: "What is y?",
          selected_index: 0,
          correct_index: 1,
          correct: false,
          explanation: "",
          selected_option_text: "A",
          correct_option_text: "B",
        },
      ];

      expect(classifyTopicStatus(results)).toBe("weak");
    });

    it("3. classifies a topic with mixed results as 'needs_revision'", () => {
      const results: AnswerResult[] = [
        {
          question_id: "q1",
          topic: "Algebra",
          question: "What is x?",
          selected_index: 0,
          correct_index: 0,
          correct: true,
          explanation: "",
          selected_option_text: "A",
          correct_option_text: "A",
        },
        {
          question_id: "q2",
          topic: "Algebra",
          question: "What is y?",
          selected_index: 0,
          correct_index: 1,
          correct: false,
          explanation: "",
          selected_option_text: "A",
          correct_option_text: "B",
        },
      ];

      expect(classifyTopicStatus(results)).toBe("needs_revision");
    });

    it("4. classifies a topic with no questions as 'not_assessed'", () => {
      expect(classifyTopicStatus([])).toBe("not_assessed");
      expect(classifyTopicStatus(null)).toBe("not_assessed");
      expect(classifyTopicStatus(undefined)).toBe("not_assessed");
    });
  });

  describe("calculatePriorityScore", () => {
    it("5. correctly ranks a 'weak' topic above a 'needs_revision' topic, all else equal", () => {
      const weakScore = calculatePriorityScore("Topic Weak", "weak", 0.5, 0);
      const revisionScore = calculatePriorityScore("Topic Rev", "needs_revision", 0.5, 0);

      expect(weakScore).toBeGreaterThan(revisionScore);
      expect(weakScore).toBe(0.6); // (0.5 * 1.0) + (0.2 * 0.5) + (0)
      expect(revisionScore).toBe(0.35); // (0.5 * 0.5) + (0.2 * 0.5) + (0)
    });

    it("6. correctly incorporates PYQ relevance when present, and doesn't break when it's absent (0 contribution)", () => {
      const scoreWithPyq = calculatePriorityScore(
        "Topic PYQ",
        "needs_revision",
        0.5,
        { questionCount: 5, maxCount: 5 } // relevance = 1.0
      );

      const scoreWithoutPyq = calculatePriorityScore(
        "Topic No PYQ",
        "needs_revision",
        0.5,
        null
      );

      const scoreWithZeroPyq = calculatePriorityScore(
        "Topic Zero PYQ",
        "needs_revision",
        0.5,
        0
      );

      // (0.5 * 0.5) + (0.2 * 0.5) + (0.3 * 1.0) = 0.65
      expect(scoreWithPyq).toBe(0.65);

      // (0.5 * 0.5) + (0.2 * 0.5) + 0 = 0.35
      expect(scoreWithoutPyq).toBe(0.35);
      expect(scoreWithZeroPyq).toBe(0.35);

      expect(scoreWithPyq).toBeGreaterThan(scoreWithoutPyq);
    });
  });
});
