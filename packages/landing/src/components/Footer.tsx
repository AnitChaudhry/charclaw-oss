const REPO_URL = "https://github.com/AnitChaudhry/CharClaw-App"

interface LinkGroup {
  title: string
  links: { label: string; href: string }[]
}

const groups: LinkGroup[] = [
  {
    title: "Project",
    links: [
      { label: "GitHub", href: REPO_URL },
      { label: "Releases", href: `${REPO_URL}/releases` },
      { label: "Issues", href: `${REPO_URL}/issues` },
    ],
  },
  {
    title: "Docs",
    links: [
      { label: "README", href: `${REPO_URL}#readme` },
      { label: "Setup guide", href: `${REPO_URL}/blob/main/AGENTS.md` },
      { label: "Deployment", href: `${REPO_URL}/blob/main/DEPLOYMENT.md` },
    ],
  },
  {
    title: "License",
    links: [
      { label: "Apache 2.0", href: `${REPO_URL}/blob/main/LICENSE` },
      { label: "Contributing", href: `${REPO_URL}/blob/main/CONTRIBUTING.md` },
    ],
  },
]

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/5 bg-black/20">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <a
            href="#top"
            className="select-none text-2xl tracking-tight text-foreground"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            CharClaw<sup className="text-[10px]">®</sup>
          </a>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Self-hosted AI coding agents. Assign GitHub issues to Claude,
            Codex, Gemini and more — runs on your machine, not in the cloud.
          </p>
        </div>

        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {g.title}
            </div>
            <ul className="space-y-2">
              {g.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    target={l.href.startsWith("http") ? "_blank" : undefined}
                    rel={
                      l.href.startsWith("http")
                        ? "noopener noreferrer"
                        : undefined
                    }
                    className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} CharClaw — Apache 2.0</span>
          <span>
            Built in the open ·{" "}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              fork it
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}
