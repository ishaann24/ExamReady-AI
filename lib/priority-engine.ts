import { KnowledgeGapStatus, AnswerResult } from "./types";

/**
 * Classifies the knowledge gap status of a topic based on quiz results.
 */
export function classifyTopicStatus(
  results?: AnswerResult[] | null
): KnowledgeGapStatus {
  if (!results || !Array.isArray(results) || results.length === 0) {
    return "not_assessed";
  }

  const totalQuestions = results.length;
  const correctCount = results.filter((r) => r.correct).length;

  if (correctCount === totalQuestions) {
    return "strong";
  }
  if (correctCount === 0) {
    return "weak";
  }
  return "needs_revision";
}

/**
 * Calculates a topic's priority score between 0.0 and 1.0.
 * Formula: priority = (0.5 * gapSeverity) + (0.2 * difficulty) + (0.3 * pyqRelevance)
 */
export function calculatePriorityScore(
  topic: string,
  gapSeverity: KnowledgeGapStatus | number,
  difficulty: number | string = 0.5,
  pyqRelevance?: number | { questionCount: number; maxCount?: number } | null
): number {
  let severityScore = 0;

  if (typeof gapSeverity === "number") {
    severityScore = gapSeverity;
  } else {
    switch (gapSeverity) {
      case "weak":
        severityScore = 1.0;
        break;
      case "needs_revision":
        severityScore = 0.5;
        break;
      case "not_assessed":
        severityScore = 0.3;
        break;
      case "strong":
      default:
        severityScore = 0.0;
        break;
    }
  }

  // Strong topics always return a priority score of 0
  if (gapSeverity === "strong" || severityScore === 0) {
    return 0;
  }

  let difficultyScore = 0.5;
  if (typeof difficulty === "number") {
    difficultyScore = difficulty;
  } else if (typeof difficulty === "string") {
    const weights: Record<string, number> = {
      application: 1.0,
      conceptual: 0.7,
      recall: 0.4,
    };
    difficultyScore = weights[difficulty] ?? 0.5;
  }

  let relevanceScore = 0;
  if (typeof pyqRelevance === "number") {
    relevanceScore = pyqRelevance;
  } else if (pyqRelevance && typeof pyqRelevance === "object") {
    const count = pyqRelevance.questionCount || 0;
    const max = pyqRelevance.maxCount || 1;
    relevanceScore = max > 0 ? count / max : 0;
  }

  const rawScore = 0.5 * severityScore + 0.2 * difficultyScore + 0.3 * relevanceScore;
  return Number(rawScore.toFixed(3));
}

/**
 * Generates human-readable reason text for topic classification.
 */
export function formatTopicReason(
  status: KnowledgeGapStatus,
  totalQuestions: number,
  correctQuestions: number,
  pyqQuestionCount?: number
): string {
  if (status === "not_assessed" || totalQuestions === 0) {
    return "Not assessed in diagnostic quiz.";
  }

  if (status === "strong") {
    return `Mastered all ${totalQuestions} question${totalQuestions === 1 ? "" : "s"} on this topic.`;
  }

  const pyqText =
    pyqQuestionCount && pyqQuestionCount > 0
      ? `, and it appears in ${pyqQuestionCount} question${pyqQuestionCount === 1 ? "" : "s"} across your previous-year papers`
      : "";

  if (status === "weak") {
    return `Missed ${totalQuestions} of ${totalQuestions} question${totalQuestions === 1 ? "" : "s"} on this topic${pyqText}.`;
  }

  const missedCount = totalQuestions - correctQuestions;
  return `Missed ${missedCount} of ${totalQuestions} question${totalQuestions === 1 ? "" : "s"} on this topic${pyqText}.`;
}
