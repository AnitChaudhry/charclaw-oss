// Copy-to-clipboard for code snippets.
document.querySelectorAll(".snippet[data-copy]").forEach((snippet) => {
  const btn = snippet.querySelector(".copy-btn")
  const code = snippet.querySelector("code")
  if (!btn || !code) return
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code.innerText)
      const original = btn.textContent
      btn.textContent = "Copied"
      btn.classList.add("copied")
      setTimeout(() => {
        btn.textContent = original
        btn.classList.remove("copied")
      }, 1500)
    } catch {
      // Clipboard unavailable (http, iframe sandbox, etc.) — ignore.
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Per-OS download picker.
// Mirrors packages/landing/src/components/Download.tsx in vanilla JS:
//   - Detects the visitor's OS from navigator.userAgent / .platform
//   - Fetches the latest release from the CharClaw-App GitHub API
//   - Highlights the asset matching the detected OS as the primary download
//   - Shows the other-OS assets as secondary pills
// Falls back to a "Download from GitHub" link if the API call fails (rate
// limit, offline, GitHub API outage).
// ──────────────────────────────────────────────────────────────────────────
const RELEASE_API =
  "https://api.github.com/repos/AnitChaudhry/CharClaw-App/releases/latest"
const RELEASES_PAGE =
  "https://github.com/AnitChaudhry/CharClaw-App/releases/latest"

const OS_LABELS = { mac: "macOS", windows: "Windows", linux: "Linux" }

function detectOS() {
  if (typeof navigator === "undefined") return null
  const platform =
    (navigator.userAgentData && navigator.userAgentData.platform) ||
    navigator.platform ||
    ""
  const ua = navigator.userAgent || ""
  const probe = (platform + " " + ua).toLowerCase()
  if (/(mac|iphone|ipad|darwin)/.test(probe)) return "mac"
  if (/win/.test(probe)) return "windows"
  if (/linux|cros|x11/.test(probe)) return "linux"
  return null
}

function categorizeAsset(name) {
  if (/\.dmg$/i.test(name)) return "mac"
  if (/\.(exe|msi)$/i.test(name)) return "windows"
  if (/\.(appimage|deb|rpm)$/i.test(name)) return "linux"
  return null
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB"
  if (bytes >= 1024) return Math.round(bytes / 1024) + " KB"
  return bytes + " B"
}

function renderDownload() {
  const titleEl = document.getElementById("download-title")
  const primaryEl = document.getElementById("download-primary")
  const versionEl = document.getElementById("download-version")
  const othersEl = document.getElementById("download-others")
  const loadingEl = document.getElementById("download-loading")
  if (!titleEl || !primaryEl || !othersEl) return

  const detected = detectOS()
  if (detected && titleEl) {
    titleEl.textContent = "CharClaw for " + OS_LABELS[detected]
  }

  fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" } })
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status)
      return r.json()
    })
    .then((release) => {
      if (loadingEl) loadingEl.remove()

      const byOs = {}
      for (const asset of release.assets || []) {
        const k = categorizeAsset(asset.name)
        if (k && !byOs[k]) byOs[k] = asset
      }

      const primaryKey = detected || "mac"
      const primary = byOs[primaryKey]
      const version = (release.tag_name || "").replace(/^v/, "")

      if (primary) {
        primaryEl.href = primary.browser_download_url
        primaryEl.textContent = "Download for " + OS_LABELS[primaryKey] + " "
        if (version) {
          const v = document.createElement("span")
          v.className = "download-version"
          v.textContent = "v" + version
          primaryEl.appendChild(v)
        }
      } else {
        primaryEl.href = release.html_url || RELEASES_PAGE
        primaryEl.textContent = "See release"
        if (version) {
          const v = document.createElement("span")
          v.className = "download-version"
          v.textContent = "v" + version
          primaryEl.appendChild(v)
        }
      }

      othersEl.innerHTML = ""
      const others = ["mac", "windows", "linux"].filter(
        (k) => k !== primaryKey && byOs[k],
      )
      for (const k of others) {
        const a = byOs[k]
        const el = document.createElement("a")
        el.href = a.browser_download_url
        el.className = "download-other-pill"
        el.innerHTML =
          OS_LABELS[k] + ' <span class="size">· ' + formatSize(a.size) + "</span>"
        othersEl.appendChild(el)
      }
    })
    .catch(() => {
      if (loadingEl) loadingEl.remove()
      primaryEl.href = RELEASES_PAGE
      primaryEl.textContent = "Download from GitHub"
    })
}

renderDownload()

// Highlight the currently-in-view nav section.
const sections = ["top", "features", "download", "fork"]
  .map((id) => document.getElementById(id))
  .filter(Boolean)

const navLinks = document.querySelectorAll(".nav-links a")
if ("IntersectionObserver" in window && sections.length && navLinks.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const id = entry.target.id
        navLinks.forEach((a) => {
          const href = a.getAttribute("href") || ""
          a.classList.toggle("active", href === `#${id}`)
        })
      })
    },
    { rootMargin: "-30% 0px -60% 0px" },
  )
  sections.forEach((s) => observer.observe(s))
}
