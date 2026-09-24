import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession, updateTopicStatus, getTopicIdByName } from "@/lib/db";
import { KnowledgeGapStatus, Question, AnswerResult } from "@/lib/types";
import {
  classifyTopicStatus,
  calculatePriorityScore,
  formatTopicReason,
} from "@/lib/priority-engine";

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

    // Max PYQ count across topics for relative scaling
    const maxPyqCount = session.pyqRelevance
      ? Math.max(
          ...Object.values(session.pyqRelevance).map((v) => v.questionCount || 0),
          1
        )
      : 1;

    for (const topic of topics) {
      const tResults = topicResults[topic.name] || [];
      const totalQuestions = tResults.length;
      const correctQuestions = tResults.filter((r) => r.correct).length;

      const status = classifyTopicStatus(tResults);
      const pyqInfo = session.pyqRelevance?.[topic.name];
      const pyqQuestionCount = pyqInfo?.questionCount || 0;

      const reason = formatTopicReason(
        status,
        totalQuestions,
        correctQuestions,
        pyqQuestionCount
      );

      knowledgeGaps[topic.name] = status;

      // Update topic status in Supabase Postgres topics table
      const topicId = await getTopicIdByName(sessionId, topic.name);
      if (topicId) {
        try {
          await updateTopicStatus(topicId, status);
        } catch (updateErr) {
          console.error(
            `Failed to update status for topic ${topic.name}:`,
            updateErr
          );
        }
      }

      // Compute average difficulty for missed questions
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

      const priorityScore = calculatePriorityScore(
        topic.name,
        status,
        avgDifficultyScore,
        pyqQuestionCount > 0 ? { questionCount: pyqQuestionCount, maxCount: maxPyqCount } : 0
      );

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
      {
        error:
          error?.message ||
          "An error occurred while evaluating knowledge gaps.",
      },
      { status: 500 }
    );
  }
}
