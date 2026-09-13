import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSession } from "@/lib/db";
import { callGemini } from "@/lib/gemini";
import { getCached, setCached } from "@/lib/gemini-cache";
import { Question } from "@/lib/types";

export const runtime = "nodejs";

export interface RevisionSession {
  topic: string;
  explanation: string;
  example: string;
  commonMistake: string;
  practiceQuestions: Question[];
}

export async function POST(req: NextRequest) {
  try {
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

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: `Session '${sessionId}' not found.` },
        { status: 404 }
      );
    }

    const text = session.extractedText || "";

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

    // Compute cache key
    const cacheKey = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          sessionId,
          topic,
          textLength: text.length,
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
          return NextResponse.json(parsed);
        }
      } catch (e) {
        // Fallback to API if cache fails
      }
    }

    const truncatedText = text.slice(0, 30000);

    const prompt = `You are a master academic tutor specializing in active recall and targeted revision.

Topic to Revise: "${topic}"

Student Diagnostic Performance Context:
${missedContext}

Course Material Text:
${truncatedText}

Instructions:
Generate a concise, targeted revision session for this topic grounded STRICTLY in the course material text above.

Return ONLY a valid JSON object matching this exact structure with NO markdown fences:
{
  "topic": "${topic}",
  "explanation": "A clear, focused 2-3 sentence explanation clarifying the core concept.",
  "example": "A concrete, practical example illustrating how this concept works in practice.",
  "commonMistake": "A specific common pitfall or misconception note, directly addressing why students miss questions on this topic.",
  "practiceQuestions": [
    {
      "id": "rq1",
      "topic": "${topic}",
      "difficulty": "conceptual",
      "question": "First practice MCQ question text...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "Clear explanation of the correct choice."
    },
    {
      "id": "rq2",
      "topic": "${topic}",
      "difficulty": "application",
      "question": "Second practice MCQ question text...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 1,
      "explanation": "Clear explanation of the correct choice."
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

      return NextResponse.json(parsed);
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
