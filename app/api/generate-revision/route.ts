import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getSession, saveQuestions, getTopicIdByName, findRelevantChunks } from "@/lib/db";
import { callGemini } from "@/lib/gemini";
import { getCached, setCached } from "@/lib/gemini-cache";
import { Question, RevisionSession } from "@/lib/types";

export const runtime = "nodejs";
export type { RevisionSession };

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
    const { sessionId, topic } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'sessionId' parameter." },
        { status: 400 }
      );
    }

    if (!topic || typeof topic !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'topic' parameter." },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: `Session '${sessionId}' not found or forbidden.` },
        { status: 404 }
      );
    }

    // Retrieve topic-specific chunks via vector search
    let retrievedContext = "";
    const retrievedChunks = await findRelevantChunks(sessionId, topic, 4);

    if (retrievedChunks && retrievedChunks.length > 0) {
      retrievedContext = retrievedChunks
        .map((c) => `[Page ${c.pageNumber}]:\n${c.content}`)
        .join("\n\n---\n\n");
    } else if (session.extractedText && session.extractedText.trim()) {
      retrievedContext = `[Page 1]:\n${session.extractedText.slice(0, 15000)}`;
    } else {
      return NextResponse.json(
        { error: "No course content or retrieved lecture chunks found for this topic." },
        { status: 400 }
      );
    }

    // Find missed questions for this topic in session results
    const results = session.results?.results || [];
    const missedForTopic = results.filter(
      (r) => r.topic.toLowerCase() === topic.toLowerCase() && !r.correct
    );

    const missedContext =
      missedForTopic.length > 0
        ? missedForTopic
            .map(
              (m) =>
                `- Question: "${m.question}"\n  Student Selected: "${m.selected_option_text}"\n  Correct Choice: "${m.correct_option_text}"\n  Diagnostic Explanation: "${m.explanation}"`
            )
            .join("\n\n")
        : "No specific diagnostic questions were missed for this topic.";

    const saveFollowupQuestions = async (pQuestions: Question[]) => {
      const topicId = await getTopicIdByName(sessionId, topic);
      const topicNameToIdMap: Record<string, string> = {};
      if (topicId) {
        topicNameToIdMap[topic] = topicId;
      }

      const questionsToSave = pQuestions.map((q) => ({
        topic,
        difficulty: q.difficulty || "conceptual",
        question: q.question,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
        question_type: "followup",
        pageReferences: q.pageReferences || [],
      }));

      const savedRows = await saveQuestions(sessionId, topicNameToIdMap, questionsToSave);

      return savedRows.map((r, i) => ({
        id: r.id,
        topic,
        difficulty: (r.difficulty as any) || "conceptual",
        question: r.question_text,
        options: r.options,
        correct_index: r.correct_index,
        explanation: r.explanation || "",
        pageReferences: Array.isArray(r.page_references) && r.page_references.length > 0
          ? r.page_references
          : pQuestions[i]?.pageReferences || [],
      }));
    };

    // Compute cache key
    const cacheKey = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          sessionId,
          topic,
          contextHash: retrievedContext.slice(0, 500),
          missedCount: missedForTopic.length,
        })
      )
      .digest("hex");

    const cachedData = getCached(cacheKey);
    if (cachedData) {
      try {
        const parsed: RevisionSession = JSON.parse(cachedData);
        if (
          parsed &&
          parsed.explanation &&
          Array.isArray(parsed.practiceQuestions)
        ) {
          const savedPracticeQuestions = await saveFollowupQuestions(parsed.practiceQuestions);
          return NextResponse.json({
            ...parsed,
            practiceQuestions: savedPracticeQuestions,
          });
        }
      } catch (e) {
        // Fallback to API if cache fails
      }
    }

    const prompt = `You are a master academic tutor specializing in active recall and targeted revision.

Topic to Revise: "${topic}"

Student Diagnostic Performance Context:
${missedContext}

Retrieved Course Material Chunks:
${retrievedContext}

Instructions:
Generate a concise, targeted revision session for this topic grounded STRICTLY in the course material text above.
Include page number references corresponding to the page numbers in the provided chunks.

Return ONLY a valid JSON object matching this exact structure with NO markdown fences:
{
  "topic": "${topic}",
  "explanation": "A clear, focused 2-3 sentence explanation clarifying the core concept.",
  "example": "A concrete, practical example illustrating how this concept works in practice.",
  "commonMistake": "A specific common pitfall or misconception note, directly addressing why students miss questions on this topic.",
  "pageReferences": [1],
  "practiceQuestions": [
    {
      "id": "rq1",
      "topic": "${topic}",
      "difficulty": "conceptual",
      "question": "First practice MCQ question text...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "Clear explanation of the correct choice.",
      "pageReferences": [1]
    },
    {
      "id": "rq2",
      "topic": "${topic}",
      "difficulty": "application",
      "question": "Second practice MCQ question text...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 1,
      "explanation": "Clear explanation of the correct choice.",
      "pageReferences": [1]
    }
  ]
}`;

    const rawResponse = await callGemini(prompt);

    let cleanedResponse = rawResponse.trim();
    if (cleanedResponse.startsWith("```")) {
      cleanedResponse = cleanedResponse
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    }

    try {
      const parsed: RevisionSession = JSON.parse(cleanedResponse);

      if (
        !parsed ||
        !parsed.explanation ||
        !parsed.example ||
        !parsed.commonMistake ||
        !Array.isArray(parsed.practiceQuestions) ||
        parsed.practiceQuestions.length !== 2
      ) {
        throw new Error("Invalid response format from AI revision generator.");
      }

      setCached(cacheKey, JSON.stringify(parsed));
      const savedPracticeQuestions = await saveFollowupQuestions(parsed.practiceQuestions);

      return NextResponse.json({
        ...parsed,
        practiceQuestions: savedPracticeQuestions,
      });
    } catch (parseErr: any) {
      console.error("JSON Parse Error for Revision response:", rawResponse);
      return NextResponse.json(
        { error: `Failed to parse generated revision material: ${parseErr.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Generate Revision API Error:", error);
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred while generating revision." },
      { status: 500 }
    );
  }
}
