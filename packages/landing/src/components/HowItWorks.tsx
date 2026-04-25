interface Step {
  n: string
  title: string
  body: string
  code?: string
}

const steps: Step[] = [
  {
    n: "01",
    title: "Install in one command",
    body: "Clone, run setup, and the script handles the env, the database, and the daemon for you. macOS, Linux, Windows.",
    code: "bash scripts/setup.sh\nnpm run dev",
  },
  {
    n: "02",
    title: "Connect a repo, pick an agent",
    body: "Sign in with GitHub, drop in your Anthropic key, and choose Claude, Codex, Gemini, or whichever CLI is already on your PATH.",
  },
  {
    n: "03",
    title: "Assign an issue. Watch it ship.",
    body: "Drag a card on the kanban board to a teammate. The daemon clones the branch, runs the agent, streams logs back, and opens a PR when it's done.",
  },
]

export function HowItWorks() {
  return (
    <section
      id="how"
      className="relative z-10 mx-auto max-w-6xl px-6 py-28"
    >
      <div className="mb-14 text-center">
        <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          How it works
        </div>
        <h2
          className="text-4xl font-normal leading-tight sm:text-5xl"
          style={{
            fontFamily: "'Instrument Serif', serif",
            letterSpacing: "-1.4px",
          }}
        >
          From clone to first PR
          <em className="not-italic text-muted-foreground"> in minutes.</em>
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="liquid-glass relative flex flex-col rounded-2xl p-6"
          >
            <div
              className="mb-5 text-3xl text-muted-foreground"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              {s.n}
            </div>
            <h3
              className="mb-2 text-xl font-normal leading-tight text-foreground"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              {s.title}
            </h3>
            <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">
              {s.body}
            </p>
            {s.code && (
              <pre className="overflow-x-auto rounded-md bg-black/40 px-3 py-2 text-[11px] leading-relaxed text-foreground/90 ring-1 ring-white/10">
                <code>{s.code}</code>
              </pre>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
