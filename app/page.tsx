import { redirect } from "next/navigation";

// Root "/" redirects to dashboard (middleware will push to /auth/login if unauthenticated)
export default function RootPage() {
  redirect("/dashboard");
}
