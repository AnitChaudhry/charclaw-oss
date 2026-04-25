import {
  Cpu,
  GitPullRequest,
  Layers,
  ShieldCheck,
  Terminal as TerminalIcon,
  Users,
} from "lucide-react"

interface Feature {
  icon: React.ReactNode
  title: string
  body: string
}

const features: Feature[] = [
  {
    icon: <Cpu className="h-5 w-5" />,
    title: "Runs on your machine",
    body: "A small daemon clones repos under your home directory and spawns the agent CLI you already trust. Code never leaves the box.",
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Six agents, one board",
    body: "Claude Code, Codex, Gemini, Goose, Pi, Opencode — pick per branch. Versions are auto-detected so you always know what's running.",
  },
  {
    icon: <GitPullRequest className="h-5 w-5" />,
    title: "GitHub-native workflow",
    body: "Issues become branches. Branches become PRs. Sign in with GitHub and the rest of the loop is exactly what your team already uses.",
  },
  {
    icon: <TerminalIcon className="h-5 w-5" />,
    title: "Real PTY in-app",
    body: "Open an interactive terminal straight into the working tree — Windows ConPTY, macOS, Linux. HMAC-signed, never exposed off localhost.",
  },
  {
    icon: <Layers className="h-5 w-5" />,
    title: "Multi-workspace",
    body: "Personal repo, side-project, client work. Each workspace has its own agents, settings, and members — no leaking between contexts.",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Bring your own keys",
    body: "Drop in your Anthropic / OpenAI / Gemini key and the app uses it directly. No proxy, no per-token markup, no vendor lock-in.",
  },
]

export function Features() {
  return (
    <section
      id="features"
      className="relative z-10 mx-auto max-w-6xl px-6 py-28"
    >
      <div className="mb-14 text-center">
        <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Features
        </div>
        <h2
          className="text-4xl font-normal leading-tight sm:text-5xl"
          style={{
            fontFamily: "'Instrument Serif', serif",
            letterSpacing: "-1.4px",
          }}
        >
          Everything you need to ship with agents,
          <br />
          <em className="not-italic text-muted-foreground">
            nothing that gets in the way.
          </em>
        </h2>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="liquid-glass rounded-2xl p-6"
          >
            <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-foreground ring-1 ring-white/10">
              {f.icon}
            </div>
            <h3
              className="mb-2 text-xl font-normal leading-tight text-foreground"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              {f.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {f.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
