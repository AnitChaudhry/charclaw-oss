import { Check, X } from "lucide-react"

interface Row {
  axis: string
  cloud: string
  charclaw: string
}

const rows: Row[] = [
  {
    axis: "Where your code runs",
    cloud: "Someone else's micro-VM",
    charclaw: "Your machine, your filesystem",
  },
  {
    axis: "API costs",
    cloud: "Per-token markup, rate limits",
    charclaw: "Your subscription, full quota",
  },
  {
    axis: "Cold start",
    cloud: "10-30s sandbox provision",
    charclaw: "Already running, instant",
  },
  {
    axis: "Secrets and SSH keys",
    cloud: "Uploaded to a vendor",
    charclaw: "Stay on your box",
  },
  {
    axis: "Offline work",
    cloud: "Doesn't",
    charclaw: "Most operations work offline",
  },
  {
    axis: "Lock-in",
    cloud: "Proprietary platform",
    charclaw: "Apache 2.0 — fork it",
  },
]

export function WhyLocal() {
  return (
    <section
      id="why"
      className="relative z-10 mx-auto max-w-5xl px-6 py-28"
    >
      <div className="mb-14 text-center">
        <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Why local
        </div>
        <h2
          className="text-4xl font-normal leading-tight sm:text-5xl"
          style={{
            fontFamily: "'Instrument Serif', serif",
            letterSpacing: "-1.4px",
          }}
        >
          The same agents,
          <em className="not-italic text-muted-foreground">
            {" "}
            without the cloud tax.
          </em>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground">
          Cloud sandbox tools rent you a tiny VM and bill you for it.
          CharClaw runs on the laptop you already own — same Claude, same
          Codex, no middleman.
        </p>
      </div>

      <div className="liquid-glass overflow-hidden rounded-2xl">
        <div className="grid grid-cols-3 border-b border-white/5 px-6 py-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <span></span>
          <span className="flex items-center gap-2">
            <X className="h-3.5 w-3.5 opacity-60" />
            Cloud sandboxes
          </span>
          <span className="flex items-center gap-2 text-foreground/80">
            <Check className="h-3.5 w-3.5" />
            CharClaw
          </span>
        </div>

        {rows.map((r, i) => (
          <div
            key={r.axis}
            className={
              i % 2 === 0
                ? "grid grid-cols-3 px-6 py-5 text-sm"
                : "grid grid-cols-3 bg-white/[0.02] px-6 py-5 text-sm"
            }
          >
            <span className="text-muted-foreground">{r.axis}</span>
            <span className="text-foreground/70">{r.cloud}</span>
            <span className="text-foreground">{r.charclaw}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
