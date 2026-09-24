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
  pageReferences?: number[];
}

export interface RevisionSession {
  topic: string;
  explanation: string;
  example: string;
  commonMistake: string;
  pageReferences?: number[];
  practiceQuestions: Question[];
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

export interface LectureChunk {
  id?: string;
  exam_session_id?: string;
  page_number?: number;
  pageNumber: number;
  content?: string;
  text: string;
  created_at?: string;
}

export interface Session {
  id: string;
  shareToken?: string;
  fileName?: string;
  pages?: number;
  extractedText: string;
  chunks?: LectureChunk[];
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


