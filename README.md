# ExamReady AI

AI-powered personalized exam preparation for college students — built for a Google hackathon.

## What it does

Instead of asking "what's in my lecture?", ExamReady AI helps students answer:
**"What should I study next, why, and how do I know if I actually understand it?"**

Students upload their lecture material (and optionally previous-year question papers), take a short AI-generated diagnostic assessment, and get a personalized, priority-ranked revision plan based on their actual knowledge gaps — not a generic summary of everything.

### The core loop

    Upload lecture PDF → AI extracts topics → Diagnostic assessment (6 MCQs)
        → Knowledge-gap detection → Priority engine ranks weak topics
        → Personalized revision session → Follow-up questions
        → Updated readiness report

This closed loop — **Assessment → Diagnosis → Intervention → Reassessment** — is the core differentiator from a typical "AI notes/quiz generator."

## Why this exists

Most AI study tools stop at "upload a PDF, get a summary or a quiz." That's not the hard part for a student — the hard part is figuring out *what to actually spend limited time on* before an exam. ExamReady AI combines two ideas:

- **Exam Crisis** — helping students prioritize what to study when time is limited
- **Lecture-to-Understanding** — identifying what a student actually understands vs. what just looks familiar

The product doesn't promise to predict exact exam marks, guarantee exam questions, or replace teachers. It helps students make better decisions about how to spend limited preparation time.

## Features

- 📄 PDF upload with AI-driven topic extraction, grounded only in the supplied material
- 🧠 Diagnostic assessment generated from the actual uploaded content (recall, conceptual, and application-level questions — not generic quiz filler)
- 📊 Knowledge-gap detection across four states: Strong / Needs Revision / Weak / Not Assessed
- 🎯 Priority engine — ranks what to study first, with a plain-language, explainable reason for every recommendation
- 📚 Optional previous-year paper analysis — when uploaded, recommendations cite real exam-relevance evidence (e.g. "appears in 3 questions across your previous papers") instead of gap-severity alone
- ✍️ Personalized revision sessions targeted at the specific concept a student got wrong, not a full re-explanation of the topic
- ✅ Follow-up reassessment that updates topic mastery status based on real performance, closing the learning loop
- 📈 Final readiness report summarizing what improved, what's still weak, and the next recommended action — using plain counts, never a fabricated "readiness score"
- 📥 Downloadable PDF export of the readiness report

## Tech stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **AI:** Google Gemini API (`gemini-3.6-flash`)
- **Storage:** Vercel KV (Redis-compatible, via Upstash)
- **PDF parsing (upload):** `pdf-parse`
- **PDF generation (export):** `@react-pdf/renderer`
- **Deployment:** Vercel

## Setup

### 1. Clone and install

    git clone <your-repo-url>
    cd examready-ai
    npm install

### 2. Environment variables

Create a `.env.local` file in the project root:

    GEMINI_API_KEY=your_gemini_api_key
    GEMINI_MODEL=gemini-3.6-flash
    KV_REST_API_URL=your_vercel_kv_url
    KV_REST_API_TOKEN=your_vercel_kv_token

- Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
- Get KV credentials by creating a KV database in your Vercel project dashboard (**Storage → Create Database → KV**), then running:

      vercel env pull .env.local

### 3. Run locally

    npm run dev

Visit `http://localhost:3000`.

### 4. Deploy

    npx vercel --prod

Before deploying, make sure all four environment variables above are also added under your Vercel project's **Settings → Environment Variables** (for both Production and Preview).

## How it works, end to end

1. **Upload** — student uploads a lecture PDF (and optionally previous-year papers) and enters exam context
2. **Extraction** — text is pulled from the PDF(s); Gemini identifies the major topics and subtopics grounded only in that material
3. **Diagnostic assessment** — Gemini generates 6 multiple-choice questions spanning recall, conceptual understanding, and application, tied to specific topics
4. **Evaluation** — answers are scored; correct/incorrect/partial status is recorded per topic
5. **Knowledge-gap detection** — each topic is classified as Strong, Needs Revision, Weak, or Not Assessed
6. **Priority engine** — non-strong topics are ranked using knowledge-gap severity, question difficulty, and (if available) previous-year-paper relevance, each with a plain-language reason
7. **Revision session** — the student picks (or is directed to) the top-priority topic and receives a focused explanation, an example, a note on their specific mistake, and 2 new practice questions
8. **Reassessment** — performance on the practice questions updates that topic's mastery status
9. **Readiness report** — a final summary of what improved, what's still weak, and the next recommended action, exportable as a PDF

## Project structure

    app/
      page.tsx                          Landing page
      new-session/                      Upload flow (lecture PDF + optional PYQ)
      assessment/                       Diagnostic assessment UI
      dashboard/[sessionId]/            Student dashboard — knowledge overview + next best action
      revision/[sessionId]/[topic]/     Personalized revision session
      report/[sessionId]/               Final readiness report + PDF export
      api/
        extract/                        Lecture PDF text extraction
        extract-pyq/                    Previous-year paper text extraction
        extract-topics/                 AI topic extraction
        analyze-pyq/                    AI exam-relevance analysis
        generate-assessment/            AI diagnostic question generation
        evaluate-assessment/            Diagnostic scoring
        knowledge-gaps/                 Gap classification + priority engine
        generate-revision/              AI revision session generation
        evaluate-followup/              Follow-up scoring + status update
        readiness-report/[sessionId]/   Readiness report aggregation
    lib/
      db.ts                             Session persistence (Vercel KV)
      gemini.ts                         Gemini API wrapper
      types.ts                          Shared TypeScript types
      pdf/readiness-report-pdf.tsx      PDF export template

## Design principles

- **Grounded generation** — every AI-generated question, explanation, and recommendation is based only on the student's own uploaded material; the system is instructed never to invent content beyond it
- **Explainable, not black-box** — every priority recommendation comes with a plain-English reason a student can actually evaluate
- **Honest about limits** — no fabricated readiness percentages, no promises of predicting exact exam questions or scores
- **Focused scope** — deliberately not a full LMS, chatbot, or attendance/calendar tool; one polished exam-prep flow, done well

## What's not included (by design)

- Multi-subject dashboard (currently one exam session at a time)
- User authentication (single-session use, no login flow)
- Support for file formats beyond PDF

## License

Built for hackathon submission purposes.
