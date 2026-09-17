export type KnowledgeGapStatus =
  | "strong"
  | "needs_revision"
  | "weak"
  | "not_assessed";

export interface Topic {
  name: string;
  description: string;
}

export interface Question {
  id: string;
  topic: string;
  difficulty: "recall" | "conceptual" | "application";
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface AnswerResult {
  question_id: string;
  topic: string;
  question: string;
  selected_index: number;
  correct_index: number;
  correct: boolean;
  explanation: string;
  selected_option_text: string;
  correct_option_text: string;
}

export interface AssessmentResult {
  results: AnswerResult[];
  score: number;
  max_score: number;
}

export interface Session {
  id: string;
  fileName?: string;
  pages?: number;
  extractedText: string;
  pyqText?: string;
  topics: Topic[];
  questions: Question[];
  results?: AssessmentResult;
  knowledgeGaps: Record<string, KnowledgeGapStatus>;
  pyqRelevance?: Record<string, { questionCount: number; note: string }>;
  examDate?: string | null;
  availableStudyTimeMinutes?: number | null;
  createdAt: string;
}

