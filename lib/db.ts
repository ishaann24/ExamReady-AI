import { createClient } from "./supabase/server";
import { Session, Topic, Question, AnswerResult, AssessmentResult, KnowledgeGapStatus } from "./types";
import { embedText } from "./embeddings";

/**
 * Creates a subjects row for the user if one doesn't exist with that exact name,
 * then creates an exam_sessions row linked to it.
 * Returns the new exam_sessions id.
 */
export async function createExamSession(
  userId: string,
  subjectInput: string | { subjectId?: string | null; subjectName?: string | null },
  examDate: string | null = null,
  studyTimeMinutes: number | null = null
): Promise<string> {
  const supabase = await createClient();

  let targetSubjectId: string | null = null;

  const normalizedInput =
    typeof subjectInput === "string"
      ? { subjectName: subjectInput }
      : subjectInput;

  if (normalizedInput.subjectId) {
    // Verify subject exists and belongs to this user
    const { data: subject, error: findSubjectErr } = await supabase
      .from("subjects")
      .select("id")
      .eq("id", normalizedInput.subjectId)
      .eq("user_id", userId)
      .maybeSingle();

    if (findSubjectErr || !subject) {
      throw new Error("Specified subject was not found or access forbidden.");
    }
    targetSubjectId = subject.id;
  } else if (normalizedInput.subjectName) {
    // Find or create subject by name for this user
    const nameToUse = normalizedInput.subjectName.trim() || "General Preparation";
    let { data: subject, error: findSubjectErr } = await supabase
      .from("subjects")
      .select("id")
      .eq("user_id", userId)
      .eq("name", nameToUse)
      .maybeSingle();

    if (findSubjectErr) {
      throw new Error(`Error searching subjects: ${findSubjectErr.message}`);
    }

    if (!subject) {
      const { data: newSubject, error: createSubjectErr } = await supabase
        .from("subjects")
        .insert({ user_id: userId, name: nameToUse })
        .select("id")
        .single();

      if (createSubjectErr || !newSubject) {
        throw new Error(`Failed to create subject: ${createSubjectErr?.message}`);
      }
      subject = newSubject;
    }
    targetSubjectId = subject.id;
  } else {
    throw new Error("Must provide either subjectId or subjectName.");
  }

  // 2. Create exam session
  const { data: session, error: createSessionErr } = await supabase
    .from("exam_sessions")
    .insert({
      subject_id: targetSubjectId,
      exam_date: examDate,
      available_study_time_minutes: studyTimeMinutes,
    })
    .select("id")
    .single();

  if (createSessionErr || !session) {
    throw new Error(`Failed to create exam session: ${createSessionErr?.message}`);
  }

  return session.id;
}

/**
 * Retrieves an exam session and joins related topics, questions, attempts, and PYQ relevance.
 * Returns object matching the Session interface.
 */
