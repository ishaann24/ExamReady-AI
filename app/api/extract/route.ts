import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Helper to split DOCX extracted raw text into page-like chunks of ~500 words each.
 */
function chunkDocxText(fullText: string, wordsPerChunk: number = 500): Array<{ pageNumber: number; text: string }> {
  const cleanText = fullText.trim();
  if (!cleanText) {
    return [{ pageNumber: 1, text: "" }];
  }

  const words = cleanText.split(/\s+/);
  const chunks: Array<{ pageNumber: number; text: string }> = [];

  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunkWords = words.slice(i, i + wordsPerChunk);
    const chunkText = chunkWords.join(" ");
    const pageNumber = chunks.length + 1;
    chunks.push({ pageNumber, text: chunkText });
  }

  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No PDF or Word document provided under 'file' field" },
        { status: 400 }
      );
    }

    const fileName = file instanceof File ? file.name.toLowerCase() : "";
    const mimeType = file.type || "";
    const isDocx =
      fileName.endsWith(".docx") ||
      mimeType.includes("wordprocessingml") ||
      mimeType.includes("docx");

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (isDocx) {
      const mammothResult = await mammoth.extractRawText({ buffer });
      const fullText = mammothResult.value || "";
      const chunks = chunkDocxText(fullText, 500);

      return NextResponse.json({
        pages: chunks.length,
        chunks,
        text: fullText,
      });
    }

    // Default to PDF extraction
    const chunks: { pageNumber: number; text: string }[] = [];

    const pdfData = await pdfParse(buffer, {
      pagerender: async function (pageData: any) {
        const renderOptions = {
          normalizeWhitespace: false,
          disableCombineTextItems: false,
        };
        const textContent = await pageData.getTextContent(renderOptions);
        let lastY: number | undefined;
        let text = "";
        for (const item of textContent.items) {
          if (lastY === item.transform[5] || !lastY) {
            text += item.str;
          } else {
            text += "\n" + item.str;
          }
          lastY = item.transform[5];
        }
        const pageNumber = pageData.pageNumber;
        chunks.push({ pageNumber, text });
        return text;
      },
    });

    return NextResponse.json({
      pages: pdfData.numpages,
      chunks,
      text: pdfData.text,
    });
  } catch (error: any) {
    console.error("Text Extraction error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to extract text from file" },
      { status: 500 }
    );
  }
}
