import { redirect } from "next/navigation"
import { isAuthSkipped } from "@/lib/auth/dev-auth"
import LoginClient from "./login-client"

export default function LoginPage() {
  // Dev mode: bypass login entirely — jump straight to dev-session which mints
  // the cookie and redirects to the home page.
  if (isAuthSkipped()) {
    redirect("/api/auth/dev-session")
  }

  return <LoginClient />
}
