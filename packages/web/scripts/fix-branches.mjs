import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const r = await p.branch.updateMany({
  where: { NOT: { agent: "claude-code" } },
  data: { agent: "claude-code" },
})
console.log("updated", r.count, "branches to claude-code")
await p.$disconnect()
