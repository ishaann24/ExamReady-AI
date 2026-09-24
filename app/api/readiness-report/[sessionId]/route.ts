import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = params;
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: `Session '${sessionId}' not found or access forbidden.` },
        { status: 404 }
      );
    }

    const totalTopics = session.topics?.length || 0;
    const knowledgeGaps = session.knowledgeGaps || {};
    const assessedTopics = Object.values(knowledgeGaps).filter(
      (s) => s !== "not_assessed"
    ).length;

    const strongTopics = Object.entries(knowledgeGaps)
      .filter(([, s]) => s === "strong")
      .map(([name]) => name);

    const remainingWeakTopics = Object.entries(knowledgeGaps)
      .filter(([, s]) => s === "weak" || s === "needs_revision")
      .map(([name]) => name);

    const diagnosticTotal = session.results?.results?.length || 0;
    const diagnosticCorrect =
      session.results?.results?.filter((r) => r.correct).length || 0;

    const followupTotal = 0;
    const followupCorrect = 0;

    return NextResponse.json({
      shareToken: session.shareToken,
      totalTopics,
      assessedTopics,
      strongTopics,
      remainingWeakTopics,
      diagnostic: { correct: diagnosticCorrect, total: diagnosticTotal },
      followup: { correct: followupCorrect, total: followupTotal },
    });
  } catch (error: any) {
    console.error("Readiness report API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch readiness report." },
      { status: 500 }
    );
  }
}
