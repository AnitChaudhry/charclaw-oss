/**
 * Electron preload — exposes a safe bridge from renderer (Next.js) to main process.
 */

import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("__charclaw", {
  // Open the new issue dialog (triggered from tray menu)
  onOpenNewIssue: (cb: () => void) => ipcRenderer.on("open-new-issue", cb),

  // Daemon status polling
  getDaemonStatus: () => ipcRenderer.invoke("daemon:status"),

  // Platform info
  platform: process.platform,
  isDesktop: true,
})
