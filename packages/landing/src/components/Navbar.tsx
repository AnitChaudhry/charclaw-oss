const navLinks: { label: string; href: string; active?: boolean }[] = [
  { label: "Home", href: "#top", active: true },
  { label: "Features", href: "#features" },
  { label: "How", href: "#how" },
  { label: "Why local", href: "#why" },
  { label: "Download", href: "#download" },
]

const APP_URL =
  (import.meta.env.VITE_APP_URL as string | undefined) ??
  "https://charclaw.upfyn.com"
const SIGNUP_URL = `${APP_URL}?intent=signup`
const LOGIN_URL = `${APP_URL}?intent=login`

interface AuthPillProps {
  label: string
  tooltip: string
  href: string
  primary?: boolean
}

function AuthPill({ label, tooltip, href, primary }: AuthPillProps) {
  return (
    <div className="group relative">
      <a
        href={href}
        className={
          primary
            ? "inline-flex items-center justify-center rounded-full border border-white/20 bg-white/[0.08] px-4 py-1.5 text-sm text-foreground backdrop-blur transition-colors hover:bg-white/[0.14]"
            : "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
        }
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        {label}
      </a>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/70 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-foreground/90 opacity-0 backdrop-blur transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {tooltip}
      </span>
    </div>
  )
}

export function Navbar() {
  return (
    <nav className="relative z-10 mx-auto flex max-w-7xl flex-row items-center justify-between px-8 py-6">
      <a
        href="#top"
        className="select-none text-3xl tracking-tight text-foreground"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        CharClaw<sup className="text-xs">®</sup>
      </a>

      <div className="hidden items-center gap-8 md:flex">
        {navLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className={
              link.active
                ? "text-sm text-foreground transition-colors"
                : "text-sm text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            {link.label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <AuthPill label="Hey" tooltip="Sign up" href={SIGNUP_URL} />
        <AuthPill label="Hello" tooltip="Login" href={LOGIN_URL} primary />
      </div>
    </nav>
  )
}
