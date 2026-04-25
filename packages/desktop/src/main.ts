/**
 * CharClaw Desktop — Electron main process.
 *
 * Dev:  loads http://localhost:3000 (Next.js dev server)
 * Prod: loads the bundled Next.js server (starts it as a child process)
 */

import { app, BrowserWindow, ipcMain, session } from "electron"
import path from "node:path"
import { autoUpdater } from "electron-updater"
import { createTray, destroyTray } from "./tray"
import { startDaemon, stopDaemon } from "./daemon-manager"
import { BAKED_SERVER_URL } from "./server-url.generated"

const IS_DEV = !app.isPackaged

// Backend URL resolution, in priority order:
//   1. CHARCLAW_SERVER_URL env var in the user's shell (rare — only for dev
//      overrides when running an unpackaged Electron locally)
//   2. BAKED_SERVER_URL — written by scripts/bake-server-url.mjs at build
//      time from the CHARCLAW_SERVER_URL env var; defaults to
//      http://localhost:3000 for personal-local-use installers
//   3. Dev default when unpackaged: http://localhost:3000
const SERVER_URL =
  process.env.CHARCLAW_SERVER_URL?.trim() ||
  BAKED_SERVER_URL ||
  (IS_DEV ? "http://localhost:3000" : "http://localhost:3000")

const SERVER_ORIGIN = new URL(SERVER_URL).origin
const WS_ORIGIN = SERVER_ORIGIN.replace(/^http/, "ws")

let mainWindow: BrowserWindow | null = null
let isQuitting = false

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false, // shown after ready-to-show
  })

  win.loadURL(SERVER_URL)

  win.once("ready-to-show", () => {
    win.show()
  })

  // Keep app running in tray when window is closed
  win.on("close", (e: Event) => {
    if (!isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  win.webContents.on("did-fail-load", () => {
    // Retry in 2s if Next.js isn't ready yet (dev mode)
    setTimeout(() => win.loadURL(SERVER_URL), 2000)
  })

  return win
}

app.whenReady().then(async () => {
  // CSP relaxation for the configured backend (local in dev, hosted in prod).
  // Dev needs unsafe-inline/eval for Next.js HMR; prod keeps them because the
  // bundled Next.js runtime still emits inline boot scripts.
  session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          `default-src 'self' 'unsafe-inline' 'unsafe-eval' ${SERVER_ORIGIN} ${WS_ORIGIN}`,
        ],
      },
    })
  })

  mainWindow = createWindow()
  createTray(mainWindow)

  // Start daemon after window is created
  startDaemon(SERVER_URL)

  // IPC: daemon status
  ipcMain.handle("daemon:status", () => ({
    running: true,
    serverUrl: SERVER_URL,
  }))

  // IPC: open new issue (called from tray menu → renderer)
  ipcMain.on("open-new-issue", () => {
    mainWindow?.webContents.send("open-new-issue")
    mainWindow?.show()
    mainWindow?.focus()
  })

  app.on("activate", () => {
    // macOS: re-open window when dock icon clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    } else {
      mainWindow?.show()
    }
  })

  if (!IS_DEV) {
    // electron-updater reads packages/desktop/package.json `build.publish`
    // to find the GitHub repo + tag. As long as the release workflow
    // publishes installers + latest.yml / latest-mac.yml / latest-linux.yml,
    // installed apps will check on startup and again every 4 hours.
    autoUpdater.logger = console
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on("update-available", (info) => {
      console.log(`[updater] update available: v${info.version}`)
    })
    autoUpdater.on("update-not-available", () => {
      console.log("[updater] up to date")
    })
    autoUpdater.on("error", (err) => {
      console.warn("[updater] error:", err?.message ?? err)
    })
    autoUpdater.on("download-progress", (p) => {
      console.log(`[updater] downloading ${Math.round(p.percent)}%`)
    })
    autoUpdater.on("update-downloaded", (info) => {
      console.log(`[updater] downloaded v${info.version}; will install on quit`)
    })

    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.warn("[updater] initial check failed:", err?.message ?? err)
    })
    // Long-running sessions: re-check every 4 hours.
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn("[updater] periodic check failed:", err?.message ?? err)
      })
    }, 4 * 60 * 60 * 1000)
  }
})

app.on("before-quit", () => {
  isQuitting = true
  stopDaemon()
  destroyTray()
})

app.on("window-all-closed", () => {
  // On non-mac, quit when all windows closed (unless hiding to tray)
  if (process.platform !== "darwin") {
    app.quit()
  }
})

