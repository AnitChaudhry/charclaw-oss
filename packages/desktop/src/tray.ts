/**
 * System tray icon + context menu for CharClaw Desktop.
 */

import { Tray, Menu, app, BrowserWindow, nativeImage } from "electron"
import path from "node:path"

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow): void {
  const iconPath = path.join(__dirname, "../assets/tray-icon.png")
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

  tray = new Tray(icon)
  tray.setToolTip("CharClaw")

  const menu = Menu.buildFromTemplate([
    {
      label: "Open CharClaw",
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      },
    },
    { type: "separator" },
    {
      label: "New Issue",
      click: () => {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send("open-new-issue")
      },
    },
    { type: "separator" },
    { label: "Quit CharClaw", click: () => app.quit() },
  ])

  tray.setContextMenu(menu)

  tray.on("double-click", () => {
    mainWindow.show()
    mainWindow.focus()
  })
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