export async function getSession(examSessionId: string): Promise<Session | null> {
  const supabase = await createClient();

  // 1. Fetch exam session
  const { data: sessionRow, error: sessionErr } = await supabase
    .from("exam_sessions")
    .select("*, subjects(name)")
    .eq("id", examSessionId)
    .maybeSingle();

  if (sessionErr || !sessionRow) {
    return null;
  }

  // 2. Fetch topics
  const { data: topicRows } = await supabase
    .from("topics")
    .select("*")
    .eq("exam_session_id", examSessionId)
    .order("created_at", { ascending: true });

  const topicsList: Topic[] = (topicRows || []).map((t) => ({
    name: t.name,
    description: t.description || "",
  }));

  const knowledgeGaps: Record<string, KnowledgeGapStatus> = (topicRows || []).reduce(
    (acc, t) => {
      acc[t.name] = (t.status as KnowledgeGapStatus) || "not_assessed";
      return acc;
    },
    {} as Record<string, KnowledgeGapStatus>
  );

  // 3. Fetch questions
  const { data: questionRows } = await supabase
    .from("questions")
    .select("*")
    .eq("exam_session_id", examSessionId)
    .order("created_at", { ascending: true });

  const questions: Question[] = (questionRows || []).map((q) => {
    const topicName =
      (topicRows || []).find((t) => t.id === q.topic_id)?.name || "";
    return {
      id: q.id,
      topic: topicName,
      difficulty: (q.difficulty as any) || "conceptual",
      question: q.question_text,
      options: Array.isArray(q.options) ? q.options : [],
      correct_index: q.correct_index,
      explanation: q.explanation || "",
      pageReferences: Array.isArray(q.page_references) ? q.page_references : [],
    };
  });

  // 4. Fetch attempts
  const questionIds = (questionRows || []).map((q) => q.id);
  let attemptsRows: any[] = [];
  if (questionIds.length > 0) {
    const { data: attempts } = await supabase
      .from("attempts")
      .select("*")
      .in("question_id", questionIds)
      .order("attempted_at", { ascending: true });
    attemptsRows = attempts || [];
  }

  const answerResults: AnswerResult[] = attemptsRows.map((att) => {
    const q = (questionRows || []).find((q) => q.id === att.question_id);
    const topicName = (topicRows || []).find((t) => t.id === q?.topic_id)?.name || "";
    const options = Array.isArray(q?.options) ? q.options : [];
    return {
      question_id: att.question_id,
      topic: topicName,
      question: q?.question_text || "",
      selected_index: att.selected_index,
      correct_index: q?.correct_index ?? 0,
      correct: att.correct,
      explanation: q?.explanation || "",
      selected_option_text: options[att.selected_index] || "",
      correct_option_text: options[q?.correct_index ?? 0] || "",
    };
  });

  const resultsObj: AssessmentResult | undefined =
    answerResults.length > 0
      ? {
          results: answerResults,
          score: answerResults.filter((r) => r.correct).length,
          max_score: answerResults.length,
        }
      : undefined;

  // 5. Fetch PYQ relevance
  const { data: pyqRows } = await supabase
    .from("pyq_relevance")
    .select("*")
    .eq("exam_session_id", examSessionId);

  const pyqRelevance: Record<string, { questionCount: number; note: string }> = {};
  (pyqRows || []).forEach((row) => {
    const tName = (topicRows || []).find((t) => t.id === row.topic_id)?.name;
    if (tName) {
      pyqRelevance[tName] = {
        questionCount: row.question_count,
        note: row.note || "",
      };
    }
  });

  // 6. Fetch lecture chunks
  const { data: chunkRows } = await supabase
    .from("lecture_chunks")
    .select("*")
    .eq("exam_session_id", examSessionId)
    .order("page_number", { ascending: true });

  const chunksList = (chunkRows || []).map((c) => ({
    id: c.id,
    pageNumber: c.page_number,
    text: c.content,
  }));

  return {
    id: sessionRow.id,
    shareToken: sessionRow.share_token || undefined,
    fileName: (sessionRow.subjects as any)?.name || "Course Study Material",
    extractedText: sessionRow.extracted_text || "",
    chunks: chunksList.length > 0 ? chunksList : undefined,
    pyqText: sessionRow.pyq_text || undefined,
    examDate: sessionRow.exam_date || null,
    availableStudyTimeMinutes: sessionRow.available_study_time_minutes || null,
    topics: topicsList,
    questions,
    results: resultsObj,
    knowledgeGaps,
    pyqRelevance: Object.keys(pyqRelevance).length > 0 ? pyqRelevance : undefined,
    createdAt: sessionRow.created_at,
  };
}

/**
 * Regenerates the share_token for an exam session, invalidating any previous share link.
 */
export async function regenerateShareToken(sessionId: string): Promise<string> {
  const supabase = await createClient();
  const newShareToken = crypto.randomUUID();

  const { data, error } = await supabase
    .from("exam_sessions")
    .update({ share_token: newShareToken })
    .eq("id", sessionId)
    .select("share_token")
    .single();

  if (error || !data) {
    throw new Error(`Failed to regenerate share token: ${error?.message || "Unknown error"}`);
  }

  return data.share_token;
}

/**
 * Saves page-level lecture chunks for an exam session into lecture_chunks table,
 * computing 384-dimensional embeddings for each chunk.
 */
export async function saveLectureChunks(
  examSessionId: string,
  chunks: Array<{ pageNumber?: number; page_number?: number; text?: string; content?: string }>
) {
  if (!chunks || chunks.length === 0) return [];
  const supabase = await createClient();

  const rows = await Promise.all(
    chunks.map(async (c) => {
      const pageNumber = c.pageNumber ?? c.page_number ?? 1;
      const content = c.text ?? c.content ?? "";
      let embedding: number[] | null = null;
      if (content.trim()) {
        try {
          embedding = await embedText(content);
        } catch (err) {
          console.error(`Failed to generate embedding for page ${pageNumber}:`, err);
        }
      }
      return {
        exam_session_id: examSessionId,
        page_number: pageNumber,
        content: content,
        embedding: embedding,
      };
    })
  );

  const { data, error } = await supabase
    .from("lecture_chunks")
    .insert(rows)
    .select("*");

  if (error) {
    throw new Error(`Failed to save lecture chunks: ${error.message}`);
  }

  return data;
}

/**
 * Retrieves lecture_chunks for an exam session ordered by page_number.
 */
