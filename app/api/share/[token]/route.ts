import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    if (!token) {
      return NextResponse.json(
        { error: "This link is invalid or has expired" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Fetch session by share_token without checking auth
    const { data: sessionRow, error: sessionErr } = await supabase
      .from("exam_sessions")
      .select("id, created_at, subjects(name)")
      .eq("share_token", token)
      .maybeSingle();

    if (sessionErr || !sessionRow) {
      return NextResponse.json(
        { error: "This link is invalid or has expired" },
        { status: 404 }
      );
    }

    const sessionId = sessionRow.id;

    // 2. Fetch topics for this session
    const { data: topicRows } = await supabase
      .from("topics")
      .select("*")
      .eq("exam_session_id", sessionId)
      .order("created_at", { ascending: true });

    const totalTopics = topicRows?.length || 0;
    const knowledgeGaps: Record<string, string> = (topicRows || []).reduce(
      (acc, t) => {
        acc[t.name] = t.status || "not_assessed";
        return acc;
      },
      {} as Record<string, string>
    );

    const assessedTopics = Object.values(knowledgeGaps).filter(
      (s) => s !== "not_assessed"
    ).length;

    const strongTopics = Object.entries(knowledgeGaps)
      .filter(([, s]) => s === "strong")
      .map(([name]) => name);

    const remainingWeakTopics = Object.entries(knowledgeGaps)
      .filter(([, s]) => s === "weak" || s === "needs_revision")
      .map(([name]) => name);

    // 3. Fetch questions & attempts for diagnostic stats
    const { data: questionRows } = await supabase
      .from("questions")
      .select("id")
      .eq("exam_session_id", sessionId);

    const questionIds = (questionRows || []).map((q) => q.id);
    let diagnosticTotal = questionIds.length;
    let diagnosticCorrect = 0;

    if (questionIds.length > 0) {
      const { data: attempts } = await supabase
        .from("attempts")
        .select("correct")
        .in("question_id", questionIds);

      if (attempts) {
        diagnosticCorrect = attempts.filter((a) => a.correct).length;
      }
    }

    const sessionName =
      (sessionRow.subjects as any)?.name || "Course Study Material";

    const formattedTopics = (topicRows || []).map((t) => ({
      name: t.name,
      description: t.description || "",
      status: t.status || "not_assessed",
    }));

    return NextResponse.json({
      sessionName,
      createdAt: sessionRow.created_at,
      report: {
        totalTopics,
        assessedTopics,
        strongTopics,
        remainingWeakTopics,
        diagnostic: { correct: diagnosticCorrect, total: diagnosticTotal },
        followup: { correct: 0, total: 0 },
      },
      topics: formattedTopics,
    });
  } catch (error: any) {
    console.error("Public share API error:", error);
    return NextResponse.json(
      { error: "This link is invalid or has expired" },
      { status: 500 }
    );
  }
}
