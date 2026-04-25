import { redirect } from "next/navigation"

/**
 * Legacy /team path — now forwards to the new /workspace page.
 */
export default function TeamPageRedirect() {
  redirect("/workspace")
}