export async function getLectureChunks(examSessionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lecture_chunks")
    .select("*")
    .eq("exam_session_id", examSessionId)
    .order("page_number", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch lecture chunks: ${error.message}`);
  }

  return data || [];
}

/**
 * Embeds the query text and uses pgvector cosine similarity search to find
 * the topK most relevant lecture chunks for an exam session.
 */
export async function findRelevantChunks(
  examSessionId: string,
  query: string,
  topK: number = 3
): Promise<Array<{ id: string; pageNumber: number; content: string; similarity?: number }>> {
  if (!query || !query.trim()) {
    return [];
  }

  const queryEmbedding = await embedText(query);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("match_lecture_chunks", {
    query_embedding: queryEmbedding,
    match_session_id: examSessionId,
    match_count: topK,
  });

  if (error) {
    console.error("RPC match_lecture_chunks error (falling back to simple query):", error.message);
    const { data: chunksData } = await supabase
      .from("lecture_chunks")
      .select("*")
      .eq("exam_session_id", examSessionId)
      .limit(topK);

    return (chunksData || []).map((c: any) => ({
      id: c.id,
      pageNumber: c.page_number,
      content: c.content,
    }));
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    pageNumber: row.page_number,
    content: row.content,
    similarity: row.similarity,
  }));
}

/**
 * Saves extracted text for an exam session.
 */
export async function saveExtractedText(examSessionId: string, extractedText: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_sessions")
    .update({ extracted_text: extractedText })
    .eq("id", examSessionId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save extracted text: ${error.message}`);
  }

  return data;
}

/**
 * Inserts topics for an exam session into the topics table.
 */
export async function saveTopics(
  examSessionId: string,
  topics: { name: string; description: string }[]
) {
  const supabase = await createClient();
  const rows = topics.map((t) => ({
    exam_session_id: examSessionId,
    name: t.name,
    description: t.description,
    status: "not_assessed",
  }));

  const { data, error } = await supabase
    .from("topics")
    .insert(rows)
    .select("*");

  if (error) {
    throw new Error(`Failed to save topics: ${error.message}`);
  }

  return data;
}

/**
 * Inserts questions for an exam session into the questions table, mapping topic names to topic IDs.
 */
export async function saveQuestions(
  examSessionId: string,
  topicNameToIdMap: Record<string, string>,
  questions: {
    topic: string;
    difficulty?: string;
    question: string;
    options: string[];
    correct_index: number;
    explanation?: string;
    question_type?: string;
    pageReferences?: number[];
    page_references?: number[];
  }[]
) {
  const supabase = await createClient();
  const rows = questions.map((q) => ({
    exam_session_id: examSessionId,
    topic_id: topicNameToIdMap[q.topic] || null,
    question_text: q.question,
    options: q.options,
    correct_index: q.correct_index,
    explanation: q.explanation || "",
    difficulty: q.difficulty || "conceptual",
    question_type: q.question_type || "diagnostic",
    page_references: q.pageReferences || q.page_references || [],
  }));

  const { data, error } = await supabase
    .from("questions")
    .insert(rows)
    .select("*");

  if (error) {
    throw new Error(`Failed to save questions: ${error.message}`);
  }

  return data;
}

/**
 * Inserts an attempt row into the attempts table.
 */
export async function recordAttempt(
  questionId: string,
  selectedIndex: number,
  correct: boolean
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attempts")
    .insert({
      question_id: questionId,
      selected_index: selectedIndex,
      correct,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to record attempt: ${error.message}`);
  }

  return data;
}

/**
 * Updates the status and updated_at timestamp of a topic.
 */
export async function updateTopicStatus(topicId: string, status: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", topicId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update topic status: ${error.message}`);
  }

  return data;
}

/**
 * Updates the pyq_text column in exam_sessions.
 */
export async function savePyqText(examSessionId: string, pyqText: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_sessions")
    .update({ pyq_text: pyqText })
    .eq("id", examSessionId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save PYQ text: ${error.message}`);
  }

  return data;
}

/**
 * Inserts a pyq_relevance record for a topic and exam session.
 */
export async function savePyqRelevance(
  examSessionId: string,
  topicId: string,
  questionCount: number,
  note: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pyq_relevance")
    .insert({
      exam_session_id: examSessionId,
      topic_id: topicId,
      question_count: questionCount,
      note,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save PYQ relevance: ${error.message}`);
  }

  return data;
}

/**
 * Helper to resolve a topic name to its UUID for a specific exam session.
 */
export async function getTopicIdByName(
  examSessionId: string,
  topicName: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id")
    .eq("exam_session_id", examSessionId)
    .ilike("name", topicName)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.id;
}
