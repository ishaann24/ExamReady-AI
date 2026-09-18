# ExamReady AI

**AI-powered personalized exam preparation for college students.** Originally built for a Google hackathon, now developed into a full multi-user product.

Live loop: upload lecture material → get diagnosed on what you actually understand → get told what to study first and why → revise the specific thing you got wrong → prove you improved → see it reflected on your dashboard.

**Live deployment:** https://examreadyai-jet.vercel.app/

---

## The problem this solves

Most AI study tools stop at "upload a PDF, get a summary or a quiz." That's not actually the hard part for a student under time pressure — the hard part is knowing **what to spend limited time on**, and whether you actually understand something or just recognize it.

ExamReady AI answers a different question than the usual tools:

> Not "what's in my lecture?" — but **"what should I study next, why, and how do I know if I actually understand it?"**

It combines two ideas from the original product spec:

- **Exam Crisis** — helping students prioritize what to study when time is limited
- **Lecture-to-Understanding** — identifying what a student actually understands vs. what just looks familiar

It does **not** promise to predict exact exam marks, guarantee exam questions, or replace teachers. It helps students make better decisions about how to spend limited preparation time — and every recommendation it makes is explainable, not a black-box score.

---

## The core loop

    Sign up / log in
        → Pick a subject (new or existing)
        → Upload lecture PDF (+ optional previous-year papers)
        → AI extracts topics, grounded only in the uploaded material
        → Diagnostic assessment (6 MCQs: recall / conceptual / application)
        → Knowledge-gap detection (Strong / Needs Revision / Weak / Not Assessed)
        → Priority engine ranks weak topics, with a plain-English reason for each
        → Personalized revision session on the top-priority topic
        → Follow-up questions → topic status updates based on real performance
        → Dashboard reflects the update, points to the next priority topic
        → Final readiness report (plain counts, downloadable as PDF)

This closed loop — **Assessment → Diagnosis → Intervention → Reassessment** — is the core differentiator from a typical "AI notes/quiz generator." The AI doesn't just generate content; it uses the student's own responses to decide what to teach next.

---

## Features

**Core loop**
- 📄 PDF upload with AI-driven topic extraction, grounded only in the supplied material (no invented content)
- 🧠 Diagnostic assessment spanning recall, conceptual understanding, and application difficulty
- 📊 Knowledge-gap detection across four honest states — never a fabricated overall score
- 🎯 Priority engine with plain-language, explainable reasons for every recommendation
- 📚 Optional previous-year paper analysis — when uploaded, priority reasoning cites real exam-relevance evidence (e.g. "appears in 3 questions across your previous papers")
- ✍️ Personalized revision sessions targeted at the specific concept a student got wrong
- ✅ Follow-up reassessment that updates topic mastery based on real performance
- 📈 Final readiness report with plain counts and a downloadable PDF export

**Accounts & data**
- 🔐 Full authentication (Supabase Auth — email/password, email verification)
- 🔒 Row-level security — every user's data is isolated at the database level, not just the UI level
- 📚 Multi-subject support — "My Subjects" hub grouping multiple exam sessions per subject
- 👤 Student profile page with real, honest aggregate stats (topics mastered, sessions completed) — no fake percentages

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| AI | Google Gemini API (`gemini-3.6-flash`) |
| Auth | Supabase Auth |
| Database | Supabase Postgres, with Row-Level Security policies |
| PDF parsing (upload) | `pdf-parse` |
| PDF generation (export) | `@react-pdf/renderer` |
| Deployment | Vercel |

---

## Setup

### 1. Clone and install

    git clone <your-repo-url>
    cd examready-ai
    npm install

### 2. Environment variables

Create `.env.local`:

    GEMINI_API_KEY=your_gemini_api_key
    GEMINI_MODEL=gemini-3.6-flash

    NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

- Gemini key: [Google AI Studio](https://aistudio.google.com/apikey)
- Supabase keys: your Supabase project → **Settings → API**

### 3. Database schema

Run the full schema + Row-Level Security policy script inside your Supabase project's **SQL Editor**. This creates: `profiles`, `subjects`, `exam_sessions`, `topics`, `questions`, `attempts`, `pyq_relevance`, all with RLS enabled so users can only ever access their own data.

### 4. Auth redirect URLs

In Supabase → **Authentication → URL Configuration**, set:
- **Site URL** to your deployed URL (or `http://localhost:3000` for local-only testing)
- **Redirect URLs**: add both `http://localhost:3000/**` and your production URL + `/**`

Get this wrong and email verification links will open the wrong environment — worth double-checking before inviting anyone else to test.

### 5. Run locally

    npm run dev

Visit `http://localhost:3000`.

### 6. Deploy

    npx vercel --prod

Add **all five environment variables above** to your Vercel project's **Settings → Environment Variables** (Production *and* Preview) before deploying — a deploy without them will fail silently on auth/AI features even though the build succeeds.

---

## Project structure

    app/
      page.tsx                          Landing page
      login/, signup/                   Auth pages
      subjects/                         "My Subjects" hub — main landing page after login
      profile/                          Student profile + aggregate stats
      new-session/                      Upload flow (subject selection, lecture PDF, optional PYQ)
      assessment/                       Diagnostic assessment UI
      dashboard/[sessionId]/            Knowledge overview + "next best action"
      revision/[sessionId]/[topic]/     Personalized revision session
      report/[sessionId]/               Final readiness report + PDF export
      components/nav.tsx                Shared navigation across authenticated pages
      api/
        session/create/                 Create a new exam session (auth-derived user, not client-supplied)
        extract/, extract-pyq/          PDF text extraction
        extract-topics/                 AI topic extraction
        analyze-pyq/                    AI exam-relevance analysis
        generate-assessment/            AI diagnostic question generation
        evaluate-assessment/            Diagnostic scoring
        knowledge-gaps/                 Gap classification + priority engine
        generate-revision/              AI revision session generation
        evaluate-followup/              Follow-up scoring + status update
        readiness-report/[sessionId]/   Readiness report aggregation
        subjects/                       Subject + session listing
        profile/                        Profile data + stats
    lib/
      db.ts                             All data access (Supabase Postgres)
      gemini.ts                         Gemini API wrapper
      types.ts                          Shared TypeScript types
      supabase/client.ts, server.ts     Supabase clients (browser + server)
      pdf/readiness-report-pdf.tsx      PDF export template

---

## Design principles

- **Grounded generation** — every AI-generated question, explanation, and recommendation is based only on the student's own uploaded material; the system is instructed never to invent content beyond it
- **Explainable, not black-box** — every priority recommendation comes with a plain-English reason a student can actually evaluate
- **Honest about limits** — no fabricated readiness percentages, no promises of predicting exact exam questions or scores
- **Security by default** — data isolation is enforced at the database level (Row-Level Security), not just hidden in the UI
- **Focused scope** — deliberately not a full LMS, chatbot, or attendance/calendar tool; one polished exam-prep flow, done well

---

## Known limitations / not yet built

- PDF-only uploads (DOCX/PPTX not yet supported)
- Password reset flow not yet implemented
- Exam date/study time are set once at session creation, not editable afterward
- One lecture PDF per session (multiple-PDF merge not yet supported)
- No retry loop if a student still misses a follow-up question — they're returned to the dashboard instead

---

## License

Built for hackathon submission and continued personal development.
