import { Button } from "@/components/ui/button"

const APP_URL =
  (import.meta.env.VITE_APP_URL as string | undefined) ??
  "https://charclaw.upfyn.com"
const REPO_URL = "https://github.com/AnitChaudhry/CharClaw-App"

export function Hero() {
  return (
    <section
      id="top"
      className="relative z-10 flex flex-col items-center justify-center px-6 pt-32 pb-40 py-[90px] text-center"
    >
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="animate-fade-rise mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
      >
        ★ Proudly open source — Apache 2.0, self-hosted, bring your own keys
      </a>
      <h1
        className="animate-fade-rise-delay max-w-7xl text-5xl font-normal leading-[0.95] sm:text-7xl md:text-8xl"
        style={{
          fontFamily: "'Instrument Serif', serif",
          letterSpacing: "-2.46px",
        }}
      >
        Your{" "}
        <em className="not-italic text-muted-foreground">AI dev team</em>,
        running{" "}
        <em className="not-italic text-muted-foreground">locally.</em>
      </h1>

      <p className="animate-fade-rise-delay-2 mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        CharClaw turns coding agents into real teammates — assign issues on a
        Kanban board, watch the work stream back from your own machine, and
        ship pull requests. No cloud sandboxes. No rate-limited micro-VMs.
        Just you, your repo, and a squad of AI that doesn&apos;t clock out.
      </p>

      <Button
        variant="glass"
        size="lg"
        className="animate-fade-rise-delay-3 mt-12 cursor-pointer"
        onClick={() => {
          window.location.href = APP_URL
        }}
      >
        Begin Journey
      </Button>
    </section>
  )
}
