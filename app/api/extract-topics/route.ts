import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { callGemini } from "@/lib/gemini";
import { getCached, setCached } from "@/lib/gemini-cache";
import { createClient } from "@/lib/supabase/server";
import { saveTopics } from "@/lib/db";
import { Topic } from "@/lib/types";

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
    const { text, sessionId } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'text' field in request body." },
        { status: 400 }
      );
    }

    const saveTopicsToSession = async (topicsList: Topic[]) => {
      if (sessionId) {
        const savedRows = await saveTopics(sessionId, topicsList);
        return savedRows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
        }));
      }
      return topicsList;
    };

    // Compute cache key using sha256 hash of input text
    const cacheKey = crypto.createHash("sha256").update(text).digest("hex");
    const cachedData = getCached(cacheKey);

    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed && Array.isArray(parsed.topics)) {
          const finalTopics = await saveTopicsToSession(parsed.topics);
          return NextResponse.json({ topics: finalTopics });
        }
      } catch (e) {
        // If cache read fails, proceed to call Gemini API
      }
    }

    // Limit text length to avoid token limits if document is massive
    const truncatedText = text.slice(0, 30000);

    const prompt = `You are an expert academic study assistant. Analyze the provided course material text and extract the key topics.

Return ONLY a valid JSON object matching this exact structure:
{
  "topics": [
    {
      "name": "Topic Name",
      "description": "A concise one-sentence description of the key concept."
    }
  ]
}

Rules:
- Extract between 3 and 8 distinct main topics.
- Keep descriptions clear, concise, and focused on core concepts.
- Do NOT output any markdown backticks, code fences, or text outside the JSON object.

Course Material Text:
${truncatedText}`;

    const rawResponse = await callGemini(prompt);

    // Strip markdown fences if present
    let cleanedResponse = rawResponse.trim();
    if (cleanedResponse.startsWith("```")) {
      cleanedResponse = cleanedResponse
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    }

    try {
      const parsed = JSON.parse(cleanedResponse);

      if (!parsed || !Array.isArray(parsed.topics)) {
        throw new Error("Invalid response format: 'topics' array is missing.");
      }

      // Save parsed result to local cache
      setCached(cacheKey, JSON.stringify(parsed));

      const finalTopics = await saveTopicsToSession(parsed.topics);

      return NextResponse.json({ topics: finalTopics });
    } catch (parseErr: any) {
      console.error("JSON Parse Error for Gemini response:", rawResponse);
      return NextResponse.json(
        { error: `Failed to parse AI topic response: ${parseErr.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Extract Topics API Error:", error);
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred while extracting topics." },
      { status: 500 }
    );
  }
}
