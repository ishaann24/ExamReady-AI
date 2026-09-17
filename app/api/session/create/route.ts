import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createExamSession, saveExtractedText } from "@/lib/db";

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
    const { subjectId, subjectName, examDate, studyTimeMinutes, extractedText } = body;

    let subjectInput: { subjectId?: string | null; subjectName?: string | null };

    if (subjectId && typeof subjectId === "string" && subjectId.trim()) {
      subjectInput = { subjectId: subjectId.trim() };
    } else {
      const finalSubjectName =
        subjectName && typeof subjectName === "string" && subjectName.trim()
          ? subjectName.trim()
          : "General Preparation";
      subjectInput = { subjectName: finalSubjectName };
    }

    const sessionId = await createExamSession(
      user.id,
      subjectInput,
      examDate || null,
      studyTimeMinutes ? Number(studyTimeMinutes) : null
    );

    if (extractedText) {
      await saveExtractedText(sessionId, extractedText);
    }

    return NextResponse.json({ id: sessionId, sessionId });
  } catch (error: any) {
    console.error("Create session error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create exam session" },
      { status: 500 }
    );
  }
}
