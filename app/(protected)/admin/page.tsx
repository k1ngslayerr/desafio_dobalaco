import { redirect } from "next/navigation";

// /admin redirects to /admin/submissions by default
export default function AdminRootPage() {
  redirect("/admin/submissions");
}
