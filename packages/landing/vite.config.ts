import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"

// Base path for assets. GitHub Pages serves the site under /<repo>/ by
// default; a custom domain (CNAME) serves it under /. Set VITE_BASE to
// "/charclaw/" for github.io and leave unset for localhost / custom domain.
const base = process.env.VITE_BASE ?? "/"

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
