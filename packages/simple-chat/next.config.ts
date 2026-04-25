import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Transpile workspace packages (source imports)
  transpilePackages: ["@charclaw/agents", "@charclaw/common"],
}

export default nextConfig
