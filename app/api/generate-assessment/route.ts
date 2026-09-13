import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { callGemini } from "@/lib/gemini";
import { getCached, setCached } from "@/lib/gemini-cache";
import { saveSession } from "@/lib/db";
import { Question } from "@/lib/types";

export const runtime = "nodejs";
export type { Question };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, topics, sessionId } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'text' field in request body." },
        { status: 400 }
      );
    }

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'topics' array in request body." },
        { status: 400 }
      );
    }

    const saveQuestionsToSession = (qList: Question[]) => {
      if (sessionId) {
        saveSession(sessionId, { questions: qList });
      }
    };

    // Cache key based on sha256 hash of input text and topics
    const cacheKey = crypto
      .createHash("sha256")
      .update(JSON.stringify({ text, topics }))
      .digest("hex");

    const cachedData = getCached(cacheKey);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          saveQuestionsToSession(parsed.questions);
          return NextResponse.json({ questions: parsed.questions });
        }
      } catch (e) {
        // Fallback to API if cache fails
      }
    }

    const truncatedText = text.slice(0, 30000);
    const formattedTopics = topics
      .map((t: any, i: number) => `${i + 1}. ${t.name}: ${t.description}`)
      .join("\n");

    const prompt = `You are a rigorous academic evaluator. Generate exactly 6 multiple-choice diagnostic questions based ONLY on the provided course material text and identified topics.

Topics Identified:
${formattedTopics}

Requirements:
1. Generate exactly 6 questions total.
2. Distribute questions across the provided topics.
3. Mix difficulties evenly among "recall", "conceptual", and "application".
4. Each question MUST have exactly 4 options.
5. "correct_index" MUST be an integer from 0 to 3 corresponding to the correct option in "options".
6. "explanation" MUST provide a clear 1-2 sentence justification grounded directly in the course text.
7. Return ONLY valid JSON matching this exact structure, with no Markdown fences or extra text:

{
  "questions": [
    {
      "id": "q1",
      "topic": "Topic Name",
      "difficulty": "recall",
      "question": "Clear diagnostic question text...",
      "options": [
        "First option",
        "Second option",
        "Third option",
        "Fourth option"
      ],
      "correct_index": 0,
      "explanation": "Direct explanation referencing the course material."
    }
  ]
}

Course Material Text:
${truncatedText}`;

    const rawResponse = await callGemini(prompt);

    // Strip markdown code fences if present
    let cleanedResponse = rawResponse.trim();
    if (cleanedResponse.startsWith("```")) {
      cleanedResponse = cleanedResponse
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    }

    try {
      const parsed = JSON.parse(cleanedResponse);

      if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        throw new Error("Invalid response format: 'questions' array is missing or empty.");
      }

      // Basic schema validation
      for (const q of parsed.questions) {
        if (
          !q.question ||
          !Array.isArray(q.options) ||
          q.options.length !== 4 ||
          typeof q.correct_index !== "number"
        ) {
          throw new Error("One or more questions fail schema validation.");
        }
      }

      setCached(cacheKey, JSON.stringify(parsed));
      saveQuestionsToSession(parsed.questions);

      return NextResponse.json({ questions: parsed.questions });
    } catch (parseErr: any) {
      console.error("JSON Parse Error for Gemini response:", rawResponse);
      return NextResponse.json(
        { error: `Failed to parse generated questions: ${parseErr.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Generate Assessment API Error:", error);
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred while generating assessment." },
      { status: 500 }
    );
  }
}
