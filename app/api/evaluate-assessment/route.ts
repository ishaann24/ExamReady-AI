import { NextRequest, NextResponse } from "next/server";
import { Question } from "../generate-assessment/route";
import { saveSession, getSession } from "@/lib/db";
import { AnswerResult, KnowledgeGapStatus } from "@/lib/types";

export const runtime = "nodejs";
export type { AnswerResult };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { questions, answers, sessionId } = body as {
      questions: Question[];
      answers: Record<string, number>;
      sessionId?: string;
    };

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'questions' array in request body." },
        { status: 400 }
      );
    }

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "Missing or invalid 'answers' object in request body." },
        { status: 400 }
      );
    }

    let score = 0;
    const max_score = questions.length;

    const topicStats: Record<string, { correct: number; total: number }> = {};

    const results: AnswerResult[] = questions.map((q) => {
      const selected_index = answers[q.id] ?? -1;
      const correct = selected_index === q.correct_index;

      if (correct) {
        score += 1;
      }

      if (!topicStats[q.topic]) {
        topicStats[q.topic] = { correct: 0, total: 0 };
      }
      topicStats[q.topic].total += 1;
      if (correct) {
        topicStats[q.topic].correct += 1;
      }

      return {
        question_id: q.id,
        topic: q.topic,
        question: q.question,
        selected_index,
        correct_index: q.correct_index,
        correct,
        explanation: q.explanation,
        selected_option_text:
          selected_index >= 0 && q.options[selected_index]
            ? q.options[selected_index]
            : "No answer selected",
        correct_option_text: q.options[q.correct_index] || "",
      };
    });

    const knowledgeGaps: Record<string, KnowledgeGapStatus> = {};
    for (const [topic, stats] of Object.entries(topicStats)) {
      const ratio = stats.total > 0 ? stats.correct / stats.total : 0;
      if (ratio === 1) {
        knowledgeGaps[topic] = "strong";
      } else if (ratio >= 0.5) {
        knowledgeGaps[topic] = "needs_revision";
      } else {
        knowledgeGaps[topic] = "weak";
      }
    }

    if (sessionId) {
      const existingSession = getSession(sessionId);
      const updatedGaps = {
        ...(existingSession?.knowledgeGaps || {}),
        ...knowledgeGaps,
      };

      saveSession(sessionId, {
        results: {
          results,
          score,
          max_score,
        },
        knowledgeGaps: updatedGaps,
      });
    }

    return NextResponse.json({
      results,
      score,
      max_score,
    });
  } catch (error: any) {
    console.error("Evaluate Assessment API Error:", error);
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred while evaluating assessment." },
      { status: 500 }
    );
  }
}
