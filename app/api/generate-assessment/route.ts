import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { callGemini } from "@/lib/gemini";
import { getCached, setCached } from "@/lib/gemini-cache";
import { createClient } from "@/lib/supabase/server";
import { saveQuestions, getSession, findRelevantChunks } from "@/lib/db";
import { Question } from "@/lib/types";

export const runtime = "nodejs";
export type { Question };

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
    const { text, topics, sessionId } = body;

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'topics' array in request body." },
        { status: 400 }
      );
    }

    // Retrieve relevant chunks for each topic
    let retrievedContext = "";
    const allRetrievedChunks: Array<{ pageNumber: number; content: string; topicName: string }> = [];

    if (sessionId) {
      for (const t of topics) {
        const tName = typeof t === "string" ? t : t.name;
        const tDesc = typeof t === "object" ? t.description || "" : "";
        const query = `${tName} ${tDesc}`.trim();

        try {
          const chunks = await findRelevantChunks(sessionId, query, 3);
          for (const c of chunks) {
            allRetrievedChunks.push({
              pageNumber: c.pageNumber,
              content: c.content,
              topicName: tName,
            });
          }
        } catch (err) {
          console.error(`Error retrieving chunks for topic '${tName}':`, err);
        }
      }
    }

    if (allRetrievedChunks.length > 0) {
      // Deduplicate chunks by page number & content snippet
      const seen = new Set<string>();
      retrievedContext = allRetrievedChunks
        .filter((c) => {
          const key = `${c.pageNumber}-${c.content.slice(0, 50)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((c) => `[Page ${c.pageNumber}] (${c.topicName}):\n${c.content}`)
        .join("\n\n---\n\n");
    } else if (text && typeof text === "string" && text.trim()) {
      // Fallback if no vector chunks found yet
      retrievedContext = `[Page 1]:\n${text.slice(0, 15000)}`;
    } else {
      return NextResponse.json(
        { error: "No course content or retrieved lecture chunks found." },
        { status: 400 }
      );
    }

    const saveQuestionsToSession = async (qList: any[]) => {
      if (!sessionId) return qList;

      const session = await getSession(sessionId);
      const topicNameToIdMap: Record<string, string> = {};

      if (session && session.topics) {
        const { data: dbTopics } = await supabase
          .from("topics")
          .select("id, name")
          .eq("exam_session_id", sessionId);

        (dbTopics || []).forEach((t) => {
          topicNameToIdMap[t.name] = t.id;
        });
      }

      const savedRows = await saveQuestions(sessionId, topicNameToIdMap, qList);

      return savedRows.map((r, i) => {
        const topicName =
          Object.keys(topicNameToIdMap).find(
            (k) => topicNameToIdMap[k] === r.topic_id
          ) || qList[i]?.topic || "";
        return {
          id: r.id,
          topic: topicName,
          difficulty: r.difficulty || "conceptual",
          question: r.question_text,
          options: r.options,
          correct_index: r.correct_index,
          explanation: r.explanation,
          pageReferences: Array.isArray(r.page_references) && r.page_references.length > 0
            ? r.page_references
            : qList[i]?.pageReferences || [],
        };
      });
    };

    const cacheKey = crypto
      .createHash("sha256")
      .update(JSON.stringify({ sessionId, topics, contextHash: retrievedContext.slice(0, 500) }))
      .digest("hex");

    const cachedData = getCached(cacheKey);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          const finalQuestions = await saveQuestionsToSession(parsed.questions);
          return NextResponse.json({ questions: finalQuestions });
        }
      } catch (e) {
        // Cache miss fallback
      }
    }

    const formattedTopics = topics
      .map((t: any, i: number) => `${i + 1}. ${t.name}: ${t.description || ""}`)
      .join("\n");

    const prompt = `You are a rigorous academic evaluator. Generate exactly 6 multiple-choice diagnostic questions based ONLY on the retrieved course material chunks below.

Topics Identified:
${formattedTopics}

Requirements:
1. Generate exactly 6 questions total.
2. Distribute questions across the provided topics.
3. Mix difficulties evenly among "recall", "conceptual", and "application".
4. Each question MUST have exactly 4 options.
5. "correct_index" MUST be an integer from 0 to 3 corresponding to the correct option in "options".
6. "explanation" MUST provide a clear 1-2 sentence justification grounded directly in the provided material.
7. "pageReferences" MUST be an array of page integers (e.g., [4] or [4, 12]) corresponding to the page numbers in the retrieved text where this concept is found.
8. Return ONLY valid JSON matching this exact structure, with no Markdown fences:

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
      "explanation": "Direct explanation referencing the course material.",
      "pageReferences": [1]
    }
  ]
}

Retrieved Course Material Chunks:
${retrievedContext}`;

    const rawResponse = await callGemini(prompt);

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
      const finalQuestions = await saveQuestionsToSession(parsed.questions);

      return NextResponse.json({ questions: finalQuestions });
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

