import { NextRequest, NextResponse } from "next/server";
import { getSession, saveSession } from "@/lib/db";
import { AnswerResult, KnowledgeGapStatus, Question } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, topic, questions, answers } = body as {
      sessionId: string;
      topic: string;
      questions: Question[];
      answers: Record<string, number>;
    };

    if (!sessionId || !topic) {
      return NextResponse.json(
        { error: "Missing sessionId or topic parameter." },
        { status: 400 }
      );
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'questions' array." },
        { status: 400 }
      );
    }

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "Missing or invalid 'answers' object." },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);
    const previousStatus: KnowledgeGapStatus =
      session?.knowledgeGaps?.[topic] || "not_assessed";

    let score = 0;
    const max_score = questions.length;

    const results: AnswerResult[] = questions.map((q) => {
      const selected_index = answers[q.id] ?? -1;
      const correct = selected_index === q.correct_index;

      if (correct) {
        score += 1;
      }

      return {
        question_id: q.id,
        topic: q.topic || topic,
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

    let updatedStatus: KnowledgeGapStatus = previousStatus;
    let improved = false;

    if (score === max_score) {
      // Both correct -> "strong"
      updatedStatus = "strong";
      improved = true;
    } else if (score > 0) {
      // One correct -> "needs_revision"
      updatedStatus = "needs_revision";
      improved = previousStatus === "weak" || previousStatus === "not_assessed";
    } else {
      // Both incorrect -> keep as "weak"
      updatedStatus = "weak";
      improved = false;
    }

    // Save updated knowledgeGaps in session record
    if (session) {
      const updatedGaps = {
        ...(session.knowledgeGaps || {}),
        [topic]: updatedStatus,
      };
      await saveSession(sessionId, { knowledgeGaps: updatedGaps });
    }

    return NextResponse.json({
      results,
      updatedStatus,
      improved,
      score,
      max_score,
    });
  } catch (error: any) {
    console.error("Evaluate Follow-up API Error:", error);
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred while evaluating follow-up." },
      { status: 500 }
    );
  }
}
