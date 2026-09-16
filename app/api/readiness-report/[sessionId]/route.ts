import { NextResponse } from "next/server";
import { getSession } from "@/lib/db";
import { KnowledgeGapStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: `Session '${sessionId}' not found.` }, { status: 404 });
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
  const diagnosticCorrect = session.results?.results?.filter((r) => r.correct).length || 0;

  // Follow-up results are not persisted; default to 0 counts.
  const followupTotal = 0;
  const followupCorrect = 0;

  return NextResponse.json({
    totalTopics,
    assessedTopics,
    strongTopics,
    remainingWeakTopics,
    diagnostic: { correct: diagnosticCorrect, total: diagnosticTotal },
    followup: { correct: followupCorrect, total: followupTotal },
  });
}
