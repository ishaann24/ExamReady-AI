export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-surface flex flex-col justify-between px-6 py-12 md:px-16 md:py-20 max-w-5xl mx-auto w-full">
      <header className="flex items-center justify-between border-b border-muted/20 pb-6">
        <span className="font-semibold text-sm tracking-wider uppercase text-surface">
          ExamReady AI
        </span>
        <span className="text-xs text-muted border border-muted/30 px-2.5 py-1 rounded-sm">
          System Ready
        </span>
      </header>

      <div className="my-auto py-16 max-w-2xl">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight text-surface leading-[1.15] mb-6">
          Study smarter before your exam.
        </h1>
        <p className="text-lg sm:text-xl text-muted leading-relaxed font-normal mb-10">
          Transform raw course material into targeted active-recall sessions engineered to eliminate knowledge gaps before test day.
        </p>
        <div>
          <button className="bg-accent hover:opacity-95 text-background font-medium px-6 py-3.5 rounded-md transition-opacity duration-150 inline-flex items-center justify-center text-base cursor-pointer">
            Start Exam Preparation
          </button>
        </div>
      </div>

      <footer className="border-t border-muted/20 pt-6 flex items-center justify-between text-xs text-muted">
        <span>Precision study tools for high-stakes preparation.</span>
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-status-strong"></span>
          System Operational
        </span>
      </footer>
    </main>
  );
}
