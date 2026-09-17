import { NextRequest, NextResponse } from "next/server";
import { Question } from "../generate-assessment/route";
import { createClient } from "@/lib/supabase/server";
import { recordAttempt } from "@/lib/db";
import { AnswerResult } from "@/lib/types";

export const runtime = "nodejs";
export type { AnswerResult };

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
    const { questions, answers } = body as {
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

    const results: AnswerResult[] = [];

    for (const q of questions) {
      const selected_index = answers[q.id] ?? -1;
      const correct = selected_index === q.correct_index;

      if (correct) {
        score += 1;
      }

      // Record attempt in database if q.id is present
      if (q.id) {
        try {
          await recordAttempt(q.id, selected_index, correct);
        } catch (attErr) {
          console.error(`Failed to record attempt for question ${q.id}:`, attErr);
        }
      }

      results.push({
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
