import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReadinessReportPDF } from "@/lib/pdf/readiness-report-pdf";

export const runtime = "nodejs";

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

    const knowledgeGaps = session.knowledgeGaps || {};
    const strongTopics = Object.entries(knowledgeGaps)
      .filter(([, s]) => s === "strong")
      .map(([name]) => name);

    const remainingWeakTopics = Object.entries(knowledgeGaps)
      .filter(([, s]) => s === "weak" || s === "needs_revision")
      .map(([name]) => name);

    const improvedTopics = strongTopics.filter(
      (t) => !remainingWeakTopics.includes(t)
    );

    const diagnosticTotal = session.results?.results?.length || 0;
    const diagnosticCorrect =
      session.results?.results?.filter((r) => r.correct).length || 0;

    const pdfBuffer = await renderToBuffer(
      <ReadinessReportPDF
        subjectName={session.fileName || "Course Study Material"}
        examDate={new Date(session.createdAt || Date.now()).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        improvedTopics={improvedTopics}
        remainingWeakTopics={remainingWeakTopics}
        diagnosticCorrect={diagnosticCorrect}
        diagnosticTotal={diagnosticTotal}
        followupCorrect={0}
        followupTotal={0}
      />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="examready-report-${sessionId}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("PDF generation failed:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
