import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession, updateTopicStatus, getTopicIdByName } from "@/lib/db";
import { KnowledgeGapStatus, Question, AnswerResult } from "@/lib/types";

export const runtime = "nodejs";

export interface PrioritizedTopic {
  name: string;
  description: string;
  status: KnowledgeGapStatus;
  priorityScore: number;
  reason: string;
  totalQuestions: number;
  correctQuestions: number;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'sessionId' parameter." },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: `Session '${sessionId}' not found.` },
        { status: 404 }
      );
    }

    const topics = session.topics || [];
    const questions = session.questions || [];
    const results = session.results?.results || [];

    // Map questions by ID for difficulty lookup
    const questionMap: Record<string, Question> = {};
    questions.forEach((q) => {
      questionMap[q.id] = q;
    });

    // Group results per topic
    const topicResults: Record<string, AnswerResult[]> = {};
    results.forEach((res) => {
      if (!topicResults[res.topic]) {
        topicResults[res.topic] = [];
      }
      topicResults[res.topic].push(res);
    });

    const knowledgeGaps: Record<string, KnowledgeGapStatus> = {};
    const prioritizedTopics: PrioritizedTopic[] = [];

    for (const topic of topics) {
      const tResults = topicResults[topic.name] || [];
      const totalQuestions = tResults.length;

      let status: KnowledgeGapStatus = "not_assessed";
      let correctQuestions = 0;
      let reason = "Not assessed in diagnostic quiz.";

      if (totalQuestions > 0) {
        correctQuestions = tResults.filter((r) => r.correct).length;
        if (correctQuestions === totalQuestions) {
          status = "strong";
          reason = `Mastered all ${totalQuestions} question${totalQuestions === 1 ? "" : "s"} on this topic.`;
        } else if (correctQuestions === 0) {
          status = "weak";
          const pyqInfo = (session.pyqRelevance && session.pyqRelevance[topic.name])
            ? `, and it appears in ${session.pyqRelevance[topic.name].questionCount} question${session.pyqRelevance[topic.name].questionCount === 1 ? "" : "s"} across your previous-year papers`
            : "";
          reason = `Missed ${totalQuestions} of ${totalQuestions} question${totalQuestions === 1 ? "" : "s"} on this topic${pyqInfo}.`;
        } else {
          status = "needs_revision";
          const missedCount = totalQuestions - correctQuestions;
          const pyqInfo = (session.pyqRelevance && session.pyqRelevance[topic.name])
            ? `, and it appears in ${session.pyqRelevance[topic.name].questionCount} question${session.pyqRelevance[topic.name].questionCount === 1 ? "" : "s"} across your previous-year papers`
            : "";
          reason = `Missed ${missedCount} of ${totalQuestions} question${totalQuestions === 1 ? "" : "s"} on this topic${pyqInfo}.`;
        }
      }

      knowledgeGaps[topic.name] = status;

      // Update topic status in Supabase Postgres topics table
      const topicId = await getTopicIdByName(sessionId, topic.name);
      if (topicId) {
        try {
          await updateTopicStatus(topicId, status);
        } catch (updateErr) {
          console.error(`Failed to update status for topic ${topic.name}:`, updateErr);
        }
      }

      // Calculate Priority Score per non-strong topic
      // priority = (0.5 * gapSeverity) + (0.2 * difficulty) + (0.3 * examRelevance)
      let gapSeverity = 0;
      if (status === "weak") gapSeverity = 1.0;
      else if (status === "needs_revision") gapSeverity = 0.5;
      else if (status === "not_assessed") gapSeverity = 0.3;
      else gapSeverity = 0.0; // strong

      const missedResults = tResults.filter((r) => !r.correct);
      let avgDifficultyScore = 0.5;

      if (missedResults.length > 0) {
        const difficultyWeights: Record<string, number> = {
          application: 1.0,
          conceptual: 0.7,
          recall: 0.4,
        };
        const sum = missedResults.reduce((acc, r) => {
          const q = questionMap[r.question_id];
          const diff = q?.difficulty || "conceptual";
          return acc + (difficultyWeights[diff] || 0.7);
        }, 0);
        avgDifficultyScore = sum / missedResults.length;
      }

      let examRelevance = 0;
      if (session.pyqRelevance && session.pyqRelevance[topic.name]) {
        const maxCount = Math.max(
          ...Object.values(session.pyqRelevance).map((v) => v.questionCount || 0),
          1
        );
        examRelevance = session.pyqRelevance[topic.name].questionCount / maxCount;
      }

      const priorityScore =
        status === "strong"
          ? 0
          : Number((0.5 * gapSeverity + 0.2 * avgDifficultyScore + 0.3 * examRelevance).toFixed(3));

      prioritizedTopics.push({
        name: topic.name,
        description: topic.description,
        status,
        priorityScore,
        reason,
        totalQuestions,
        correctQuestions,
      });
    }

    // Sort topics by priorityScore descending
    prioritizedTopics.sort((a, b) => b.priorityScore - a.priorityScore);

    return NextResponse.json({
      knowledgeGaps,
      prioritizedTopics,
    });
  } catch (error: any) {
    console.error("Knowledge Gaps API Error:", error);
    return NextResponse.json(
      { error: error?.message || "An error occurred while evaluating knowledge gaps." },
      { status: 500 }
    );
  }
}
