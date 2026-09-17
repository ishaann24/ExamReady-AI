import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession, recordAttempt, updateTopicStatus, getTopicIdByName } from "@/lib/db";
import { AnswerResult, KnowledgeGapStatus, Question } from "@/lib/types";

export const runtime = "nodejs";

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

    const results: AnswerResult[] = [];

    for (const q of questions) {
      const selected_index = answers[q.id] ?? -1;
      const correct = selected_index === q.correct_index;

      if (correct) {
        score += 1;
      }

      if (q.id) {
        try {
          await recordAttempt(q.id, selected_index, correct);
        } catch (attErr) {
          console.error(`Failed to record attempt for question ${q.id}:`, attErr);
        }
      }

      results.push({
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
      });
    }

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

    // Save updated status in topics table
    const topicId = await getTopicIdByName(sessionId, topic);
    if (topicId) {
      try {
        await updateTopicStatus(topicId, updatedStatus);
      } catch (updateErr) {
        console.error(`Failed to update status for topic ${topic}:`, updateErr);
      }
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
